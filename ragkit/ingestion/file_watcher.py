"""Lightweight file watcher state helper used by auto-ingestion mode."""

from __future__ import annotations

import time
from dataclasses import dataclass


@dataclass
class WatchDecision:
    changed: bool
    stable: bool
    ready_to_trigger: bool
    signature: str


class FileWatcherState:
    """Tracks change signatures and debounce timing for automatic ingestion."""

    def __init__(self, debounce_seconds: int = 30) -> None:
        self.debounce_seconds = max(5, int(debounce_seconds))
        self._last_signature: str | None = None
        self._deadline: float | None = None

    def reset(self) -> None:
        self._last_signature = None
        self._deadline = None

    def observe(self, signature: str) -> WatchDecision:
        now = time.monotonic()
        if not signature:
            self.reset()
            return WatchDecision(changed=False, stable=True, ready_to_trigger=False, signature="")

        if signature != self._last_signature:
            self._last_signature = signature
            self._deadline = now + self.debounce_seconds
            return WatchDecision(changed=True, stable=False, ready_to_trigger=False, signature=signature)

        if self._deadline is None:
            self._deadline = now + self.debounce_seconds
            return WatchDecision(changed=False, stable=False, ready_to_trigger=False, signature=signature)

        stable = now >= self._deadline
        return WatchDecision(changed=False, stable=stable, ready_to_trigger=stable, signature=signature)

