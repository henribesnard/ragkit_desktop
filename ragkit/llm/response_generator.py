"""Orchestrate context assembly and LLM generation."""

from __future__ import annotations

import dataclasses
import time
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

from ragkit.config.llm_schema import CitationFormat, LLMConfig
from ragkit.llm.base import BaseLLMProvider, LLMMessage
from ragkit.llm.context_assembler import AssembledContext, ContextAssembler


@dataclass
class GenerationDebugInfo:
    model: str
    temperature: float
    retrieval_latency_ms: int
    search_type: str
    chunks_retrieved: int
    reranking_applied: bool
    context_chunks: int
    context_tokens: int
    context_truncated: bool
    prompt_tokens: int
    completion_tokens: int
    time_to_first_token_ms: int
    total_latency_ms: int
    estimated_cost_usd: float | None
    sources_detail: list[dict[str, Any]] = field(default_factory=list)
    prompt_preview: str | None = None


@dataclass
class RAGResponse:
    content: str
    sources: list[dict[str, Any]]
    debug: GenerationDebugInfo | None = None


class ResponseGenerator:
    """Generate RAG responses from retrieval candidates."""

    def __init__(self, config: LLMConfig, llm_provider: BaseLLMProvider):
        self.config = config
        self.llm = llm_provider
        self.assembler = ContextAssembler(config)

    def _build_system_prompt(self) -> str:
        if self.config.citation_format == CitationFormat.INLINE:
            citation_instruction = "[Source: titre_document, p.N]"
        else:
            citation_instruction = "des notes de bas de page numerotees 1, 2, 3"
        uncertainty = self.config.uncertainty_phrase if self.config.admit_uncertainty else ""
        return (
            self.config.system_prompt.replace("{citation_format_instruction}", citation_instruction).replace(
                "{uncertainty_phrase}",
                uncertainty,
            )
        )

    def _build_messages(
        self,
        query: str,
        context: AssembledContext,
        history_messages: list[dict[str, str]] | None = None,
    ) -> list[LLMMessage]:
        language_instruction = ""
        if self.config.response_language == "fr":
            language_instruction = "\nReponds en francais."
        elif self.config.response_language == "en":
            language_instruction = "\nAnswer in English."

        user_content = f"{context.formatted_text}\n\nQuestion : {query}{language_instruction}"
        messages: list[LLMMessage] = [LLMMessage(role="system", content=self._build_system_prompt())]
        for item in history_messages or []:
            role = str(item.get("role") or "").strip().lower()
            content = str(item.get("content") or "")
            if role not in {"user", "assistant", "system"}:
                continue
            if not content:
                continue
            messages.append(LLMMessage(role=role, content=content))
        messages.append(LLMMessage(role="user", content=user_content))
        return messages

    def _build_sources(self, context: AssembledContext) -> list[dict[str, Any]]:
        sources: list[dict[str, Any]] = []
        for chunk in context.chunks_used:
            preview = chunk.text[:200] + ("..." if len(chunk.text) > 200 else "")
            sources.append(
                {
                    "id": chunk.source_id,
                    "chunk_id": chunk.chunk_id,
                    "title": chunk.doc_title,
                    "path": chunk.doc_path,
                    "page": chunk.page_number,
                    "score": chunk.score,
                    "text_preview": preview,
                }
            )
        return sources

    def _estimate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float | None:
        costs = {
            "gpt-4o-mini": (0.15, 0.60),
            "gpt-4o": (2.50, 10.00),
            "claude-3-5-sonnet-20241022": (3.00, 15.00),
            "claude-3-haiku-20240307": (0.25, 1.25),
            "mistral-large-latest": (2.00, 6.00),
            "mistral-small-latest": (0.20, 0.60),
        }
        rate = costs.get(model)
        if rate is None:
            return None
        input_cost = (prompt_tokens / 1_000_000) * rate[0]
        output_cost = (completion_tokens / 1_000_000) * rate[1]
        return round(input_cost + output_cost, 6)

    async def generate(
        self,
        query: str,
        retrieval_results: list[Any],
        *,
        history_messages: list[dict[str, str]] | None = None,
        retrieval_latency_ms: int = 0,
        search_type: str = "hybrid",
        reranking_applied: bool = False,
        include_debug: bool = False,
    ) -> RAGResponse:
        started = time.perf_counter()
        context = self.assembler.assemble(retrieval_results)
        messages = self._build_messages(query, context, history_messages=history_messages)
        response = await self.llm.generate(
            messages=messages,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            top_p=self.config.top_p,
        )
        total_latency_ms = max(1, int((time.perf_counter() - started) * 1000))
        sources = self._build_sources(context)

        debug = None
        if include_debug:
            debug = GenerationDebugInfo(
                model=self.config.model,
                temperature=self.config.temperature,
                retrieval_latency_ms=retrieval_latency_ms,
                search_type=search_type,
                chunks_retrieved=len(retrieval_results),
                reranking_applied=reranking_applied,
                context_chunks=context.chunks_included,
                context_tokens=context.total_tokens,
                context_truncated=context.truncated,
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                time_to_first_token_ms=response.latency_ms,
                total_latency_ms=total_latency_ms,
                estimated_cost_usd=self._estimate_cost(
                    self.config.model,
                    response.usage.prompt_tokens,
                    response.usage.completion_tokens,
                ),
                sources_detail=[
                    {"id": item["id"], "title": item["title"], "page": item["page"], "score": item["score"]}
                    for item in sources
                ],
                prompt_preview=(messages[0].content + "\n\n" + messages[1].content)[:4000],
            )

        return RAGResponse(content=response.content, sources=sources, debug=debug)

    async def stream_events(
        self,
        query: str,
        retrieval_results: list[Any],
        *,
        history_messages: list[dict[str, str]] | None = None,
        retrieval_latency_ms: int = 0,
        search_type: str = "hybrid",
        reranking_applied: bool = False,
        include_debug: bool = False,
    ) -> AsyncIterator[dict[str, Any]]:
        started = time.perf_counter()
        context = self.assembler.assemble(retrieval_results)
        messages = self._build_messages(query, context, history_messages=history_messages)
        sources = self._build_sources(context)

        answer_parts: list[str] = []
        prompt_tokens = 0
        completion_tokens = 0
        first_token_latency_ms = 0

        async for chunk in self.llm.stream(
            messages=messages,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
            top_p=self.config.top_p,
        ):
            if chunk.is_final:
                if chunk.usage is not None:
                    prompt_tokens = chunk.usage.prompt_tokens
                    completion_tokens = chunk.usage.completion_tokens
                if chunk.latency_ms is not None:
                    first_token_latency_ms = chunk.latency_ms
                continue

            if chunk.content:
                answer_parts.append(chunk.content)
                if chunk.latency_ms is not None and first_token_latency_ms <= 0:
                    first_token_latency_ms = chunk.latency_ms
                yield {"type": "token", "content": chunk.content}

        answer = "".join(answer_parts)
        total_latency_ms = max(1, int((time.perf_counter() - started) * 1000))
        debug_payload = None
        if include_debug:
            debug_payload = dataclasses.asdict(
                GenerationDebugInfo(
                    model=self.config.model,
                    temperature=self.config.temperature,
                    retrieval_latency_ms=retrieval_latency_ms,
                    search_type=search_type,
                    chunks_retrieved=len(retrieval_results),
                    reranking_applied=reranking_applied,
                    context_chunks=context.chunks_included,
                    context_tokens=context.total_tokens,
                    context_truncated=context.truncated,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    time_to_first_token_ms=max(first_token_latency_ms, 1),
                    total_latency_ms=total_latency_ms,
                    estimated_cost_usd=self._estimate_cost(
                        self.config.model,
                        prompt_tokens,
                        completion_tokens,
                    ),
                    sources_detail=[
                        {"id": item["id"], "title": item["title"], "page": item["page"], "score": item["score"]}
                        for item in sources
                    ],
                    prompt_preview=(messages[0].content + "\n\n" + messages[1].content)[:4000],
                )
            )
        yield {
            "type": "done",
            "answer": answer,
            "sources": sources,
            "debug": debug_payload,
        }
