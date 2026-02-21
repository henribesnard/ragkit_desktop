from __future__ import annotations

from collections import Counter
import hashlib
import json
import math
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from ragkit.config.embedding_schema import ConnectionTestResult, EmbeddingConfig, EmbeddingProvider
from ragkit.embedding.catalog import get_model_info


CLOUD_PROVIDERS = {
    EmbeddingProvider.OPENAI,
    EmbeddingProvider.COHERE,
    EmbeddingProvider.VOYAGEAI,
    EmbeddingProvider.MISTRAL,
}


@dataclass
class EmbedOutput:
    vector: list[float]
    latency_ms: int


def _l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        return vector
    return [v / norm for v in vector]


class EmbeddingEngine:
    """Embedding engine that dispatches to the correct provider.

    Supported providers:
    - **openai**: Uses the ``openai`` SDK (``text-embedding-3-small``, etc.)
    - **ollama**: Calls the local Ollama REST API (``nomic-embed-text``, etc.)
    - **cohere**: Uses the ``cohere`` SDK (``embed-multilingual-v3.0``, etc.)
    - **voyageai**: Uses the ``voyageai`` SDK (``voyage-3-large``, etc.)
    - **mistral**: Uses the ``mistralai`` SDK (``mistral-embed``, etc.)
    - **huggingface**: Loads models locally via ``sentence-transformers``

    When no API key is available and no local provider is configured, a
    deterministic hashed-lexical fallback is used.
    """

    def __init__(self, config: EmbeddingConfig, api_key: str | None = None):
        self.config = config
        self.api_key = api_key
        self._st_model: Any = None  # lazy-loaded SentenceTransformer

    @property
    def model_id(self) -> str:
        return f"{self.config.provider}:{self.config.model}:{self.config.dimensions or 'default'}"

    def resolve_dimensions(self) -> int:
        model = get_model_info(self.config.provider, self.config.model)
        if self.config.dimensions:
            return self.config.dimensions
        if model:
            return model.dimensions_default
        return 768

    # ------------------------------------------------------------------ #
    #  Provider dispatch                                                   #
    # ------------------------------------------------------------------ #

    def embed_text(self, text: str) -> EmbedOutput:
        """Embed a single text using the configured provider."""
        start = time.perf_counter()
        provider = self.config.provider

        # Determine whether to use real provider or fallback
        needs_api_key = provider in CLOUD_PROVIDERS
        use_fallback = needs_api_key and not self.api_key

        if use_fallback:
            vector = self._hashed_lexical_embed(text, self.resolve_dimensions())
        elif provider == EmbeddingProvider.OPENAI:
            vector = self._embed_openai(text)
        elif provider == EmbeddingProvider.OLLAMA:
            vector = self._embed_ollama(text)
        elif provider == EmbeddingProvider.COHERE:
            vector = self._embed_cohere(text)
        elif provider == EmbeddingProvider.VOYAGEAI:
            vector = self._embed_voyageai(text)
        elif provider == EmbeddingProvider.MISTRAL:
            vector = self._embed_mistral(text)
        elif provider == EmbeddingProvider.HUGGINGFACE:
            vector = self._embed_huggingface(text)
        else:
            vector = self._hashed_lexical_embed(text, self.resolve_dimensions())

        if self.config.normalize:
            vector = _l2_normalize(vector)

        latency = int((time.perf_counter() - start) * 1000)
        return EmbedOutput(vector=vector, latency_ms=max(1, latency))

    def embed_texts(self, texts: list[str]) -> list[EmbedOutput]:
        """Embed multiple texts, using batch APIs when available."""
        if not texts:
            return []

        provider = self.config.provider
        needs_api_key = provider in CLOUD_PROVIDERS
        use_fallback = needs_api_key and not self.api_key

        if use_fallback or provider == EmbeddingProvider.OLLAMA:
            # No batch API for Ollama or fallback — sequential
            return [self.embed_text(text) for text in texts]

        start = time.perf_counter()

        if provider == EmbeddingProvider.OPENAI:
            vectors = self._batch_openai(texts)
        elif provider == EmbeddingProvider.COHERE:
            vectors = self._batch_cohere(texts)
        elif provider == EmbeddingProvider.VOYAGEAI:
            vectors = self._batch_voyageai(texts)
        elif provider == EmbeddingProvider.MISTRAL:
            vectors = self._batch_mistral(texts)
        elif provider == EmbeddingProvider.HUGGINGFACE:
            vectors = self._batch_huggingface(texts)
        else:
            return [self.embed_text(text) for text in texts]

        latency = int((time.perf_counter() - start) * 1000)
        per_item = max(1, latency // len(texts))

        results: list[EmbedOutput] = []
        for vec in vectors:
            if self.config.normalize:
                vec = _l2_normalize(vec)
            results.append(EmbedOutput(vector=vec, latency_ms=per_item))
        return results

    # ------------------------------------------------------------------ #
    #  OpenAI                                                              #
    # ------------------------------------------------------------------ #

    def _embed_openai(self, text: str) -> list[float]:
        return self._batch_openai([text])[0]

    def _batch_openai(self, texts: list[str]) -> list[list[float]]:
        from openai import OpenAI

        client = OpenAI(api_key=self.api_key, timeout=self.config.timeout)
        kwargs: dict[str, Any] = {
            "model": self.config.model,
            "input": texts,
        }
        if self.config.dimensions:
            kwargs["dimensions"] = self.config.dimensions

        response = client.embeddings.create(**kwargs)
        # Sort by index to guarantee order
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [item.embedding for item in sorted_data]

    # ------------------------------------------------------------------ #
    #  Ollama (local)                                                      #
    # ------------------------------------------------------------------ #

    def _embed_ollama(self, text: str) -> list[float]:
        payload = json.dumps({"model": self.config.model, "input": text}).encode()
        req = urllib.request.Request(
            "http://127.0.0.1:11434/api/embed",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=self.config.timeout) as resp:
            data = json.loads(resp.read())
        embeddings = data.get("embeddings", [])
        if not embeddings:
            raise RuntimeError(f"Ollama returned no embeddings for model {self.config.model}")
        return embeddings[0]

    # ------------------------------------------------------------------ #
    #  Cohere                                                              #
    # ------------------------------------------------------------------ #

    def _embed_cohere(self, text: str) -> list[float]:
        return self._batch_cohere([text])[0]

    def _batch_cohere(self, texts: list[str]) -> list[list[float]]:
        import cohere

        client = cohere.ClientV2(api_key=self.api_key, timeout=self.config.timeout)
        response = client.embed(
            texts=texts,
            model=self.config.model,
            input_type="search_document",
            embedding_types=["float"],
        )
        return [list(emb) for emb in response.embeddings.float_]

    # ------------------------------------------------------------------ #
    #  VoyageAI                                                            #
    # ------------------------------------------------------------------ #

    def _embed_voyageai(self, text: str) -> list[float]:
        return self._batch_voyageai([text])[0]

    def _batch_voyageai(self, texts: list[str]) -> list[list[float]]:
        import voyageai

        client = voyageai.Client(api_key=self.api_key)
        result = client.embed(texts, model=self.config.model, input_type="document")
        return result.embeddings

    # ------------------------------------------------------------------ #
    #  Mistral                                                             #
    # ------------------------------------------------------------------ #

    def _embed_mistral(self, text: str) -> list[float]:
        return self._batch_mistral([text])[0]

    def _batch_mistral(self, texts: list[str]) -> list[list[float]]:
        from mistralai import Mistral

        client = Mistral(api_key=self.api_key, timeout_ms=self.config.timeout * 1000)
        response = client.embeddings.create(model=self.config.model, inputs=texts)
        return [item.embedding for item in response.data]

    # ------------------------------------------------------------------ #
    #  HuggingFace / Sentence-Transformers (local)                         #
    # ------------------------------------------------------------------ #

    def _get_st_model(self) -> Any:
        if self._st_model is None:
            import os
            from pathlib import Path
            from sentence_transformers import SentenceTransformer
            
            # Set HF cache home to a local ragkit directory so large models don't pollute the generic OS cache
            models_dir = Path.home() / ".ragkit" / "models"
            models_dir.mkdir(parents=True, exist_ok=True)
            os.environ["HF_HOME"] = str(models_dir)
            
            # Detect hardware
            device = "cpu"
            try:
                import torch
                if torch.cuda.is_available():
                    device = "cuda"
                elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    device = "mps"
            except ImportError:
                pass

            self._st_model = SentenceTransformer(self.config.model, device=device)
        return self._st_model

    def _embed_huggingface(self, text: str) -> list[float]:
        model = self._get_st_model()
        embedding = model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    def _batch_huggingface(self, texts: list[str]) -> list[list[float]]:
        model = self._get_st_model()
        embeddings = model.encode(texts, convert_to_numpy=True, batch_size=self.config.batch_size)
        return [emb.tolist() for emb in embeddings]

    # ------------------------------------------------------------------ #
    #  Fallback: hashed lexical embedding                                  #
    # ------------------------------------------------------------------ #

    def _hashed_lexical_embed(self, text: str, dimensions: int) -> list[float]:
        """Deterministic fallback when no ML provider is available.

        Projects tokens into a fixed-dimension vector via SHA-256 hashing.
        This is NOT a semantic embedding — it only captures lexical overlap.
        """
        if dimensions <= 0:
            raise ValueError("Embedding dimensions must be > 0.")

        tokens = re.findall(r"\w+", text.lower(), flags=re.UNICODE)
        if not tokens:
            return [0.0 for _ in range(dimensions)]

        counts = Counter(tokens)
        total = sum(counts.values())
        vec = [0.0 for _ in range(dimensions)]

        for token, freq in counts.items():
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            weight = freq / total

            index_a = int.from_bytes(digest[:8], byteorder="big", signed=False) % dimensions
            sign_a = 1.0 if (digest[8] & 1) == 0 else -1.0
            vec[index_a] += sign_a * weight

            index_b = int.from_bytes(digest[9:17], byteorder="big", signed=False) % dimensions
            sign_b = 1.0 if (digest[17] & 1) == 0 else -1.0
            vec[index_b] += sign_b * (weight * 0.5)

        return _l2_normalize(vec) if self.config.normalize else vec

    # ------------------------------------------------------------------ #
    #  Connection test                                                     #
    # ------------------------------------------------------------------ #

    def test_connection(self) -> ConnectionTestResult:
        """Test connectivity and authentication with the configured provider."""
        start = time.perf_counter()

        if self.config.provider in CLOUD_PROVIDERS and not self.api_key:
            return ConnectionTestResult(
                success=False, status="auth_error",
                message="Clé API invalide ou manquante",
            )
            
        if self.config.provider == EmbeddingProvider.OLLAMA:
            # For Ollama, do a direct ping to check if it's running before embedding
            try:
                import urllib.request
                req = urllib.request.Request("http://127.0.0.1:11434/api/tags", method="GET")
                with urllib.request.urlopen(req, timeout=self.config.timeout) as resp:
                    data = json.loads(resp.read())
                    models = [m.get("name") for m in data.get("models", [])]
                    
                    if self.config.model not in models:
                        return ConnectionTestResult(
                            success=False, status="model_error",
                            message=f"Modèle '{self.config.model}' non installé dans Ollama.",
                        )
            except Exception as e:
                return ConnectionTestResult(
                    success=False, status="network_error",
                    message="Impossible de joindre Ollama (assurez-vous qu'il est lancé en arrière-plan).",
                )

        # Try to actually produce an embedding as the definitive test
        try:
            test_output = self.embed_text("test connection")
            dims = len(test_output.vector)
            latency = int((time.perf_counter() - start) * 1000)
            return ConnectionTestResult(
                success=True, status="success",
                message="Connexion réussie",
                latency_ms=max(1, latency), dimensions=dims,
            )
        except Exception as exc:
            error_msg = str(exc)
            if "401" in error_msg or "403" in error_msg or "auth" in error_msg.lower():
                return ConnectionTestResult(
                    success=False, status="auth_error",
                    message="Clé API invalide ou expirée",
                )
            if "timeout" in error_msg.lower() or "connect" in error_msg.lower():
                return ConnectionTestResult(
                    success=False, status="network_error",
                    message=f"Provider injoignable — {error_msg}",
                )
            return ConnectionTestResult(
                success=False, status="model_error",
                message=f"Erreur: {error_msg}",
            )


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        raise ValueError(f"Vector dimensions mismatch: {len(a)} != {len(b)}")
    denom_a = math.sqrt(sum(x * x for x in a))
    denom_b = math.sqrt(sum(x * x for x in b))
    if denom_a == 0 or denom_b == 0:
        return 0.0
    return max(-1.0, min(1.0, sum(x * y for x, y in zip(a, b)) / (denom_a * denom_b)))
