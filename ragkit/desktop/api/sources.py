"""REST API for managing heterogeneous knowledge sources."""

from __future__ import annotations

import logging
from typing import Any

import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
import httpx
from fastapi import APIRouter, HTTPException, Request

from ragkit.config.manager import config_manager
from ragkit.connectors.credentials import CredentialManager
from ragkit.connectors.registry import available_source_types, create_connector
from ragkit.desktop.models import (
    SettingsPayload,
    SourceEntry,
    SyncFrequency,
    SourceType,
)
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sources", tags=["sources"])
credential_manager = CredentialManager()

_OAUTH_PROVIDERS = {
    "google": {
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "scopes": ["https://www.googleapis.com/auth/drive.readonly"],
        "auth_params": {
            "access_type": "offline",
            "prompt": "consent",
        },
    },
    "microsoft": {
        "auth_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "scopes": ["offline_access", "Files.Read.All"],
        "auth_params": {},
    },
    "dropbox": {
        "auth_url": "https://www.dropbox.com/oauth2/authorize",
        "token_url": "https://api.dropboxapi.com/oauth2/token",
        "scopes": ["files.metadata.read", "files.content.read"],
        "auth_params": {"token_access_type": "offline"},
    },
}


def _oauth_client(provider: str) -> tuple[str, str]:
    provider = provider.lower()
    prefix = f"LOKO_{provider.upper()}_"
    client_id = os.getenv(f"{prefix}CLIENT_ID")
    client_secret = os.getenv(f"{prefix}CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=400,
            detail=f"OAuth client credentials missing for {provider}.",
        )
    return client_id, client_secret


def _oauth_state(provider: str, source_id: str) -> str:
    return f"{provider}:{source_id}"


class SourceEntryPatch(BaseModel):
    """Payload for partial updates of a source entry."""
    name: str | None = None
    enabled: bool | None = None
    sync_frequency: SyncFrequency | None = None
    config: dict[str, Any] | None = None


def _store_inline_credential(source: SourceEntry) -> None:
    if not isinstance(source.config, dict):
        return
    credential = source.config.pop("credential", None)
    if not credential:
        return
    key = source.credential_key or f"manual:{source.id}"
    credential_manager.store(key, credential)
    source.credential_key = key


def _get_settings() -> SettingsPayload:
    return config_manager.load_config() or SettingsPayload()


def _save_settings(settings: SettingsPayload) -> None:
    config_manager.save_config(settings)


@router.get("", response_model=list[SourceEntry])
async def list_sources():
    """List all configured knowledge sources."""
    settings = _get_settings()
    if not settings.ingestion:
        return []
    return settings.ingestion.sources


@router.post("", response_model=SourceEntry)
async def add_source(payload: dict[str, Any]):
    """Add a new source.
    
    The payload should match the fields of `SourceEntry` (without `id` and `created_at`).
    """
    try:
        source = SourceEntry.model_validate(payload)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    settings = _get_settings()
    if not settings.ingestion:
        # Should not happen normally if app is initialized
        raise HTTPException(status_code=500, detail="Ingestion config not initialized")
    
    _store_inline_credential(source)
    settings.ingestion.sources.append(source)
    _save_settings(settings)
    if source.enabled and source.sync_frequency != SyncFrequency.MANUAL:
        from ragkit.desktop.sync_scheduler import sync_scheduler
        await sync_scheduler.schedule_source(source)
    return source


@router.get("/{source_id}", response_model=SourceEntry)
async def get_source(source_id: str):
    """Get details for a specific source."""
    settings = _get_settings()
    if settings.ingestion:
        for source in settings.ingestion.sources:
            if source.id == source_id:
                return source
    raise HTTPException(status_code=404, detail="Source not found")


@router.put("/{source_id}", response_model=SourceEntry)
async def update_source(source_id: str, patch: SourceEntryPatch):
    """Partially update an existing source."""
    settings = _get_settings()
    if not settings.ingestion:
        raise HTTPException(status_code=404, detail="Source not found")

    for i, source in enumerate(settings.ingestion.sources):
        if source.id == source_id:
            # Update fields if provided
            if patch.name is not None:
                source.name = patch.name
            if patch.enabled is not None:
                source.enabled = patch.enabled
            if patch.sync_frequency is not None:
                source.sync_frequency = patch.sync_frequency # type: ignore
            if patch.config is not None:
                source.config = patch.config

            _store_inline_credential(source)
                
            settings.ingestion.sources[i] = source
            _save_settings(settings)
            if source.enabled and source.sync_frequency != SyncFrequency.MANUAL:
                from ragkit.desktop.sync_scheduler import sync_scheduler
                await sync_scheduler.schedule_source(source)
            else:
                from ragkit.desktop.sync_scheduler import sync_scheduler
                await sync_scheduler.unschedule_source(source.id)
            return source

    raise HTTPException(status_code=404, detail="Source not found")


