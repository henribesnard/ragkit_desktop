"""Pydantic schemas for semantic retrieval settings and responses."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SemanticSearchConfig(BaseModel):
    enabled: bool = True
    top_k: int = Field(default=10, ge=1, le=100)
    similarity_threshold: float = Field(default=0.0, ge=0.0, le=1.0)
    weight: float = Field(default=1.0, ge=0.0, le=1.0)


class SemanticSearchResult(BaseModel):
    id: str
    score: float
    chunk_text: str
    source_document: str
    source_page: int | None = None
    metadata: dict = Field(default_factory=dict)


class SemanticSearchResponse(BaseModel):
    query: str
    total: int
    results: list[SemanticSearchResult] = Field(default_factory=list)
