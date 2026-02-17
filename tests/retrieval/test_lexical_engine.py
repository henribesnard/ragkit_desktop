from __future__ import annotations

from pathlib import Path

from ragkit.config.retrieval_schema import BM25Algorithm, LexicalSearchConfig, SearchFilters
from ragkit.retrieval.lexical_engine import BM25Index, LexicalSearchEngine, TextPreprocessor


def make_config(**overrides) -> LexicalSearchConfig:
    base = {
        "algorithm": "bm25",
        "top_k": 10,
        "bm25_k1": 1.5,
        "bm25_b": 0.75,
        "bm25_delta": 0.5,
        "lowercase": True,
        "remove_stopwords": False,
        "stopwords_lang": "auto",
        "stemming": False,
        "stemmer_lang": "auto",
        "threshold": 0.0,
        "ngram_range": (1, 1),
    }
    base.update(overrides)
    return LexicalSearchConfig.model_validate(base)


def test_text_preprocessor_stopwords_auto_language(monkeypatch) -> None:
    monkeypatch.setattr("ragkit.retrieval.lexical_engine._ensure_nltk_resources", lambda: None)

    cfg = make_config(remove_stopwords=True, stopwords_lang="auto")
    preprocessor = TextPreprocessor(cfg)

    fr_tokens = preprocessor.tokenize("Le contrat de resiliation et la clause", language="fr")
    en_tokens = preprocessor.tokenize("The backup policy and retention period", language="en")

    assert "le" not in fr_tokens
    assert "de" not in fr_tokens
    assert "et" not in fr_tokens
    assert "contrat" in fr_tokens
    assert "resiliation" in fr_tokens

    assert "the" not in en_tokens
    assert "and" not in en_tokens
    assert "backup" in en_tokens
    assert "retention" in en_tokens


def test_text_preprocessor_stemming_and_ngrams() -> None:
    stemming_cfg = make_config(stemming=True, stemmer_lang="en")
    stemming_tokens = TextPreprocessor(stemming_cfg).tokenize("running conditions", language="en")

    assert "run" in stemming_tokens
    assert "condit" in stemming_tokens

    ngram_cfg = make_config(ngram_range=(1, 2))
    ngram_tokens = TextPreprocessor(ngram_cfg).tokenize("alpha beta gamma")
    assert ngram_tokens == ["alpha", "beta", "gamma", "alpha beta", "beta gamma"]


def test_bm25_index_ranking_and_filters() -> None:
    cfg = make_config()
    index = BM25Index(cfg)

    index.add_document(
        doc_id="chunk-1",
        text="alpha alpha beta",
        metadata={"doc_id": "doc-a", "doc_type": "pdf", "category": "legal"},
    )
    index.add_document(
        doc_id="chunk-2",
        text="alpha gamma",
        metadata={"doc_id": "doc-b", "doc_type": "txt", "category": "tech"},
    )

    query_tokens = index.preprocessor.tokenize("alpha")
    ranked = index.score_tokens(
        query_tokens=query_tokens,
        algorithm=BM25Algorithm.BM25,
        k1=cfg.bm25_k1,
        b=cfg.bm25_b,
        delta=cfg.bm25_delta,
    )
    assert ranked
    assert ranked[0][0] == "chunk-1"
    assert ranked[0][2]["alpha"] == 2

    filtered = index.score_tokens(
        query_tokens=query_tokens,
        algorithm=BM25Algorithm.BM25,
        k1=cfg.bm25_k1,
        b=cfg.bm25_b,
        delta=cfg.bm25_delta,
        filters=SearchFilters(categories=["tech"]),
    )
    assert [doc_id for doc_id, _, _ in filtered] == ["chunk-2"]


