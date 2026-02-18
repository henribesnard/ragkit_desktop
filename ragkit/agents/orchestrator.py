"""Main orchestrator that routes chat requests through analyzer, rewrite and RAG."""

from __future__ import annotations

import dataclasses
import time
from dataclasses import dataclass
from typing import Any, AsyncIterator, Awaitable, Callable

from ragkit.agents.memory import ConversationMemory
from ragkit.agents.query_analyzer import AnalysisResult, QueryAnalyzer
from ragkit.agents.query_rewriter import QueryRewriter, RewriteResult
from ragkit.config.agents_schema import AgentsConfig, Intent, OrchestratorDebugInfo
from ragkit.llm.base import BaseLLMProvider, LLMMessage
from ragkit.llm.response_generator import ResponseGenerator


@dataclass
class OrchestratedResult:
    query: str
    answer: str
    sources: list[dict[str, Any]]
    intent: str
    needs_rag: bool
    rewritten_query: str | None
    debug: OrchestratorDebugInfo | None = None


class Orchestrator:
    """Coordinate analyzer, rewriter, retrieval and response generation."""

    def __init__(
        self,
        *,
        config: AgentsConfig,
        analyzer: QueryAnalyzer,
        rewriter: QueryRewriter,
        memory: ConversationMemory,
        response_generator: ResponseGenerator,
        llm: BaseLLMProvider,
        retrieve_handler: Callable[[str], Awaitable[Any]],
    ):
        self.config = config
        self.analyzer = analyzer
        self.rewriter = rewriter
        self.memory = memory
        self.response_generator = response_generator
        self.llm = llm
        self.retrieve_handler = retrieve_handler

    async def process(self, query: str, *, include_debug: bool = False) -> OrchestratedResult:
        started = time.perf_counter()
        history = self.memory.get_history_for_llm()
        analysis = await self.analyzer.analyze(query, history)

        rewrite = RewriteResult(original_query=query, rewritten_queries=[query], latency_ms=0)
        retrieval_debug: dict[str, Any] | None = None
        generation_debug: dict[str, Any] | None = None
        rewritten_query: str | None = None
        sources: list[dict[str, Any]] = []
        answer = ""

        if analysis.needs_rag:
            (
                answer,
                sources,
                generation_debug,
                retrieval_debug,
                rewrite,
                rewritten_query,
            ) = await self._process_rag(query, history, include_debug=include_debug)
        else:
            answer, generation_debug = await self._process_non_rag(query, history, analysis, include_debug=include_debug)

        self._append_memory(query=query, answer=answer, intent=analysis.intent, sources=sources)
        await self.memory.update_summary_if_needed()

        debug = None
        if include_debug:
            total_latency_ms = max(1, int((time.perf_counter() - started) * 1000))
            debug = self._build_debug(
                analysis=analysis,
                rewrite=rewrite,
                history=history,
                retrieval_debug=retrieval_debug,
                generation_debug=generation_debug,
                total_latency_ms=total_latency_ms,
            )

        return OrchestratedResult(
            query=query,
            answer=answer,
            sources=sources,
            intent=analysis.intent.value,
            needs_rag=analysis.needs_rag,
            rewritten_query=rewritten_query,
            debug=debug,
        )

    async def stream(self, query: str, *, include_debug: bool = False) -> AsyncIterator[dict[str, Any]]:
        started = time.perf_counter()
        history = self.memory.get_history_for_llm()
        analysis = await self.analyzer.analyze(query, history)
        rewrite = RewriteResult(original_query=query, rewritten_queries=[query], latency_ms=0)
        retrieval_debug: dict[str, Any] | None = None
        generation_debug: dict[str, Any] | None = None
        sources: list[dict[str, Any]] = []
        answer_parts: list[str] = []
        rewritten_query: str | None = None

        if analysis.needs_rag:
            (
                retrieval_results,
                retrieval_latency_ms,
                resolved_search_type,
                reranking_applied,
                retrieval_debug,
                rewrite,
                rewritten_query,
            ) = await self._collect_rag_retrieval(query, history, include_debug=include_debug)

            async for event in self.response_generator.stream_events(
                query=query,
                retrieval_results=retrieval_results,
                history_messages=history,
                retrieval_latency_ms=retrieval_latency_ms,
                search_type=resolved_search_type,
                reranking_applied=reranking_applied,
                include_debug=include_debug,
            ):
                event_type = str(event.get("type") or "")
                if event_type == "token":
                    token = str(event.get("content") or "")
                    if token:
                        answer_parts.append(token)
                        yield {"type": "token", "content": token}
                    continue
                if event_type == "done":
                    sources = list(event.get("sources") or [])
                    generation_debug = event.get("debug")
                    done_answer = str(event.get("answer") or "".join(answer_parts))
                    answer_parts = [done_answer]
        else:
            messages = self._build_non_rag_messages(query, history, analysis.intent)
            prompt_tokens = 0
            completion_tokens = 0
            first_token_latency_ms = 0
            async for chunk in self.llm.stream(
                messages=messages,
                temperature=0.5,
                max_tokens=500,
                top_p=0.95,
            ):
                if chunk.is_final:
                    if chunk.usage is not None:
                        prompt_tokens = int(chunk.usage.prompt_tokens)
                        completion_tokens = int(chunk.usage.completion_tokens)
                    if chunk.latency_ms is not None:
                        first_token_latency_ms = int(chunk.latency_ms)
                    continue
                token = str(chunk.content or "")
                if token:
                    answer_parts.append(token)
                    yield {"type": "token", "content": token}

            if include_debug:
                generation_debug = {
                    "model": self.response_generator.config.model,
                    "temperature": 0.5,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "time_to_first_token_ms": max(first_token_latency_ms, 1),
                    "total_latency_ms": max(1, int((time.perf_counter() - started) * 1000)),
                    "estimated_cost_usd": None,
                }

        answer = "".join(answer_parts)
        self._append_memory(query=query, answer=answer, intent=analysis.intent, sources=sources)
        await self.memory.update_summary_if_needed()

        debug_payload = None
        if include_debug:
            total_latency_ms = max(1, int((time.perf_counter() - started) * 1000))
            debug_payload = self._build_debug(
                analysis=analysis,
                rewrite=rewrite,
                history=history,
                retrieval_debug=retrieval_debug,
                generation_debug=generation_debug,
                total_latency_ms=total_latency_ms,
            ).model_dump(mode="json")

        yield {
            "type": "done",
            "answer": answer,
            "sources": sources,
            "intent": analysis.intent.value,
            "needs_rag": analysis.needs_rag,
            "rewritten_query": rewritten_query,
            "debug": debug_payload,
        }

    def new_conversation(self) -> None:
        self.memory.clear()

    async def _process_rag(
        self,
        query: str,
        history: list[dict[str, str]],
        *,
        include_debug: bool,
    ) -> tuple[str, list[dict[str, Any]], dict[str, Any] | None, dict[str, Any] | None, RewriteResult, str | None]:
        (
            retrieval_results,
            retrieval_latency_ms,
            resolved_search_type,
            reranking_applied,
            retrieval_debug,
            rewrite,
            rewritten_query,
        ) = await self._collect_rag_retrieval(query, history, include_debug=include_debug)

        rag_response = await self.response_generator.generate(
            query=query,
            retrieval_results=retrieval_results,
            history_messages=history,
            retrieval_latency_ms=retrieval_latency_ms,
            search_type=resolved_search_type,
            reranking_applied=reranking_applied,
            include_debug=include_debug,
        )
        generation_debug = dataclasses.asdict(rag_response.debug) if rag_response.debug else None
        return (
            rag_response.content,
            rag_response.sources,
            generation_debug,
            retrieval_debug,
            rewrite,
            rewritten_query,
        )

    async def _collect_rag_retrieval(
        self,
        query: str,
        history: list[dict[str, str]],
        *,
        include_debug: bool,
    ) -> tuple[list[Any], int, str, bool, dict[str, Any] | None, RewriteResult, str | None]:
        rewrite = await self.rewriter.rewrite(query, history)
        queries = rewrite.rewritten_queries or [query]
        rewritten_query = queries[0] if queries and queries[0] != query else None

        merged_results: list[Any] = []
        retrieval_latency_ms = 0
        reranking_applied = False
        resolved_search_type = "hybrid"
        retrieval_debug: dict[str, Any] | None = None

        debug_by_query: list[dict[str, Any]] = []
        for rewrite_query in queries:
            retrieval_started = time.perf_counter()
            response = await self.retrieve_handler(rewrite_query)
            retrieval_latency_ms += max(1, int((time.perf_counter() - retrieval_started) * 1000))
            merged_results.extend(list(response.results))
            resolved_search_type = str(getattr(response.search_type, "value", response.search_type))
            reranking_applied = reranking_applied or any(bool(item.is_reranked) for item in response.results)
            if include_debug:
                query_debug = response.debug if isinstance(response.debug, dict) else {"debug": response.debug}
                debug_by_query.append({"query": rewrite_query, "debug": query_debug})

        deduped = self._deduplicate_results(merged_results)
        if include_debug:
            retrieval_debug = {
                "queries": queries,
                "unique_results": len(deduped),
                "results_before_dedup": len(merged_results),
                "search_type": resolved_search_type,
                "per_query": debug_by_query,
            }
        return (
            deduped,
            retrieval_latency_ms,
            resolved_search_type,
            reranking_applied,
            retrieval_debug,
            rewrite,
            rewritten_query,
        )

    async def _process_non_rag(
        self,
        query: str,
        history: list[dict[str, str]],
        analysis: AnalysisResult,
        *,
        include_debug: bool,
    ) -> tuple[str, dict[str, Any] | None]:
        messages = self._build_non_rag_messages(query, history, analysis.intent)
        response = await self.llm.generate(
            messages=messages,
            temperature=0.5,
            max_tokens=500,
            top_p=0.95,
        )
        debug_payload = None
        if include_debug:
            debug_payload = {
                "model": response.model,
                "temperature": 0.5,
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "time_to_first_token_ms": response.latency_ms,
                "total_latency_ms": response.latency_ms,
                "estimated_cost_usd": None,
                "non_rag_prompt": True,
            }
        return response.content, debug_payload

    def _build_non_rag_messages(
        self,
        query: str,
        history: list[dict[str, str]],
        intent: Intent,
    ) -> list[LLMMessage]:
        prompt_map = {
            Intent.GREETING: self.config.prompt_greeting,
            Intent.CHITCHAT: self.config.prompt_greeting,
            Intent.OUT_OF_SCOPE: self.config.prompt_out_of_scope,
        }
        response_language = self._response_language_label()
        system_prompt = prompt_map.get(intent, self.config.prompt_greeting).replace(
            "{response_language}",
            response_language,
        )
        messages = [LLMMessage(role="system", content=system_prompt)]
        for previous in history[-4:]:
            role = str(previous.get("role") or "user")
            content = str(previous.get("content") or "")
            messages.append(LLMMessage(role=role, content=content))
        messages.append(LLMMessage(role="user", content=query))
        return messages

    def _response_language_label(self) -> str:
        language = getattr(self.response_generator.config.response_language, "value", self.response_generator.config.response_language)
        language_text = str(language).strip().lower()
        if language_text == "fr":
            return "francais"
        if language_text == "en":
            return "english"
        return "meme langue que l'utilisateur"

    def _append_memory(
        self,
        *,
        query: str,
        answer: str,
        intent: Intent,
        sources: list[dict[str, Any]],
    ) -> None:
        self.memory.add_message("user", query, intent=intent.value)
        self.memory.add_message("assistant", answer, sources=sources or None)

    def _build_debug(
        self,
        *,
        analysis: AnalysisResult,
        rewrite: RewriteResult,
        history: list[dict[str, str]],
        retrieval_debug: dict[str, Any] | None,
        generation_debug: dict[str, Any] | None,
        total_latency_ms: int,
    ) -> OrchestratorDebugInfo:
        return OrchestratorDebugInfo(
            intent=analysis.intent.value,
            intent_confidence=analysis.confidence,
            intent_reasoning=analysis.reasoning,
            analyzer_latency_ms=analysis.latency_ms,
            original_query=rewrite.original_query,
            rewritten_queries=list(rewrite.rewritten_queries),
            rewriting_latency_ms=rewrite.latency_ms,
            history_messages=len(history),
            history_strategy=self.config.memory_strategy.value,
            history_tokens=self._estimate_history_tokens(history),
            retrieval_debug=retrieval_debug,
            generation_debug=generation_debug,
            total_latency_ms=total_latency_ms,
        )

    def _estimate_history_tokens(self, history: list[dict[str, str]]) -> int:
        return sum(max(1, len(str(item.get("content") or "").split())) for item in history)

    def _deduplicate_results(self, results: list[Any]) -> list[Any]:
        selected_by_chunk: dict[str, Any] = {}
        score_by_chunk: dict[str, float] = {}
        for item in results:
            chunk_id = str(getattr(item, "chunk_id", "") or "")
            if not chunk_id:
                continue
            score = float(getattr(item, "rerank_score", None) or getattr(item, "score", 0.0))
            previous_score = score_by_chunk.get(chunk_id)
            if previous_score is None or score > previous_score:
                selected_by_chunk[chunk_id] = item
                score_by_chunk[chunk_id] = score
        deduped = list(selected_by_chunk.values())
        deduped.sort(
            key=lambda item: float(getattr(item, "rerank_score", None) or getattr(item, "score", 0.0)),
            reverse=True,
        )
        return deduped
