"""Public Chat API v1 — simplified endpoints for programmatic RAG access.

These endpoints are designed for SDK/curl/integration usage and provide a
cleaner interface than the internal desktop endpoints.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    _limiter = Limiter(key_func=get_remote_address)
except ImportError:
    _limiter = None

from ragkit.config.llm_schema import ChatQuery
from ragkit.desktop.api.chat import (
    _build_chat_response,
    _build_orchestrator,
    _persist_new_messages,
)
from ragkit.desktop.conversation_db import get_conversation_db
from ragkit.desktop.middleware.api_key_auth import generate_api_key, has_any_keys, list_keys, revoke_key, validate_api_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["public-api"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """Simplified chat request for the public API."""
    query: str = Field(..., min_length=1, max_length=5000)
    conversation_id: str | None = None
    stream: bool = False


class ChatResponseModel(BaseModel):
    """Public API chat response."""
    answer: str
    sources: list[dict] = []
    conversation_id: str | None = None
    intent: str | None = None
    query_log_id: str | None = None


class ConversationItem(BaseModel):
    id: str
    title: str | None = None
    created_at: str | None = None
    total_messages: int = 0


class ApiKeyResponse(BaseModel):
    api_key: str
    message: str = "Store this key securely. It will not be shown again."


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/chat", response_model=ChatResponseModel)
@(_limiter.limit("30/minute") if _limiter else lambda f: f)
async def public_chat(request: Request, req: ChatRequest):
    """Send a query and get a complete RAG response."""
    payload = ChatQuery(
        query=req.query,
        conversation_id=req.conversation_id,
    )
    try:
        orchestrator, include_debug, cid = _build_orchestrator(payload)
        result = await orchestrator.process(payload.query, include_debug=include_debug)
    except Exception as exc:
        logger.exception("Public chat pipeline error")
        raise HTTPException(status_code=502, detail="An error occurred processing your request.") from exc

    _persist_new_messages(cid, orchestrator._new_messages, orchestrator.memory.state.summary)
    resp = _build_chat_response(payload=payload, result=result)

    return ChatResponseModel(
        answer=resp.answer,
        sources=[s.model_dump(mode="json") for s in resp.sources] if resp.sources else [],
        conversation_id=cid,
        intent=resp.intent,
        query_log_id=resp.query_log_id,
    )


@router.post("/chat/stream")
@(_limiter.limit("30/minute") if _limiter else lambda f: f)
async def public_chat_stream(request: Request, req: ChatRequest):
    """Send a query and get a streaming RAG response (SSE)."""
    payload = ChatQuery(
        query=req.query,
        conversation_id=req.conversation_id,
    )

    async def event_generator():
        try:
            orchestrator, include_debug, cid = _build_orchestrator(payload)
            async for event in orchestrator.stream(payload.query, include_debug=include_debug):
                event_type = str(event.get("type") or "")

                if event_type == "status":
                    data = {"step": str(event.get("step", "")), "detail": event.get("detail")}
                    yield f"event: status\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
                elif event_type == "token":
                    data = {"content": str(event.get("content", ""))}
                    yield f"event: token\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
                elif event_type == "done":
                    _persist_new_messages(cid, orchestrator._new_messages, orchestrator.memory.state.summary)
                    data = {
                        "answer": str(event.get("answer") or ""),
                        "sources": list(event.get("sources") or []),
                        "conversation_id": cid,
                        "intent": str(event.get("intent") or "question"),
                        "query_log_id": event.get("query_log_id"),
                    }
                    yield f"event: done\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
        except Exception as exc:
            logger.exception("Public chat stream error")
            yield f"event: error\ndata: {json.dumps({'error': 'An error occurred processing your request.'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/chat/conversations", response_model=list[ConversationItem])
async def list_conversations():
    """List all conversations."""
    db = get_conversation_db()
    convs = db.list_conversations()
    return [
        ConversationItem(
            id=c["id"],
            title=c.get("title"),
            created_at=c.get("created_at"),
            total_messages=c.get("total_messages", 0),
        )
        for c in convs
    ]


@router.post("/chat/conversations")
async def create_conversation():
    """Create a new conversation and return its ID."""
    import uuid
    conversation_id = str(uuid.uuid4())
    db = get_conversation_db()
    db.create_conversation(conversation_id)
    return {"conversation_id": conversation_id}


@router.post("/setup/generate-key", response_model=ApiKeyResponse)
@(_limiter.limit("5/hour") if _limiter else lambda f: f)
async def generate_key(request: Request):
    """Generate a new API key. Returns the raw key (shown once).

    During initial setup (no keys exist yet) this endpoint is open.
    After the first key is created, the caller must authenticate with
    a valid API key to generate additional keys.
    """
    if has_any_keys():
        api_key = request.headers.get("X-API-Key", "")
        if not api_key:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                api_key = auth_header[7:]
        if not validate_api_key(api_key):
            raise HTTPException(status_code=401, detail="Authentication required to generate additional keys")
    raw_key = generate_api_key()
    return ApiKeyResponse(api_key=raw_key)


@router.get("/setup/status")
async def setup_status():
    """Check if initial setup is complete and if API keys exist."""
    from ragkit.desktop.settings_store import load_settings
    settings = load_settings()
    return {
        "setup_completed": bool(settings.setup_completed),
        "has_api_keys": has_any_keys(),
    }


@router.get("/setup/keys")
async def get_keys():
    """List all API keys with their status (prefix, dates, active/revoked/expired)."""
    return {"keys": list_keys()}


@router.delete("/setup/keys/{prefix}")
async def delete_key(prefix: str):
    """Revoke a specific API key by its prefix."""
    if revoke_key(prefix):
        return {"success": True, "detail": f"Key {prefix}... revoked"}
    raise HTTPException(status_code=404, detail="Key not found or already revoked")