def test_bm25_plus_bonus_scores_higher_than_bm25() -> None:
    cfg_bm25 = make_config(algorithm="bm25")
    cfg_bm25_plus = make_config(algorithm="bm25_plus", bm25_delta=0.8)
    index = BM25Index(cfg_bm25)

    index.add_document(doc_id="d1", text="error code 500", metadata={"doc_id": "doc-1"})
    index.add_document(doc_id="d2", text="status code 200", metadata={"doc_id": "doc-2"})
    query_tokens = index.preprocessor.tokenize("code")

    bm25_scores = index.score_tokens(
        query_tokens=query_tokens,
        algorithm=BM25Algorithm.BM25,
        k1=cfg_bm25.bm25_k1,
        b=cfg_bm25.bm25_b,
        delta=cfg_bm25.bm25_delta,
    )
    bm25_plus_scores = index.score_tokens(
        query_tokens=query_tokens,
        algorithm=BM25Algorithm.BM25_PLUS,
        k1=cfg_bm25_plus.bm25_k1,
        b=cfg_bm25_plus.bm25_b,
        delta=cfg_bm25_plus.bm25_delta,
    )

    assert bm25_scores
    assert bm25_plus_scores
    assert bm25_plus_scores[0][1] > bm25_scores[0][1]


def test_bm25_index_persistence_round_trip(tmp_path: Path) -> None:
    cfg = make_config()
    index = BM25Index(cfg)
    index.add_document("chunk-a", "alpha beta", {"doc_id": "doc-a", "ingestion_version": "v1"})
    index.add_document("chunk-b", "beta gamma", {"doc_id": "doc-b"})

    saved_file = index.save(tmp_path)
    assert saved_file.exists()
    assert BM25Index.index_size_bytes(tmp_path) > 0

    loaded = BM25Index(cfg)
    assert loaded.load(tmp_path) is True
    assert loaded.num_documents == 2
    assert loaded.num_unique_terms == 3
    assert loaded.last_updated_version == "v1"

    ranked = loaded.score_tokens(
        query_tokens=["beta"],
        algorithm=BM25Algorithm.BM25,
        k1=cfg.bm25_k1,
        b=cfg.bm25_b,
        delta=cfg.bm25_delta,
    )
    assert len(ranked) == 2


def test_remove_document_chunks() -> None:
    cfg = make_config()
    index = BM25Index(cfg)
    index.add_document("chunk-1", "alpha", {"doc_id": "doc-1"})
    index.add_document("chunk-2", "beta", {"doc_id": "doc-1"})
    index.add_document("chunk-3", "gamma", {"doc_id": "doc-2"})

    removed = index.remove_document_chunks("doc-1")
    assert removed == 2
    assert index.num_documents == 1


def test_lexical_search_engine_applies_threshold_top_k_and_filters() -> None:
    cfg = make_config(top_k=5, threshold=0.0)
    index = BM25Index(cfg)
    index.add_document(
        "chunk-1",
        "article 12 termination terms",
        {
            "doc_id": "doc-legal",
            "doc_type": "pdf",
            "category": "legal",
            "doc_title": "contract.pdf",
            "chunk_index": 0,
            "chunk_total": 2,
            "chunk_tokens": 4,
            "ingestion_version": "v3",
        },
    )
    index.add_document(
        "chunk-2",
        "backup retention policy",
        {"doc_id": "doc-it", "doc_type": "txt", "category": "it"},
    )
    index.add_document(
        "chunk-3",
        "article 12 cancellation process",
        {"doc_id": "doc-legal-2", "doc_type": "pdf", "category": "legal"},
    )

    engine = LexicalSearchEngine(index)
    response = engine.search(
        query="article 12",
        config=cfg,
        top_k=1,
        threshold=0.0,
        filters=SearchFilters(categories=["legal"]),
    )

    assert response.total_results == 1
    assert len(response.results) == 1
    first = response.results[0]
    assert first.doc_type == "pdf"
    assert first.category == "legal"
    assert "article" in response.query_tokens
    assert response.results_from_index >= response.results_after_threshold >= response.total_results
    assert response.tokenization_latency_ms >= 1
    assert response.search_latency_ms >= 1
    assert response.total_latency_ms >= 1
