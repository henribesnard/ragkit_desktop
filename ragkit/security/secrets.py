"""Secure API key management with optional system keyring and encrypted fallback."""

from __future__ import annotations

import base64
import getpass
import hashlib
import hmac
import json
import os
import platform
from pathlib import Path

SERVICE_NAME = "ragkit"
CREDENTIALS_FILE = Path.home() / ".ragkit" / "credentials.enc"


class SecretsManager:
    def __init__(self) -> None:
        self._keyring = None
        self._keyring_available = False
        try:
            import keyring  # type: ignore

            keyring.get_password(SERVICE_NAME, "__probe__")
            self._keyring = keyring
            self._keyring_available = True
        except Exception:
            self._keyring = None
            self._keyring_available = False

    @property
    def keyring_available(self) -> bool:
        return self._keyring_available

    def _derive_key(self) -> bytes:
        machine = f"{platform.node()}|{platform.machine()}|{platform.system()}|{getpass.getuser()}".encode("utf-8")
        return hashlib.pbkdf2_hmac("sha256", machine, b"ragkit-credentials-v1", 240_000, dklen=32)

    def _xor_stream(self, data: bytes, key: bytes) -> bytes:
        out = bytearray()
        counter = 0
        while len(out) < len(data):
            block = hashlib.sha256(key + counter.to_bytes(8, "big")).digest()
            out.extend(block)
            counter += 1
        return bytes(a ^ b for a, b in zip(data, out[: len(data)]))

    def _encrypt_payload(self, payload: dict[str, str]) -> bytes:
        key = self._derive_key()
        raw = json.dumps(payload).encode("utf-8")
        cipher = self._xor_stream(raw, key)
        mac = hmac.new(key, cipher, hashlib.sha256).digest()
        return base64.urlsafe_b64encode(mac + cipher)

    def _decrypt_payload(self, blob: bytes) -> dict[str, str]:
        key = self._derive_key()
        decoded = base64.urlsafe_b64decode(blob)
        mac, cipher = decoded[:32], decoded[32:]
        expected = hmac.new(key, cipher, hashlib.sha256).digest()
        if not hmac.compare_digest(mac, expected):
            raise ValueError("Credentials integrity check failed")
        raw = self._xor_stream(cipher, key)
        return json.loads(raw.decode("utf-8"))

    def _load_file_store(self) -> dict[str, str]:
        if not CREDENTIALS_FILE.exists():
            return {}
        try:
            return self._decrypt_payload(CREDENTIALS_FILE.read_bytes())
        except Exception:
            return {}

    def _save_file_store(self, data: dict[str, str]) -> None:
        CREDENTIALS_FILE.parent.mkdir(parents=True, exist_ok=True)
        CREDENTIALS_FILE.write_bytes(self._encrypt_payload(data))

    def store(self, key_name: str, value: str) -> None:
        if self._keyring_available and self._keyring:
            self._keyring.set_password(SERVICE_NAME, key_name, value)
            return
        data = self._load_file_store()
        data[key_name] = value
        self._save_file_store(data)

    def retrieve(self, key_name: str) -> str | None:
        if self._keyring_available and self._keyring:
            return self._keyring.get_password(SERVICE_NAME, key_name)
        return self._load_file_store().get(key_name)

    def delete(self, key_name: str) -> None:
        if self._keyring_available and self._keyring:
            try:
                self._keyring.delete_password(SERVICE_NAME, key_name)
            except Exception:
                pass
        data = self._load_file_store()
        if key_name in data:
            data.pop(key_name)
            self._save_file_store(data)

    def exists(self, key_name: str) -> bool:
        return self.retrieve(key_name) is not None


secrets_manager = SecretsManager()
