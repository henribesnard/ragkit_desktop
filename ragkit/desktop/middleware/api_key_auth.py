"""API Key authentication middleware for ragkit server mode."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import secrets
from pathlib import Path

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Paths that never require authentication
_PUBLIC_PATHS = {"/health"}

# Paths accessible without API key during initial setup only
_SETUP_PATHS_PREFIX = "/api/wizard"


def _get_keys_path() -> Path:
    data_dir = os.environ.get("RAGKIT_DATA_DIR")
    if data_dir:
        root = Path(data_dir)
    else:
        root = Path.home() / ".loko"
    config_dir = root / "config"
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir / "api_keys.json"


def _load_keys() -> dict:
    path = _get_keys_path()
    if not path.exists():
        return {"keys": []}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"keys": []}


def _save_keys(data: dict) -> None:
    path = _get_keys_path()
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _hash_key(raw_key: str) -> str:
    """Hash an API key with SHA-256 for storage."""
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_api_key() -> str:
    """Generate a new API key, store its hash, and return the raw key.

    The raw key is shown to the user once and never stored.
    """
    raw_key = f"rk-{secrets.token_urlsafe(32)}"
    key_hash = _hash_key(raw_key)

    data = _load_keys()
    data["keys"].append({
        "hash": key_hash,
        "prefix": raw_key[:7],
    })
    _save_keys(data)

    logger.info("New API key generated (prefix: %s...)", raw_key[:7])
    return raw_key


def validate_api_key(raw_key: str) -> bool:
    """Check if a raw API key matches any stored hash."""
    if not raw_key:
        return False
    key_hash = _hash_key(raw_key)
    data = _load_keys()
    return any(
        hmac.compare_digest(key_hash, entry["hash"])
        for entry in data.get("keys", [])
    )


def has_any_keys() -> bool:
    """Return True if at least one API key has been generated."""
    data = _load_keys()
    return len(data.get("keys", [])) > 0


def _is_setup_complete() -> bool:
    """Check if the initial setup wizard has been completed."""
    from ragkit.desktop.settings_store import load_settings
    settings = load_settings()
    return bool(settings.setup_completed)


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Validate X-API-Key or Authorization: Bearer <key> header.

    During initial setup (no API keys generated yet), all requests are
    allowed so the wizard can run. Once setup is complete and a key exists,
    all non-public endpoints require a valid key.
    """

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        path = request.url.path

        # Always allow public paths
        if path in _PUBLIC_PATHS:
            return await call_next(request)

        # Allow static file serving (frontend assets)
        if not path.startswith("/api"):
            return await call_next(request)

        # During initial setup: allow wizard and all API calls
        if not has_any_keys():
            return await call_next(request)

        # Extract API key from headers
        api_key = request.headers.get("X-API-Key", "")
        if not api_key:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                api_key = auth_header[7:]

        if validate_api_key(api_key):
            return await call_next(request)

        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or missing API key"},
        )
