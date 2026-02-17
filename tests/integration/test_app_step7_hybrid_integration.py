from __future__ import annotations

import time
from pathlib import Path

from fastapi.testclient import TestClient

from ragkit.config.manager import config_manager
from ragkit.desktop.api import ingestion as ingestion_api
from ragkit.desktop.api import retrieval as retrieval_api
from ragkit.desktop.ingestion_runtime import runtime
from ragkit.desktop.main import create_app
from ragkit.desktop.models import IngestionProgress


def _configure_core_settings(client: TestClient, source_dir: Path, data_root: Path) -> None:
    ingestion_payload = {
        "source": {
            "path": str(source_dir),
            "recursive": True,
            "excluded_dirs": [],
            "file_types": ["txt"],
            "exclusion_patterns": [],
            "max_file_size_mb": 50,
        },
        "parsing": {
            "engine": "auto",
            "ocr_enabled": False,
            "ocr_language": ["fra", "eng"],
            "ocr_engine": "tesseract",
            "table_extraction_strategy": "preserve",
            "image_captioning_enabled": False,
            "header_detection": True,
        },
        "preprocessing": {
            "lowercase": False,
            "remove_punctuation": False,
            "normalize_unicode": True,
            "remove_urls": False,
            "language_detection": True,
            "deduplication_strategy": "exact",
            "deduplication_threshold": 0.95,
        },
    }
    response = client.put("/api/ingestion/config", json=ingestion_payload)
    assert response.status_code == 200

    chunking_payload = {
        "strategy": "fixed_size",
        "chunk_size": 96,
        "chunk_overlap": 16,
        "min_chunk_size": 10,
        "max_chunk_size": 256,
        "preserve_sentences": True,
        "metadata_propagation": True,
        "add_chunk_index": True,
        "add_document_title": True,
        "keep_separator": False,
        "separators": ["\n\n", "\n", ". ", " "],
        "similarity_threshold": 0.75,
        "header_levels": [1, 2, 3],
    }
    response = client.put("/api/chunking/config", json=chunking_payload)
    assert response.status_code == 200

    embedding_payload = {
        "provider": "openai",
        "model": "text-embedding-3-small",
        "dimensions": 128,
        "normalize": True,
        "cache_enabled": False,
        "cache_backend": "memory",
        "timeout": 30,
        "max_retries": 3,
        "rate_limit_rpm": 3000,
        "truncation": "end",
        "query_model": {"same_as_document": True},
    }
    response = client.put("/api/embedding/config", json=embedding_payload)
    assert response.status_code == 200

    vector_payload = {
        "provider": "qdrant",
        "mode": "persistent",
        "path": str(data_root / "qdrant"),
        "collection_name": "ragkit_test",
        "distance_metric": "cosine",
        "hnsw": {
            "ef_construction": 64,
            "m": 16,
            "ef_search": 64,
        },
        "snapshot_retention": 5,
    }
    response = client.put("/api/vector-store/config", json=vector_payload)
    assert response.status_code == 200

    semantic_payload = {
        "enabled": True,
        "top_k": 8,
        "threshold": 0.0,
        "weight": 1.0,
        "mmr_enabled": False,
        "mmr_lambda": 0.5,
        "default_filters_enabled": False,
        "default_filters": {"doc_ids": [], "doc_types": [], "languages": [], "categories": []},
        "prefetch_multiplier": 2,
        "debug_default": False,
    }
    response = client.put("/api/retrieval/semantic/config", json=semantic_payload)
    assert response.status_code == 200

    lexical_payload = {
        "enabled": True,
        "algorithm": "bm25_plus",
        "top_k": 8,
        "weight": 0.5,
        "bm25_k1": 1.5,
        "bm25_b": 0.75,
        "bm25_delta": 0.7,
        "lowercase": True,
        "remove_stopwords": True,
        "stopwords_lang": "auto",
        "stemming": True,
        "stemmer_lang": "auto",
        "threshold": 0.0,
        "ngram_range": [1, 2],
        "debug_default": False,
    }
    response = client.put("/api/retrieval/lexical/config", json=lexical_payload)
    assert response.status_code == 200

    hybrid_payload = {
        "alpha": 0.55,
        "fusion_method": "rrf",
        "rrf_k": 60,
        "normalize_scores": True,
        "normalization_method": "min_max",
        "top_k": 8,
        "threshold": 0.0,
        "deduplicate": True,
        "debug_default": False,
    }
    response = client.put("/api/retrieval/hybrid/config", json=hybrid_payload)
    assert response.status_code == 200


def _wait_for_ingestion_completion(client: TestClient, timeout_s: float = 30.0) -> dict:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        status_response = client.get("/api/ingestion/status")
        assert status_response.status_code == 200
        payload = status_response.json()
        if payload.get("status") in {"completed", "failed", "cancelled"}:
            return payload
        time.sleep(0.1)
    raise AssertionError("Timed out waiting for ingestion completion.")


