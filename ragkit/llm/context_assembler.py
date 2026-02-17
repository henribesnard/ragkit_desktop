"""Assemble retrieved chunks into bounded LLM context."""

from __future__ import annotations

from dataclasses import dataclass
from html import escape
from typing import Any

from ragkit.config.llm_schema import LLMConfig

try:
    import tiktoken  # type: ignore
except Exception:  # pragma: no cover - optional at runtime
    tiktoken = None


@dataclass
class ContextChunk:
    source_id: int
    chunk_id: str
    text: str
    doc_title: str
    doc_path: str | None
    page_number: int | None
    score: float
    tokens: int


@dataclass
class AssembledContext:
    formatted_text: str
    chunks_used: list[ContextChunk]
    total_tokens: int
    chunks_available: int
    chunks_included: int
    truncated: bool


class ContextAssembler:
    """Select and format chunks for prompt injection."""

    def __init__(self, config: LLMConfig):
        self.config = config
        self._encoder = self._build_encoder()

    def _build_encoder(self):
        if tiktoken is None:
            return None
        try:
            return tiktoken.encoding_for_model(self.config.model)
        except Exception:
            return tiktoken.get_encoding("cl100k_base")

    def _count_tokens(self, text: str) -> int:
        if self._encoder is not None:
            return max(1, len(self._encoder.encode(text)))
        return max(1, len(text.split()))

    def _truncate_to_tokens(self, text: str, max_tokens: int) -> str:
        if max_tokens <= 0:
            return ""
        if self._encoder is None:
            words = text.split()
            return " ".join(words[:max_tokens])
        encoded = self._encoder.encode(text)[:max_tokens]
        return self._encoder.decode(encoded)

    def assemble(self, results: list[Any]) -> AssembledContext:
        chunks: list[ContextChunk] = []
        total_tokens = 0
        truncated = False

        for index, result in enumerate(results):
            if len(chunks) >= self.config.context_max_chunks:
                break

            raw_text = str(getattr(result, "text", "") or "")
            if not raw_text.strip():
                continue
            text = raw_text.strip()
            tokens = self._count_tokens(text)

            if total_tokens + tokens > self.config.context_max_tokens:
                remaining = self.config.context_max_tokens - total_tokens
                if remaining < 50:
                    break
                text = self._truncate_to_tokens(text, remaining)
                tokens = self._count_tokens(text)
                truncated = True

            score = float(getattr(result, "rerank_score", None) or getattr(result, "score", 0.0))
            title = str(getattr(result, "doc_title", None) or "Document")

            chunks.append(
                ContextChunk(
                    source_id=index + 1,
                    chunk_id=str(getattr(result, "chunk_id", "")),
                    text=text,
                    doc_title=title,
                    doc_path=getattr(result, "doc_path", None),
                    page_number=getattr(result, "page_number", None),
                    score=score,
                    tokens=tokens,
                )
            )
            total_tokens += tokens

        return AssembledContext(
            formatted_text=self._format_context(chunks),
            chunks_used=chunks,
            total_tokens=total_tokens,
            chunks_available=len(results),
            chunks_included=len(chunks),
            truncated=truncated,
        )

    def _format_context(self, chunks: list[ContextChunk]) -> str:
        lines = ["<context>"]
        for chunk in chunks:
            page_attr = f' page="{int(chunk.page_number)}"' if chunk.page_number is not None else ""
            header = (
                f'<source id="{chunk.source_id}" '
                f'title="{escape(chunk.doc_title)}"{page_attr} '
                f'score="{chunk.score:.4f}">'
            )
            lines.append(header)
            lines.append(chunk.text)
            lines.append("</source>")
        lines.append("</context>")
        return "\n".join(lines)
