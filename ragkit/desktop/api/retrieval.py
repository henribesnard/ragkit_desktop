from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ragkit.config.embedding_schema import EmbeddingConfig
from ragkit.config.retrieval_schema import SemanticSearchConfig, SemanticSearchResponse, SemanticSearchResult
from ragkit.config.vector_store_schema import VectorStoreConfig
from ragkit.desktop.settings_store import load_settings, save_settings
from ragkit.embedding.engine import EmbeddingEngine
from ragkit.storage.base import create_vector_store

router = APIRouter(prefix="/api/retrieval", tags=["retrieval"])


class SemanticSearchRequest(BaseModel):
    query: str = Field(min_length=1)


def _get_semantic_config() -> SemanticSearchConfig:
    settings = load_settings()
    retrieval = settings.retrieval or {}
    semantic_payload = retrieval.get("semantic") if isinstance(retrieval, dict) else None
    return SemanticSearchConfig.model_validate(semantic_payload or {})


@router.get("/semantic/config")
async def get_semantic_config():
    return _get_semantic_config().model_dump(mode="json")


@router.put("/semantic/config")
async def update_semantic_config(config: SemanticSearchConfig):
    settings = load_settings()
    retrieval = settings.retrieval or {}
    retrieval["semantic"] = config.model_dump(mode="json")
    settings.retrieval = retrieval
    save_settings(settings)
    return config.model_dump(mode="json")


@router.post("/semantic/search", response_model=SemanticSearchResponse)
async def semantic_search(payload: SemanticSearchRequest):
    config = _get_semantic_config()
    if not config.enabled:
        raise HTTPException(status_code=400, detail="Semantic search is disabled in settings.")

    settings = load_settings()
    embed_cfg = EmbeddingConfig.model_validate(settings.embedding or {})
    vec_cfg = VectorStoreConfig.model_validate(settings.vector_store or {})

    embedder = EmbeddingEngine(embed_cfg)
    query_vector = embedder.embed_text(payload.query).vector

    store = create_vector_store(vec_cfg)
    await store.initialize(embed_cfg.dimensions or len(query_vector))
    raw_results = await store.search(query_vector, config.top_k)

    results: list[SemanticSearchResult] = []
    for point, score in raw_results:
        normalized_score = max(0.0, (score + 1) / 2)
        if normalized_score < config.similarity_threshold:
            continue
        payload_data = point.payload or {}
        results.append(
            SemanticSearchResult(
                id=point.id,
                score=round(normalized_score, 4),
                chunk_text=str(payload_data.get("chunk_text") or ""),
                source_document=str(payload_data.get("doc_path") or "inconnu"),
                source_page=payload_data.get("page"),
                metadata={k: v for k, v in payload_data.items() if k not in {"chunk_text", "doc_path"}},
            )
        )

    return SemanticSearchResponse(query=payload.query, total=len(results), results=results)
