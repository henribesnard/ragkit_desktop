"""Lexical search engine (BM25/BM25+) with persistent inverted index."""

from __future__ import annotations

import json
import math
import re
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ragkit.config.retrieval_schema import BM25Algorithm, LexicalSearchConfig, SearchFilters

_INDEX_FILE = "bm25_index.json"

_FALLBACK_STOPWORDS: dict[str, set[str]] = {
    "english": {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "for",
        "from",
        "in",
        "is",
        "it",
        "of",
        "on",
        "or",
        "that",
        "the",
        "to",
        "was",
        "were",
        "with",
    },
    "french": {
        "a",
        "au",
        "aux",
        "avec",
        "ce",
        "ces",
        "dans",
        "de",
        "des",
        "du",
        "elle",
        "en",
        "et",
        "eux",
        "il",
        "je",
        "la",
        "le",
        "les",
        "leur",
        "lui",
        "ma",
        "mais",
        "me",
        "meme",
        "mes",
        "moi",
        "mon",
        "ne",
        "nos",
        "notre",
        "nous",
        "on",
        "ou",
        "par",
        "pas",
        "pour",
        "qu",
        "que",
        "qui",
        "sa",
        "se",
        "ses",
        "son",
        "sur",
        "ta",
        "te",
        "tes",
        "toi",
        "ton",
        "tu",
        "un",
        "une",
        "vos",
        "votre",
        "vous",
    },
}

