"""Abstract base interfaces for LLM providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator


@dataclass
class LLMMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass
class LLMUsage:
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass
class LLMResponse:
    content: str
    usage: LLMUsage
    model: str
    latency_ms: int


@dataclass
class LLMStreamChunk:
    content: str
    is_final: bool = False
    usage: LLMUsage | None = None
    latency_ms: int | None = None


@dataclass
class LLMTestResult:
    success: bool
    model: str
    response_text: str
    latency_ms: int
    error: str | None = None


class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.1,
        max_tokens: int = 2000,
        top_p: float = 0.9,
    ) -> LLMResponse:
        """Generate a complete non-streaming response."""

    @abstractmethod
    async def stream(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.1,
        max_tokens: int = 2000,
        top_p: float = 0.9,
    ) -> AsyncIterator[LLMStreamChunk]:
        """Stream a response token by token."""

    @abstractmethod
    async def test_connection(self) -> LLMTestResult:
        """Run a lightweight provider connectivity check."""
