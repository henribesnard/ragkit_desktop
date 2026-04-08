"""Credential storage and OAuth2 refresh helpers."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx


class CredentialManager:
    """Stockage securise des credentials dans le keyring systeme."""

    KEYRING_SERVICE = "loko-rag"

    def store(self, key: str, data: dict[str, Any]) -> None:
        import keyring
        keyring.set_password(self.KEYRING_SERVICE, key, json.dumps(data))

    def retrieve(self, key: str) -> dict[str, Any] | None:
        import keyring
        raw = keyring.get_password(self.KEYRING_SERVICE, key)
        return json.loads(raw) if raw else None

    def delete(self, key: str) -> None:
        import keyring
        keyring.delete_password(self.KEYRING_SERVICE, key)

    def refresh_oauth2_token(
        self,
        key: str,
        refresh_url: str,
        client_id: str,
        client_secret: str,
    ) -> dict[str, Any]:
        """Renouvelle un token OAuth2 expiré et le stocke."""
        data = self.retrieve(key)
        if not data or not data.get("refresh_token"):
            raise ValueError("No refresh token available for this credential.")

        payload = {
            "grant_type": "refresh_token",
            "refresh_token": data["refresh_token"],
            "client_id": client_id,
            "client_secret": client_secret,
        }

        response = httpx.post(refresh_url, data=payload, timeout=30)
        if response.status_code >= 400:
            raise RuntimeError(f"Token refresh failed: {response.status_code} {response.text}")

        token_data = response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise RuntimeError("Token refresh did not return an access_token.")

        expires_in = int(token_data.get("expires_in", 3600))
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

        updated = {
            **data,
            "access_token": access_token,
            "expires_in": expires_in,
            "expires_at": expires_at,
        }

        if token_data.get("refresh_token"):
            updated["refresh_token"] = token_data["refresh_token"]

        self.store(key, updated)
        return updated

    @staticmethod
    def is_expired(payload: dict[str, Any] | None) -> bool:
        if not payload:
            return True
        expires_at = payload.get("expires_at")
        if not expires_at:
            return False
        try:
            exp = datetime.fromisoformat(expires_at)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            return exp <= datetime.now(timezone.utc) + timedelta(minutes=1)
        except Exception:
            return False

