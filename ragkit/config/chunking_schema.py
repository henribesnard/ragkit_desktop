"""Pydantic schemas for chunking configuration and preview payloads."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class ChunkingStrategy(str, Enum):
    FIXED_SIZE = "fixed_size"
    SENTENCE_BASED = "sentence_based"
    PARAGRAPH_BASED = "paragraph_based"
    SEMANTIC = "semantic"
    RECURSIVE = "recursive"
    MARKDOWN_HEADER = "markdown_header"


class ChunkingConfig(BaseModel):
    strategy: ChunkingStrategy = ChunkingStrategy.RECURSIVE
    chunk_size: int = Field(default=512, ge=64, le=4096)
    chunk_overlap: int = Field(default=100, ge=0)
    min_chunk_size: int = Field(default=50, ge=10)
    max_chunk_size: int = Field(default=2000, le=8192)
    preserve_sentences: bool = True
    metadata_propagation: bool = True
    add_chunk_index: bool = True
    add_document_title: bool = True
    keep_separator: bool = False
    separators: list[str] = Field(default_factory=lambda: ["\n\n", "\n", ". ", " "])
    similarity_threshold: float = Field(default=0.75, ge=0.0, le=1.0)
    header_levels: list[int] = Field(default_factory=lambda: [1, 2, 3])

    @model_validator(mode="after")
    def validate_size_constraints(self) -> "ChunkingConfig":
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be less than chunk_size")
        if self.min_chunk_size > self.chunk_size:
            raise ValueError("min_chunk_size must be ≤ chunk_size")
        if self.max_chunk_size < self.chunk_size:
            raise ValueError("max_chunk_size must be ≥ chunk_size")
        return self

    @field_validator("header_levels")
    @classmethod
    def validate_header_levels(cls, values: list[int]) -> list[int]:
        if not values:
            raise ValueError("At least one header level is required")
        for level in values:
            if level < 1 or level > 6:
                raise ValueError(f"Header level {level} out of range (1-6)")
        return sorted(set(values))

    @field_validator("separators")
    @classmethod
    def validate_separators(cls, values: list[str]) -> list[str]:
        cleaned = [value for value in values if value is not None]
        if not cleaned:
            raise ValueError("At least one separator is required")
        return cleaned


class Chunk(BaseModel):
    content: str
    tokens: int
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChunkPreview(BaseModel):
    index: int
    content: str
    content_truncated: str
    size_tokens: int
    page_start: int | None = None
    page_end: int | None = None
    overlap_before: str | None = None
    overlap_before_tokens: int = 0
    overlap_after: str | None = None
    overlap_after_tokens: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)


class SizeBucket(BaseModel):
    range_start: int
    range_end: int
    count: int


class ChunkingStats(BaseModel):
    total_chunks: int
    avg_size_tokens: float
    min_size_tokens: int
    max_size_tokens: int
    median_size_tokens: float
    total_overlap_tokens: int
    size_distribution: list[SizeBucket]


class ChunkingPreviewResult(BaseModel):
    document_id: str
    document_title: str | None = None
    config_used: ChunkingConfig
    stats: ChunkingStats
    chunks: list[ChunkPreview]
    processing_time_ms: int
    warnings: list[str] = Field(default_factory=list)


class ChunkingValidationResult(BaseModel):
    valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
