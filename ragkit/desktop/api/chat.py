from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ragkit.agents.memory import ConversationMemory
from ragkit.agents.orchestrator import OrchestratedResult, Orchestrator
from ragkit.agents.query_analyzer import QueryAnalyzer
from ragkit.agents.query_rewriter import QueryRewriter
from ragkit.config.agents_schema import (
    ConversationHistory,
    ConversationMessageDTO,
    OrchestratedChatResponse,
    OrchestratorDebugInfo,
)
from ragkit.config.llm_schema import ChatQuery, ChatSource, LLMConfig
from ragkit.config.retrieval_schema import UnifiedSearchQuery
from ragkit.desktop.agents_service import get_agents_config
from ragkit.desktop.api import retrieval as retrieval_api
from ragkit.desktop.llm_service import get_llm_config, resolve_llm_provider
from ragkit.desktop.monitoring_service import get_query_logger
from ragkit.llm.response_generator import ResponseGenerator

router = APIRouter(prefix="/api", tags=["chat"])
_CONVERSATION_MEMORY: ConversationMemory | None = None


def _build_chat_response(
    *,
    payload: ChatQuery,
    result: OrchestratedResult,
) -> OrchestratedChatResponse:
    debug = result.debug if result.debug else None
    return OrchestratedChatResponse(
        query=payload.query,
        answer=result.answer,
        sources=[ChatSource.model_validate(source) for source in result.sources],
        intent=result.intent,
        needs_rag=result.needs_rag,
        rewritten_query=result.rewritten_query,
        query_log_id=result.query_log_id,
        debug=debug,
    )


def _get_conversation_memory() -> ConversationMemory:
    global _CONVERSATION_MEMORY
    if _CONVERSATION_MEMORY is None:
        _CONVERSATION_MEMORY = ConversationMemory(get_agents_config())
    return _CONVERSATION_MEMORY


def _analyzer_llm_config(base: LLMConfig, analyzer_model: str | None) -> LLMConfig:
    model_name = (analyzer_model or "").strip()
    if not model_name:
        return base
    return base.model_copy(update={"model": model_name})


def _build_orchestrator(payload: ChatQuery) -> tuple[Orchestrator, bool]:
    agents_config = get_agents_config()
    llm_config = get_llm_config()
    include_debug = bool(payload.include_debug or agents_config.debug_default or llm_config.debug_default)
    query_logger = get_query_logger()
    collect_metrics = bool(getattr(query_logger.config, "log_queries", True))
    include_pipeline_debug = bool(include_debug or collect_metrics)

    provider = resolve_llm_provider(llm_config)
    analyzer_provider = resolve_llm_provider(_analyzer_llm_config(llm_config, agents_config.analyzer_model))

    memory = _get_conversation_memory()
    memory.config = agents_config
    memory.llm = provider

    analyzer = QueryAnalyzer(agents_config, analyzer_provider)
    rewriter = QueryRewriter(agents_config, provider)
    generator = ResponseGenerator(llm_config, provider)

    async def retrieve_handler(rewrite_query: str):
        unified_query = UnifiedSearchQuery(
            query=rewrite_query,
            search_type=payload.search_type,
            alpha=payload.alpha,
            filters=payload.filters,
            include_debug=include_pipeline_debug,
            page=1,
            page_size=50,
        )
        return await retrieval_api._execute_unified_search(unified_query)

    orchestrator = Orchestrator(
        config=agents_config,
        analyzer=analyzer,
        rewriter=rewriter,
        memory=memory,
        response_generator=generator,
        llm=provider,
        retrieve_handler=retrieve_handler,
        query_logger=query_logger,
    )
    return orchestrator, include_debug


@router.post("/chat", response_model=OrchestratedChatResponse)
async def chat(payload: ChatQuery) -> OrchestratedChatResponse:
    try:
        orchestrator, include_debug = _build_orchestrator(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result = await orchestrator.process(payload.query, include_debug=include_debug)
    return _build_chat_response(payload=payload, result=result)


@router.post("/chat/stream")
async def chat_stream(payload: ChatQuery):
    async def event_generator():
        try:
            orchestrator, include_debug = _build_orchestrator(payload)
            async for event in orchestrator.stream(payload.query, include_debug=include_debug):
                event_type = str(event.get("type") or "")
                if event_type == "token":
                    token_payload = {"content": str(event.get("content", ""))}
                    yield f"event: token\ndata: {json.dumps(token_payload, ensure_ascii=False)}\n\n"
                    continue
                if event_type == "done":
                    result = OrchestratedResult(
                        query=payload.query,
                        answer=str(event.get("answer") or ""),
                        sources=list(event.get("sources") or []),
                        intent=str(event.get("intent") or "question"),
                        needs_rag=bool(event.get("needs_rag", True)),
                        rewritten_query=event.get("rewritten_query"),
                        query_log_id=event.get("query_log_id"),
                        debug=None,
                    )
                    debug_payload = event.get("debug")
                    if debug_payload:
                        result.debug = OrchestratorDebugInfo.model_validate(debug_payload)
                    done_payload = _build_chat_response(payload=payload, result=result).model_dump(mode="json")
                    yield f"event: done\ndata: {json.dumps(done_payload, ensure_ascii=False)}\n\n"
        except ValueError as exc:
            error_payload = {"error": str(exc)}
            yield f"event: error\ndata: {json.dumps(error_payload, ensure_ascii=False)}\n\n"
        except Exception as exc:
            error_payload = {"error": str(exc)}
            yield f"event: error\ndata: {json.dumps(error_payload, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/chat/new")
async def chat_new() -> dict[str, bool]:
    memory = _get_conversation_memory()
    memory.clear()
    return {"success": True}


@router.get("/chat/history", response_model=ConversationHistory)
async def chat_history() -> ConversationHistory:
    memory = _get_conversation_memory()
    messages = []
    for message in memory.list_messages():
        sources = None
        if message.sources:
                sources = []
                for item in message.sources:
                    try:
                        sources.append(ChatSource.model_validate(item))
                    except Exception:
                        continue
        messages.append(
            ConversationMessageDTO(
                role=message.role,
                content=message.content,
                intent=message.intent,
                sources=sources,
                query_log_id=message.query_log_id,
                feedback=message.feedback,
                timestamp=message.timestamp,
            )
        )
    return ConversationHistory(
        messages=messages,
        total_messages=memory.state.total_messages,
        has_summary=bool(memory.state.summary),
    )