_LANG_ALIASES: dict[str, str] = {
    "auto": "auto",
    "fr": "french",
    "fra": "french",
    "fre": "french",
    "french": "french",
    "fr-fr": "french",
    "fr_ca": "french",
    "fr-ca": "french",
    "en": "english",
    "eng": "english",
    "english": "english",
    "en-us": "english",
    "en_us": "english",
    "en-gb": "english",
    "en_gb": "english",
}


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _payload_value(payload: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = payload.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return None


def _normalize_lang(language: str | None) -> str | None:
    if not language:
        return None
    token = str(language).strip().lower()
    if not token:
        return None
    if token in _LANG_ALIASES:
        return _LANG_ALIASES[token]
    if "-" in token:
        base = token.split("-", 1)[0]
        if base in _LANG_ALIASES:
            return _LANG_ALIASES[base]
    if "_" in token:
        base = token.split("_", 1)[0]
        if base in _LANG_ALIASES:
            return _LANG_ALIASES[base]
    if len(token) >= 2 and token[:2] in {"fr", "en"}:
        return "french" if token[:2] == "fr" else "english"
    return None


def _ensure_nltk_resources() -> None:
    # Best effort: lexical search works with fallback stopwords if download fails.
    try:
        import nltk

        nltk.download("stopwords", quiet=True)
        nltk.download("punkt", quiet=True)
    except Exception:
        return


@dataclass
class BM25SearchResult:
    chunk_id: str
    score: float
    text: str
    metadata: dict[str, Any]
    matched_terms: dict[str, int]
    doc_title: str | None = None
    doc_path: str | None = None
    doc_type: str | None = None
    page_number: int | None = None
    chunk_index: int | None = None
    chunk_total: int | None = None
    section_header: str | None = None
    doc_language: str | None = None
    category: str | None = None
    keywords: list[str] = field(default_factory=list)
    chunk_tokens: int | None = None
    ingestion_version: str | None = None


@dataclass
class LexicalSearchResponse:
    query: str
    results: list[BM25SearchResult]
    total_results: int
    query_tokens: list[str]
    tokenization_latency_ms: int
    search_latency_ms: int
    total_latency_ms: int
    results_from_index: int
    results_after_threshold: int


class TextPreprocessor:
    """Tokenization + optional stopwords + optional stemming + optional n-grams."""

    _token_pattern = re.compile(r"\b\w+\b", flags=re.UNICODE)

    def __init__(self, config: LexicalSearchConfig):
        self.config = config
        self._stopwords_cache: dict[str, set[str]] = {}
        self._stemmer_cache: dict[str, Any] = {}

    def tokenize(self, text: str, language: str | None = None) -> list[str]:
        text = text or ""
        if self.config.lowercase:
            text = text.lower()

        tokens = self._token_pattern.findall(text)
        if not tokens:
            return []

        if self.config.remove_stopwords:
            stopwords = self._resolve_stopwords(language)
            if stopwords:
                tokens = [token for token in tokens if token not in stopwords]

        if self.config.stemming:
            stemmer = self._resolve_stemmer(language)
            if stemmer is not None:
                tokens = [str(stemmer.stem(token)) for token in tokens]

        return self._apply_ngrams(tokens)

    def _apply_ngrams(self, tokens: list[str]) -> list[str]:
        if not tokens:
            return []

        min_n, max_n = self.config.ngram_range
        ngrams: list[str] = []
        if min_n <= 1:
            ngrams.extend(tokens)

        for n in range(max(2, min_n), max_n + 1):
            if n > len(tokens):
                continue
            for i in range(0, len(tokens) - n + 1):
                ngrams.append(" ".join(tokens[i : i + n]))

        return ngrams

    def _resolve_target_language(self, configured: str, document_language: str | None) -> str | None:
        normalized_config = _normalize_lang(configured)
        if normalized_config and normalized_config != "auto":
            return normalized_config
        return _normalize_lang(document_language)

    def _resolve_stopwords(self, language: str | None) -> set[str]:
        target_lang = self._resolve_target_language(self.config.stopwords_lang.value, language)
        if not target_lang:
            return set()
        if target_lang in self._stopwords_cache:
            return self._stopwords_cache[target_lang]

        words = set(_FALLBACK_STOPWORDS.get(target_lang, set()))
        try:
            _ensure_nltk_resources()
            from nltk.corpus import stopwords as nltk_stopwords

            words = set(nltk_stopwords.words(target_lang))
        except Exception:
            pass

        self._stopwords_cache[target_lang] = words
        return words

    def _resolve_stemmer(self, language: str | None):
        target_lang = self._resolve_target_language(self.config.stemmer_lang.value, language)
        if not target_lang:
            return None
        if target_lang in self._stemmer_cache:
            return self._stemmer_cache[target_lang]
        try:
            from nltk.stem.snowball import SnowballStemmer

            stemmer = SnowballStemmer(target_lang)
            self._stemmer_cache[target_lang] = stemmer
            return stemmer
        except Exception:
            return None


class BM25Index:
    """In-memory BM25 index with JSON persistence."""

    def __init__(self, config: LexicalSearchConfig):
        self.preprocessor = TextPreprocessor(config)
        self._doc_lengths: dict[str, int] = {}
        self._doc_term_freqs: dict[str, dict[str, int]] = {}
        self._doc_texts: dict[str, str] = {}
        self._doc_metadata: dict[str, dict[str, Any]] = {}
        self._doc_languages: dict[str, str | None] = {}
        self._postings: dict[str, dict[str, int]] = defaultdict(dict)
        self.last_updated_at: str | None = None
        self.last_updated_version: str | None = None

    @property
    def num_documents(self) -> int:
        return len(self._doc_lengths)

    @property
    def num_unique_terms(self) -> int:
        return len(self._postings)

    @property
    def avg_doc_length(self) -> float:
        if not self._doc_lengths:
            return 0.0
        return sum(self._doc_lengths.values()) / len(self._doc_lengths)

    def configure_preprocessor(self, config: LexicalSearchConfig) -> None:
        self.preprocessor = TextPreprocessor(config)

    def clear(self) -> None:
        self._doc_lengths.clear()
        self._doc_term_freqs.clear()
        self._doc_texts.clear()
        self._doc_metadata.clear()
        self._doc_languages.clear()
        self._postings = defaultdict(dict)
        self._touch()

    def add_document(
        self,
        doc_id: str,
        text: str,
        metadata: dict[str, Any] | None = None,
        language: str | None = None,
    ) -> None:
        if doc_id in self._doc_term_freqs:
            self.remove_document(doc_id)

        metadata = dict(metadata or {})
        doc_language = language or _payload_value(metadata, ("doc_language", "language"))
        tokens = self.preprocessor.tokenize(text or "", doc_language)
        frequencies = Counter(tokens)

        self._doc_lengths[doc_id] = len(tokens)
        self._doc_term_freqs[doc_id] = {term: int(count) for term, count in frequencies.items()}
        self._doc_texts[doc_id] = text or ""
        self._doc_metadata[doc_id] = metadata
        self._doc_languages[doc_id] = doc_language

        for term, count in self._doc_term_freqs[doc_id].items():
            self._postings[term][doc_id] = count

        ingestion_version = _payload_value(metadata, ("ingestion_version",))
        if ingestion_version:
            self.last_updated_version = ingestion_version
        self._touch()

    def remove_document(self, doc_id: str) -> None:
        frequencies = self._doc_term_freqs.pop(doc_id, None)
        if frequencies:
            for term in frequencies:
                postings = self._postings.get(term)
                if postings and doc_id in postings:
                    postings.pop(doc_id, None)
                    if not postings:
                        self._postings.pop(term, None)

        self._doc_lengths.pop(doc_id, None)
        self._doc_texts.pop(doc_id, None)
        self._doc_metadata.pop(doc_id, None)
        self._doc_languages.pop(doc_id, None)
        self._touch()

    def remove_document_chunks(self, doc_id: str) -> int:
        candidates = [
            chunk_id
            for chunk_id, payload in self._doc_metadata.items()
            if str(payload.get("doc_id") or "") == str(doc_id)
        ]
        for chunk_id in candidates:
            self.remove_document(chunk_id)
        return len(candidates)

    def score_tokens(
        self,
        query_tokens: list[str],
        algorithm: BM25Algorithm,
        k1: float,
        b: float,
        delta: float,
        filters: SearchFilters | None = None,
    ) -> list[tuple[str, float, dict[str, int]]]:
        if not query_tokens or self.num_documents == 0:
            return []

        query_tf = Counter(query_tokens)
        n_docs = max(self.num_documents, 1)
        avgdl = self.avg_doc_length or 1.0
        scores: dict[str, float] = {}
        matched_terms: dict[str, dict[str, int]] = defaultdict(dict)

        candidate_docs: set[str] = set()
        for term in query_tf:
            postings = self._postings.get(term)
            if postings:
                candidate_docs.update(postings.keys())
        if not candidate_docs:
            return []

        for term, qf in query_tf.items():
            postings = self._postings.get(term)
            if not postings:
                continue

            df = len(postings)
            if df == 0:
                continue
            idf = math.log(1.0 + ((n_docs - df + 0.5) / (df + 0.5)))

            for doc_id in candidate_docs:
                tf = postings.get(doc_id)
                if not tf:
                    continue

                payload = self._doc_metadata.get(doc_id, {})
                if filters is not None and not self._matches_filters(payload, filters):
                    continue

                doc_len = max(self._doc_lengths.get(doc_id, 0), 1)
                denominator = tf + (k1 * (1.0 - b + (b * doc_len / avgdl)))
                if denominator <= 0:
                    continue

                base = (tf * (k1 + 1.0)) / denominator
                if algorithm == BM25Algorithm.BM25_PLUS:
                    contribution = idf * (base + delta)
                else:
                    contribution = idf * base

                scores[doc_id] = scores.get(doc_id, 0.0) + (contribution * qf)
                matched_terms[doc_id][term] = matched_terms[doc_id].get(term, 0) + int(tf)

        ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
        return [(doc_id, score, matched_terms.get(doc_id, {})) for doc_id, score in ranked]

    def save(self, directory: Path) -> Path:
        directory.mkdir(parents=True, exist_ok=True)
        index_file = directory / _INDEX_FILE
        payload = {
            "schema_version": 1,
            "doc_lengths": self._doc_lengths,
            "doc_term_freqs": self._doc_term_freqs,
            "doc_texts": self._doc_texts,
            "doc_metadata": self._doc_metadata,
            "doc_languages": self._doc_languages,
            "last_updated_version": self.last_updated_version,
            "last_updated_at": self.last_updated_at,
        }
        index_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return index_file

    def load(self, directory: Path) -> bool:
        index_file = directory / _INDEX_FILE
        if not index_file.exists():
            return False

        try:
            payload = json.loads(index_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return False

        self._doc_lengths = {str(k): int(v) for k, v in dict(payload.get("doc_lengths", {})).items()}
        self._doc_term_freqs = {
            str(doc_id): {str(term): int(tf) for term, tf in dict(freqs).items()}
            for doc_id, freqs in dict(payload.get("doc_term_freqs", {})).items()
        }
        self._doc_texts = {str(k): str(v) for k, v in dict(payload.get("doc_texts", {})).items()}
        self._doc_metadata = {
            str(k): dict(v) if isinstance(v, dict) else {}
            for k, v in dict(payload.get("doc_metadata", {})).items()
        }
        self._doc_languages = {
            str(k): (str(v) if v is not None else None)
            for k, v in dict(payload.get("doc_languages", {})).items()
        }
        self.last_updated_version = payload.get("last_updated_version")
        self.last_updated_at = payload.get("last_updated_at")

        self._postings = defaultdict(dict)
        for doc_id, freqs in self._doc_term_freqs.items():
            for term, tf in freqs.items():
                self._postings[term][doc_id] = int(tf)
        return True

    @staticmethod
    def index_size_bytes(directory: Path) -> int:
        index_file = directory / _INDEX_FILE
        if not index_file.exists():
            return 0
        return index_file.stat().st_size

    @staticmethod
    def _matches_filters(payload: dict[str, Any], filters: SearchFilters) -> bool:
        if filters.doc_ids:
            doc_id = _payload_value(payload, ("doc_id",))
            if doc_id not in set(filters.doc_ids):
                return False

        if filters.doc_types:
            doc_type = _payload_value(payload, ("doc_type", "file_type"))
            if doc_type not in set(filters.doc_types):
                return False

        if filters.languages:
            language = _payload_value(payload, ("doc_language", "language"))
            if language not in set(filters.languages):
                return False

        if filters.categories:
            category = _payload_value(payload, ("category",))
            if category not in set(filters.categories):
                return False

        return True

    def _touch(self) -> None:
        self.last_updated_at = _utcnow_iso()


class LexicalSearchEngine:
    """Orchestrates lexical tokenization and BM25 scoring."""

    def __init__(self, index: BM25Index):
        self.index = index

    def search(
        self,
        query: str,
        config: LexicalSearchConfig,
        top_k: int | None = None,
        threshold: float | None = None,
        filters: SearchFilters | None = None,
    ) -> LexicalSearchResponse:
        started_at = time.perf_counter()

        self.index.configure_preprocessor(config)

        tok_started_at = time.perf_counter()
        query_tokens = self.index.preprocessor.tokenize(query)
        tokenization_latency_ms = int((time.perf_counter() - tok_started_at) * 1000)

        search_started_at = time.perf_counter()
        raw_results = self.index.score_tokens(
            query_tokens=query_tokens,
            algorithm=config.algorithm,
            k1=config.bm25_k1,
            b=config.bm25_b,
            delta=config.bm25_delta,
            filters=filters,
        )
        search_latency_ms = int((time.perf_counter() - search_started_at) * 1000)

        score_threshold = config.threshold if threshold is None else threshold
        filtered = [item for item in raw_results if item[1] >= score_threshold]
        effective_top_k = max(top_k or config.top_k, 1)
        final = filtered[:effective_top_k]

        results = [self._to_result(doc_id, score, matched_terms) for doc_id, score, matched_terms in final]
        total_latency_ms = int((time.perf_counter() - started_at) * 1000)

        return LexicalSearchResponse(
            query=query,
            results=results,
            total_results=len(final),
            query_tokens=query_tokens,
            tokenization_latency_ms=max(tokenization_latency_ms, 1),
            search_latency_ms=max(search_latency_ms, 1),
            total_latency_ms=max(total_latency_ms, 1),
            results_from_index=len(raw_results),
            results_after_threshold=len(filtered),
        )

    def _to_result(self, doc_id: str, score: float, matched_terms: dict[str, int]) -> BM25SearchResult:
        text = self.index._doc_texts.get(doc_id, "")
        metadata = self.index._doc_metadata.get(doc_id, {})
        raw_keywords = metadata.get("keywords", [])
        keywords = [str(item) for item in raw_keywords] if isinstance(raw_keywords, list) else []
        return BM25SearchResult(
            chunk_id=doc_id,
            score=float(score),
            text=text,
            metadata=metadata,
            matched_terms=matched_terms,
            doc_title=_payload_value(metadata, ("doc_title", "document_title", "filename")),
            doc_path=_payload_value(metadata, ("doc_path", "source")),
            doc_type=_payload_value(metadata, ("doc_type", "file_type")),
            page_number=metadata.get("page_number") or metadata.get("page"),
            chunk_index=metadata.get("chunk_index"),
            chunk_total=metadata.get("chunk_total"),
            chunk_tokens=metadata.get("chunk_tokens"),
            section_header=_payload_value(metadata, ("section_header",)),
            doc_language=_payload_value(metadata, ("doc_language", "language")),
            category=_payload_value(metadata, ("category",)),
            keywords=keywords,
            ingestion_version=_payload_value(metadata, ("ingestion_version",)),
        )
