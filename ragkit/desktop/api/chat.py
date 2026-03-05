from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ragkit.agents.memory import ConversationMemory, ConversationMessage, ConversationState
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
from ragkit.desktop.api.retrieval.unified_api import execute_unified_search
from ragkit.desktop.conversation_db import get_conversation_db
from ragkit.desktop.llm_service import get_llm_config, resolve_llm_provider
from ragkit.desktop.monitoring_service import get_query_logger
from ragkit.llm.response_generator import ResponseGenerator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])
_MEMORY_CACHE: dict[str, ConversationMemory] = {}
_MAX_CACHE_SIZE = 50
_DEFAULT_ID = "default"


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


def _get_conversation_memory(conversation_id: str | None = None) -> ConversationMemory:
    """Load or create an in-memory ConversationMemory backed by SQLite."""
    global _MEMORY_CACHE
    cid = conversation_id or _DEFAULT_ID
    if cid not in _MEMORY_CACHE:
        if len(_MEMORY_CACHE) >= _MAX_CACHE_SIZE:
            oldest_key = next(iter(_MEMORY_CACHE))
            del _MEMORY_CACHE[oldest_key]
            logger.debug("Pruned conversation cache entry: %s", oldest_key)

        db = get_conversation_db()
        # Create conversation in DB if it doesn't exist
        db.create_conversation(cid)
        # Load messages from SQLite
        messages_data = db.get_messages(cid)
        summary = db.get_summary(cid)

        memory = ConversationMemory(
            get_agents_config(),
            conversation_id=cid,
            storage_path=None,  # No JSON file I/O
        )
        memory.state = ConversationState(
            messages=[ConversationMessage(**m) for m in messages_data],
            summary=summary,
            total_messages=len(messages_data),
        )
        _MEMORY_CACHE[cid] = memory
        logger.debug("Loaded conversation memory from DB: %s (%d messages)", cid, len(messages_data))
    return _MEMORY_CACHE[cid]


def _persist_new_messages(conversation_id: str, memory: ConversationMemory, prev_count: int) -> None:
    """Persist any new messages added since prev_count to SQLite."""
    db = get_conversation_db()
    new_messages = memory.state.messages[prev_count:]
    for msg in new_messages:
        db.add_message(
            conversation_id,
            msg.role,
            msg.content,
            intent=msg.intent,
            sources=msg.sources,
            query_log_id=msg.query_log_id,
            feedback=msg.feedback,
            timestamp=msg.timestamp,
        )
    # Persist summary if it changed
    if memory.state.summary:
        db.update_summary(conversation_id, memory.state.summary)


def _analyzer_llm_config(base: LLMConfig, analyzer_model: str | None) -> LLMConfig:
    model_name = (analyzer_model or "").strip()
    if not model_name:
        return base
    return base.model_copy(update={"model": model_name})


def _build_orchestrator(payload: ChatQuery) -> tuple[Orchestrator, bool, str, int]:
    """Build orchestrator and return (orchestrator, include_debug, conversation_id, prev_message_count)."""
    agents_config = get_agents_config()
    llm_config = get_llm_config()
    include_debug = bool(payload.include_debug or agents_config.debug_default or llm_config.debug_default)
    query_logger = get_query_logger()
    collect_metrics = bool(getattr(query_logger.config, "log_queries", True))
    include_pipeline_debug = bool(include_debug or collect_metrics)

    provider = resolve_llm_provider(llm_config)
    analyzer_provider = resolve_llm_provider(_analyzer_llm_config(llm_config, agents_config.analyzer_model))

    cid = (payload.conversation_id if hasattr(payload, "conversation_id") else None) or _DEFAULT_ID
    memory = _get_conversation_memory(cid)
    prev_count = len(memory.state.messages)
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
        return await execute_unified_search(unified_query)

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
    return orchestrator, include_debug, cid, prev_count