def _setup_isolated_storage(tmp_path: Path, monkeypatch) -> tuple[Path, Path, Path]:
    ragkit_root = tmp_path / ".ragkit"
    config_dir = ragkit_root / "config"
    data_dir = ragkit_root / "data"
    config_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    config_manager.config_dir = config_dir
    config_manager.config_file = config_dir / "settings.json"
    config_manager._ensure_config_dir()

    import ragkit.desktop.settings_store as settings_store

    monkeypatch.setattr(settings_store, "get_data_root", lambda: ragkit_root)
    monkeypatch.setattr(settings_store, "get_config_dir", lambda: config_dir)
    monkeypatch.setattr(settings_store, "get_data_dir", lambda: data_dir)
    monkeypatch.setattr(settings_store, "get_settings_path", lambda: config_manager.config_file)
    monkeypatch.setattr(settings_store, "get_documents_path", lambda: data_dir / "documents.json")

    ingestion_api._CURRENT_CONFIG = None
    ingestion_api._DOCUMENTS = []
    ingestion_api._DOCUMENTS_LOADED = False

    runtime._registry = data_dir / "ingestion_registry.db"
    runtime._ensure_db()
    runtime.progress = IngestionProgress()
    runtime.logs = []
    runtime._task = None
    runtime._auto_task = None
    runtime._cancelled = False
    runtime._pending_auto_trigger_at = None
    runtime._last_auto_signature = None
    runtime._pause.set()
    monkeypatch.setattr(runtime, "ensure_background_tasks", lambda: None)

    retrieval_api._LEXICAL_INDEX = None
    retrieval_api._LEXICAL_INDEX_MTIME = None

    return ragkit_root, config_dir, data_dir


def test_step7_unified_search_and_hybrid_config(tmp_path: Path, monkeypatch) -> None:
    _, _, data_dir = _setup_isolated_storage(tmp_path, monkeypatch)

    source_dir = tmp_path / "docs"
    source_dir.mkdir(parents=True, exist_ok=True)
    (source_dir / "legal.txt").write_text(
        "Article 12 - Resiliation du contrat. Les conditions de resiliation anticipee "
        "sont definies par la clause 12 du present contrat.",
        encoding="utf-8",
    )
    (source_dir / "it.txt").write_text(
        "Backup retention policy: keep snapshots for 30 days and verify backup integrity weekly.",
        encoding="utf-8",
    )

    app = create_app()
    with TestClient(app) as client:
        _configure_core_settings(client, source_dir=source_dir, data_root=data_dir)

        general_response = client.get("/api/ingestion/settings/general")
        assert general_response.status_code == 200
        assert general_response.json()["search_type"] == "hybrid"

        hybrid_get = client.get("/api/retrieval/hybrid/config")
        assert hybrid_get.status_code == 200
        assert hybrid_get.json()["fusion_method"] in {"rrf", "weighted_sum"}

        hybrid_put = client.put(
            "/api/retrieval/hybrid/config",
            json={
                "alpha": 0.3,
                "fusion_method": "weighted_sum",
                "rrf_k": 40,
                "normalize_scores": True,
                "normalization_method": "min_max",
                "top_k": 6,
                "threshold": 0.0,
                "deduplicate": True,
                "debug_default": True,
            },
        )
        assert hybrid_put.status_code == 200
        assert hybrid_put.json()["alpha"] == 0.3
        assert hybrid_put.json()["fusion_method"] == "weighted_sum"

        hybrid_reset = client.post("/api/retrieval/hybrid/config/reset")
        assert hybrid_reset.status_code == 200
        assert "alpha" in hybrid_reset.json()

        start_response = client.post("/api/ingestion/start", json={"incremental": False})
        assert start_response.status_code == 200
        status = _wait_for_ingestion_completion(client)
        assert status["status"] == "completed"

        semantic_search = client.post(
            "/api/search",
            json={
                "query": "article 12 resiliation",
                "search_type": "semantic",
                "page": 1,
                "page_size": 5,
                "include_debug": True,
            },
        )
        assert semantic_search.status_code == 200
        semantic_payload = semantic_search.json()
        assert semantic_payload["search_type"] == "semantic"
        assert semantic_payload["total_results"] >= 1
        assert semantic_payload["debug"] is not None

        lexical_search = client.post(
            "/api/search",
            json={
                "query": "article 12 resiliation",
                "search_type": "lexical",
                "page": 1,
                "page_size": 5,
                "include_debug": True,
            },
        )
        assert lexical_search.status_code == 200
        lexical_payload = lexical_search.json()
        assert lexical_payload["search_type"] == "lexical"
        assert lexical_payload["total_results"] >= 1
        assert lexical_payload["results"][0]["matched_terms"] is not None
        assert lexical_payload["debug"] is not None

        hybrid_search = client.post(
            "/api/search",
            json={
                "query": "article 12 resiliation",
                "search_type": "hybrid",
                "alpha": 0.5,
                "page": 1,
                "page_size": 5,
                "include_debug": True,
            },
        )
        assert hybrid_search.status_code == 200
        hybrid_payload = hybrid_search.json()
        assert hybrid_payload["search_type"] == "hybrid"
        assert hybrid_payload["total_results"] >= 1
        assert hybrid_payload["debug"] is not None
        assert "fusion_method" in hybrid_payload["debug"]
        first_result = hybrid_payload["results"][0]
        assert "semantic_rank" in first_result
        assert "lexical_rank" in first_result

        set_general = client.put(
            "/api/ingestion/settings/general",
            json={
                "ingestion_mode": "manual",
                "auto_ingestion_delay": 30,
                "search_type": "lexical",
            },
        )
        assert set_general.status_code == 200

        default_dispatch = client.post(
            "/api/search",
            json={
                "query": "article 12 resiliation",
                "page": 1,
                "page_size": 5,
            },
        )
        assert default_dispatch.status_code == 200
        assert default_dispatch.json()["search_type"] == "lexical"
