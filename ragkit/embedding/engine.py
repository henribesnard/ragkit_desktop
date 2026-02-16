from __future__ import annotations

from collections import Counter
import hashlib
import math
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass

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
    def __init__(self, config: EmbeddingConfig, api_key: str | None = None):
        self.config = config
        self.api_key = api_key

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

    def _hashed_lexical_embed(self, text: str, dimensions: int) -> list[float]:
        if dimensions <= 0:
            raise ValueError("Embedding dimensions must be > 0.")

        tokens = re.findall(r"\w+", text.lower(), flags=re.UNICODE)
        if not tokens:
            return [0.0 for _ in range(dimensions)]

        counts = Counter(tokens)
        total = sum(counts.values())
        vec = [0.0 for _ in range(dimensions)]

        # Token hashing projection: deterministic and text-sensitive without
        # pseudo-random vectors.
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

    def embed_text(self, text: str) -> EmbedOutput:
        start = time.perf_counter()
        vector = self._hashed_lexical_embed(text, self.resolve_dimensions())
        latency = int((time.perf_counter() - start) * 1000)
        return EmbedOutput(vector=vector, latency_ms=max(1, latency))

    def embed_texts(self, texts: list[str]) -> list[EmbedOutput]:
        return [self.embed_text(text) for text in texts]

    def test_connection(self) -> ConnectionTestResult:
        start = time.perf_counter()
        if self.config.provider in CLOUD_PROVIDERS and not self.api_key:
            return ConnectionTestResult(success=False, status="auth_error", message="Clé API invalide ou manquante")

        if self.config.provider == EmbeddingProvider.OLLAMA:
            try:
                urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=min(self.config.timeout, 5))
            except Exception:
                return ConnectionTestResult(success=False, status="network_error", message="Provider injoignable — vérifiez Ollama")

        if self.config.provider in CLOUD_PROVIDERS:
            test_urls = {
                EmbeddingProvider.OPENAI: "https://api.openai.com/v1/models",
                EmbeddingProvider.COHERE: "https://api.cohere.ai/v1/models",
                EmbeddingProvider.VOYAGEAI: "https://api.voyageai.com/v1/embeddings",
                EmbeddingProvider.MISTRAL: "https://api.mistral.ai/v1/models",
            }
            req = urllib.request.Request(test_urls[self.config.provider], method="GET")
            req.add_header("Authorization", f"Bearer {self.api_key}")
            try:
                urllib.request.urlopen(req, timeout=min(self.config.timeout, 10))
            except urllib.error.HTTPError as exc:
                if exc.code in {401, 403}:
                    return ConnectionTestResult(success=False, status="auth_error", message="Clé API invalide ou expirée")
                return ConnectionTestResult(success=False, status="model_error", message=f"Erreur provider: HTTP {exc.code}")
            except Exception:
                return ConnectionTestResult(success=False, status="network_error", message="Provider injoignable — vérifiez votre connexion")

        dims = self.resolve_dimensions()
        latency = int((time.perf_counter() - start) * 1000)
        return ConnectionTestResult(success=True, status="success", message="Connexion réussie", latency_ms=max(1, latency), dimensions=dims)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        raise ValueError(f"Vector dimensions mismatch: {len(a)} != {len(b)}")
    denom_a = math.sqrt(sum(x * x for x in a))
    denom_b = math.sqrt(sum(x * x for x in b))
    if denom_a == 0 or denom_b == 0:
        return 0.0
    return max(-1.0, min(1.0, sum(x * y for x, y in zip(a, b)) / (denom_a * denom_b)))