@router.post("/chat", response_model=OrchestratedChatResponse)
async def chat(payload: ChatQuery) -> OrchestratedChatResponse:
    try:
        orchestrator, include_debug, cid, prev_count = _build_orchestrator(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        result = await orchestrator.process(payload.query, include_debug=include_debug)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Pipeline error: {exc}") from exc
    # Persist new messages to SQLite
    _persist_new_messages(cid, orchestrator.memory, prev_count)
    return _build_chat_response(payload=payload, result=result)


@router.post("/chat/stream")
async def chat_stream(payload: ChatQuery):
    async def event_generator():
        try:
            orchestrator, include_debug, cid, prev_count = _build_orchestrator(payload)
            async for event in orchestrator.stream(payload.query, include_debug=include_debug):
                event_type = str(event.get("type") or "")

                if event_type == "status":
                    status_payload = {
                        "step": str(event.get("step", "")),
                        "detail": event.get("detail"),
                    }
                    yield f"event: status\ndata: {json.dumps(status_payload, ensure_ascii=False)}\n\n"
                    continue

                if event_type == "token":
                    token_payload = {"content": str(event.get("content", ""))}
                    yield f"event: token\ndata: {json.dumps(token_payload, ensure_ascii=False)}\n\n"
                    continue
                if event_type == "done":
                    # Persist new messages to SQLite
                    _persist_new_messages(cid, orchestrator.memory, prev_count)

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
            logger.warning("Chat stream validation error: %s", exc)
            error_payload = {"error": str(exc)}
            yield f"event: error\ndata: {json.dumps(error_payload, ensure_ascii=False)}\n\n"
        except Exception as exc:
            logger.exception("Chat stream error")
            error_payload = {"error": str(exc)}
            yield f"event: error\ndata: {json.dumps(error_payload, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Conversation management
# ---------------------------------------------------------------------------

@router.post("/chat/new")
async def chat_new(conversation_id: str | None = None) -> dict[str, bool]:
    cid = conversation_id or _DEFAULT_ID
    db = get_conversation_db()
    # If conversation exists, clear its messages; otherwise create it
    if db.get_conversation(cid):
        db.clear_conversation(cid)
    else:
        db.create_conversation(cid)
    _MEMORY_CACHE.pop(cid, None)
    logger.info("Created/cleared conversation: %s", cid)
    return {"success": True}


@router.get("/chat/history", response_model=ConversationHistory)
async def chat_history(conversation_id: str | None = None) -> ConversationHistory:
    cid = conversation_id or _DEFAULT_ID
    db = get_conversation_db()
    messages_data = db.get_messages(cid)
    conv = db.get_conversation(cid)
    messages = []
    for m in messages_data:
        sources = None
        if m.get("sources"):
            sources = []
            for item in m["sources"]:
                try:
                    sources.append(ChatSource.model_validate(item))
                except Exception:
                    continue
        messages.append(
            ConversationMessageDTO(
                role=m["role"],
                content=m["content"],
                intent=m.get("intent"),
                sources=sources,
                query_log_id=m.get("query_log_id"),
                feedback=m.get("feedback"),
                timestamp=m.get("timestamp", ""),
            )
        )
    return ConversationHistory(
        messages=messages,
        total_messages=conv["total_messages"] if conv else len(messages),
        has_summary=bool(conv.get("summary")) if conv else False,
    )


@router.get("/chat/conversations")
async def list_conversations() -> list[dict]:
    db = get_conversation_db()
    return db.list_conversations()


@router.put("/chat/conversations/{conversation_id}/title")
async def update_conversation_title(conversation_id: str, payload: dict) -> dict[str, bool]:
    title = payload.get("title", "")
    db = get_conversation_db()
    db.update_title(conversation_id, title)
    return {"success": True}


@router.put("/chat/conversations/{conversation_id}/archive")
async def update_conversation_archive(conversation_id: str, payload: dict) -> dict[str, bool]:
    archived = bool(payload.get("archived", False))
    db = get_conversation_db()
    db.set_archived(conversation_id, archived)
    return {"success": True}


@router.delete("/chat/conversations/{conversation_id}")
async def delete_conversation_endpoint(conversation_id: str) -> dict[str, bool]:
    db = get_conversation_db()
    db.delete_conversation(conversation_id)
    _MEMORY_CACHE.pop(conversation_id, None)
    logger.info("Deleted conversation: %s", conversation_id)
    return {"success": True}


@router.post("/chat/generate_title")
async def generate_title(payload: dict) -> dict[str, str]:
    conversation_id = payload.get("conversation_id")
    cid = conversation_id or _DEFAULT_ID
    db = get_conversation_db()
    messages_data = db.get_messages(cid)

    if not messages_data:
        logger.debug("generate_title: no messages for %s", cid)
        return {"title": "Conversation"}

    llm_config = get_llm_config()
    provider = resolve_llm_provider(llm_config)

    first_msg = messages_data[0]["content"][:500]
    prompt = (
        "Generate a very short title (3 to 5 words maximum) for this conversation "
        "based on this first message. Reply in the SAME LANGUAGE as the message:\n\n"
        f"\"{first_msg}\"\n\n"
        "Reply ONLY with the title, no final punctuation."
    )

    try:
        from ragkit.llm.base import LLMMessage
        response = await provider.generate(
            messages=[LLMMessage(role="user", content=prompt)],
            temperature=0.3,
            max_tokens=20,
        )
        title = str(response.content or "").strip().strip('"').strip("'")
        if title:
            db.update_title(cid, title)
        logger.info("Generated title for %s: %s", cid, title)
        return {"title": title or "Conversation"}
    except Exception:
        logger.exception("Failed to generate title for %s", cid)
        return {"title": "Conversation"}
