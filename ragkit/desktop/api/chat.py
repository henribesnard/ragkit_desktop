from __future__ import annotations

import dataclasses
import json
import time
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ragkit.config.llm_schema import ChatDebugInfo, ChatQuery, ChatResponse, ChatSource
from ragkit.config.retrieval_schema import UnifiedSearchQuery
from ragkit.desktop.api import retrieval as retrieval_api
from ragkit.desktop.llm_service import get_llm_config, resolve_llm_provider
from ragkit.llm.response_generator import ResponseGenerator

router = APIRouter(prefix="/api", tags=["chat"])


def _build_chat_response(
    *,
    payload: ChatQuery,
    search_type: str,
    answer: str,
    sources: list[dict[str, Any]],
    debug_payload: dict[str, Any] | None,
) -> ChatResponse:
    debug = ChatDebugInfo.model_validate(debug_payload) if debug_payload else None
    return ChatResponse(
        query=payload.query,
        answer=answer,
        sources=[ChatSource.model_validate(source) for source in sources],
        search_type=search_type,
        debug=debug,
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatQuery) -> ChatResponse:
    retrieval_started = time.perf_counter()
    unified_query = UnifiedSearchQuery(
        query=payload.query,
        search_type=payload.search_type,
        alpha=payload.alpha,
        filters=payload.filters,
        include_debug=payload.include_debug,
        page=1,
        page_size=50,
    )
    retrieval_response = await retrieval_api._execute_unified_search(unified_query)
    retrieval_latency_ms = max(1, int((time.perf_counter() - retrieval_started) * 1000))

    llm_config = get_llm_config()
    try:
        provider = resolve_llm_provider(llm_config)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    include_debug = bool(payload.include_debug or llm_config.debug_default)
    reranking_applied = any(bool(item.is_reranked) for item in retrieval_response.results)

    generator = ResponseGenerator(llm_config, provider)
    rag_response = await generator.generate(
        query=payload.query,
        retrieval_results=retrieval_response.results,
        retrieval_latency_ms=retrieval_latency_ms,
        search_type=retrieval_response.search_type.value,
        reranking_applied=reranking_applied,
        include_debug=include_debug,
    )
    debug_payload = dataclasses.asdict(rag_response.debug) if rag_response.debug else None
    return _build_chat_response(
        payload=payload,
        search_type=retrieval_response.search_type.value,
        answer=rag_response.content,
        sources=rag_response.sources,
        debug_payload=debug_payload,
    )


@router.post("/chat/stream")
async def chat_stream(payload: ChatQuery):
    async def event_generator():
        try:
            retrieval_started = time.perf_counter()
            unified_query = UnifiedSearchQuery(
                query=payload.query,
                search_type=payload.search_type,
                alpha=payload.alpha,
                filters=payload.filters,
                include_debug=payload.include_debug,
                page=1,
                page_size=50,
            )
            retrieval_response = await retrieval_api._execute_unified_search(unified_query)
            retrieval_latency_ms = max(1, int((time.perf_counter() - retrieval_started) * 1000))

            llm_config = get_llm_config()
            provider = resolve_llm_provider(llm_config)
            include_debug = bool(payload.include_debug or llm_config.debug_default)
            reranking_applied = any(bool(item.is_reranked) for item in retrieval_response.results)
            generator = ResponseGenerator(llm_config, provider)

            async for event in generator.stream_events(
                query=payload.query,
                retrieval_results=retrieval_response.results,
                retrieval_latency_ms=retrieval_latency_ms,
                search_type=retrieval_response.search_type.value,
                reranking_applied=reranking_applied,
                include_debug=include_debug,
            ):
                event_type = str(event.get("type") or "token")
                if event_type == "done":
                    done_payload = _build_chat_response(
                        payload=payload,
                        search_type=retrieval_response.search_type.value,
                        answer=str(event.get("answer", "")),
                        sources=list(event.get("sources", [])),
                        debug_payload=event.get("debug"),
                    ).model_dump(mode="json")
                    yield f"event: done\ndata: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
                else:
                    token_payload = {"content": str(event.get("content", ""))}
                    yield f"event: token\ndata: {json.dumps(token_payload, ensure_ascii=False)}\n\n"
        except Exception as exc:
            error_payload = {"error": str(exc)}
            yield f"event: error\ndata: {json.dumps(error_payload, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