@router.delete("/{source_id}")
async def delete_source(source_id: str):
    """Delete a source and (eventually) its associated indexed data."""
    settings = _get_settings()
    if not settings.ingestion:
        raise HTTPException(status_code=404, detail="Source not found")

    sources = settings.ingestion.sources
    for i, source in enumerate(sources):
        if source.id == source_id:
            sources.pop(i)
            _save_settings(settings)
            from ragkit.desktop.sync_scheduler import sync_scheduler
            await sync_scheduler.unschedule_source(source_id)
            # Future: Queue a background task to remove documents from vector store
            return {"success": True}

    raise HTTPException(status_code=404, detail="Source not found")


@router.post("/{source_id}/test")
async def test_source_connection(source_id: str):
    """Test the connection and validate the configuration of a source."""
    source = await get_source(source_id)
    try:
        # Note: In a real flow, we would fetch credentials from Keyring here
        credential = None
        if source.credential_key:
            credential = credential_manager.retrieve(source.credential_key)
        connector = create_connector(
            source_type=source.type,
            source_id=source.id,
            config=source.config,
            credential=credential
        )
        result = await connector.test_connection()
        return {
            "valid": result.valid,
            "errors": result.errors,
            "warnings": result.warnings
        }
    except Exception as e:
        logger.exception("Connection test failed for source %s", source_id)
        return {
            "valid": False,
            "errors": [f"Erreur interne : {e}"],
            "warnings": []
        }


@router.post("/{source_id}/sync")
async def sync_source(source_id: str, payload: dict[str, Any] | None = None):
    """Trigger an immediate sync for a specific source."""
    payload = payload or {}
    incremental = bool(payload.get("incremental", True))
    
    # Verify source exists
    source = await get_source(source_id)
    if not source.enabled:
        raise HTTPException(status_code=400, detail="Cannot sync a disabled source")
        
    from ragkit.desktop.ingestion_runtime import runtime
    result = await runtime.start(incremental=incremental, source_ids=[source_id])
    return {
        "status": result.get("status", "started"),
        "incremental": incremental,
        "source_id": source_id,
        "version": result.get("version"),
    }


@router.post("/{source_id}/oauth/start")
async def start_oauth(source_id: str, provider: str, request: Request):
    """Generate the OAuth2 authorization URL for the given provider."""
    provider = provider.lower()
    if provider not in _OAUTH_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown OAuth provider.")

    source = await get_source(source_id)
    client_id, client_secret = _oauth_client(provider)
    base = str(request.base_url).rstrip("/")
    redirect_uri = f"{base}/api/sources/oauth/callback"

    cfg = _OAUTH_PROVIDERS[provider]
    scope = " ".join(cfg.get("scopes", []))
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scope,
        "state": _oauth_state(provider, source.id),
        **cfg.get("auth_params", {}),
    }

    auth_url = cfg["auth_url"] + "?" + urlencode(params)
    # Return the auth URL so the frontend can open it in a webview.
    return {"auth_url": auth_url}


@router.get("/oauth/callback")
async def oauth_callback(code: str, state: str, request: Request):
    """OAuth2 callback endpoint."""
    if ":" not in state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")

    provider, source_id = state.split(":", 1)
    provider = provider.lower()
    if provider not in _OAUTH_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown OAuth provider.")

    # Validate source
    _ = await get_source(source_id)

    client_id, client_secret = _oauth_client(provider)
    base = str(request.base_url).rstrip("/")
    redirect_uri = f"{base}/api/sources/oauth/callback"
    token_url = _OAUTH_PROVIDERS[provider]["token_url"]

    data = {
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret,
    }
    if provider == "dropbox":
        data["token_access_type"] = "offline"

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(token_url, data=data)
    if response.status_code >= 400:
        raise HTTPException(status_code=400, detail=f"OAuth token exchange failed: {response.text}")

    token_payload = response.json()
    expires_in = int(token_payload.get("expires_in", 3600))
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    credential_key = f"oauth:{provider}:{source_id}"
    credential_manager.store(
        credential_key,
        {
            "provider": provider,
            "access_token": token_payload.get("access_token"),
            "refresh_token": token_payload.get("refresh_token"),
            "token_url": token_url,
            "client_id": client_id,
            "client_secret": client_secret,
            "scopes": _OAUTH_PROVIDERS[provider].get("scopes", []),
            "expires_in": expires_in,
            "expires_at": expires_at.isoformat(),
            "credential_key": credential_key,
        },
    )

    settings = _get_settings()
    if settings.ingestion:
        for src in settings.ingestion.sources:
            if src.id == source_id:
                src.credential_key = credential_key
                if provider == "google":
                    src.type = SourceType.GOOGLE_DRIVE
                elif provider == "microsoft":
                    src.type = SourceType.ONEDRIVE
                elif provider == "dropbox":
                    src.type = SourceType.DROPBOX
                break
        _save_settings(settings)

    return {"success": True}


@router.post("/{source_id}/oauth/revoke")
async def revoke_oauth(source_id: str):
    source = await get_source(source_id)
    if source.credential_key:
        try:
            credential_manager.delete(source.credential_key)
        except Exception:
            pass
        source.credential_key = None
        settings = _get_settings()
        if settings.ingestion:
            for i, src in enumerate(settings.ingestion.sources):
                if src.id == source_id:
                    settings.ingestion.sources[i] = source
                    _save_settings(settings)
                    break
    return {"success": True}


@router.get("/types")
async def list_source_types():
    """List all available source types and their registration status."""
    return available_source_types()
