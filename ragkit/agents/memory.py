"""Conversation memory management for orchestrated chat."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

from ragkit.config.agents_schema import AgentsConfig, MemoryStrategy
from ragkit.llm.base import BaseLLMProvider, LLMMessage


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class ConversationMessage:
    role: str
    content: str
    intent: str | None = None
    sources: list[dict[str, Any]] | None = None
    query_log_id: str | None = None
    feedback: Literal["positive", "negative"] | None = None
    timestamp: str = field(default_factory=_utc_now_iso)


@dataclass
class ConversationState:
    messages: list[ConversationMessage] = field(default_factory=list)
    summary: str | None = None
    total_messages: int = 0


class ConversationMemory:
    """Manage in-memory conversation context and optional summary compression."""

    def __init__(self, config: AgentsConfig, llm: BaseLLMProvider | None = None):
        self.config = config
        self.llm = llm
        self.state = ConversationState()

    def add_message(
        self,
        role: str,
        content: str,
        *,
        intent: str | None = None,
        sources: list[dict[str, Any]] | None = None,
        query_log_id: str | None = None,
        feedback: Literal["positive", "negative"] | None = None,
    ) -> None:
        self.state.messages.append(
            ConversationMessage(
                role=role,
                content=content,
                intent=intent,
                sources=sources,
                query_log_id=query_log_id,
                feedback=feedback,
            )
        )
        self.state.total_messages += 1

    def get_history_for_llm(self) -> list[dict[str, str]]:
        if self.config.max_history_messages <= 0:
            if self.config.memory_strategy == MemoryStrategy.SUMMARY and self.state.summary:
                return [{"role": "system", "content": self._summary_prefix() + self.state.summary}]
            return []
        if self.config.memory_strategy == MemoryStrategy.SLIDING_WINDOW:
            return self._sliding_window()
        return self._with_summary()

    def _sliding_window(self) -> list[dict[str, str]]:
        recent = self.state.messages[-self.config.max_history_messages :]
        return [{"role": message.role, "content": message.content} for message in recent]

    def _with_summary(self) -> list[dict[str, str]]:
        result: list[dict[str, str]] = []
        if self.state.summary:
            result.append({"role": "system", "content": self._summary_prefix() + self.state.summary})
        recent = self.state.messages[-self.config.max_history_messages :]
        result.extend({"role": message.role, "content": message.content} for message in recent)
        return result

    async def update_summary_if_needed(self) -> None:
        if (
            self.config.memory_strategy != MemoryStrategy.SUMMARY
            or self.llm is None
            or self.config.max_history_messages <= 0
            or len(self.state.messages) <= self.config.max_history_messages
        ):
            return

        overflow = self.state.messages[: -self.config.max_history_messages]
        if not overflow:
            return

        old_context = ""
        if self.state.summary:
            old_context = f"Resume precedent :\n{self.state.summary}\n\n"

        overflow_text = "\n".join(
            f"{'Utilisateur' if msg.role == 'user' else 'Assistant'}: {msg.content[:300]}"
            for msg in overflow
        )
        prompt = (
            f"{old_context}"
            f"Nouveaux messages a integrer au resume :\n{overflow_text}\n\n"
            "Genere un resume concis de l'ensemble de la conversation. "
            "Inclus les points cles, questions posees et reponses importantes."
        )
        response = await self.llm.generate(
            messages=[LLMMessage(role="user", content=prompt)],
            temperature=0.0,
            max_tokens=500,
            top_p=1.0,
        )
        self.state.summary = str(response.content or "").strip() or self.state.summary
        self.state.messages = self.state.messages[-self.config.max_history_messages :]

    def list_messages(self) -> list[ConversationMessage]:
        return list(self.state.messages)

    def set_feedback(self, query_log_id: str, feedback: Literal["positive", "negative"]) -> bool:
        for message in reversed(self.state.messages):
            if message.query_log_id == query_log_id:
                message.feedback = feedback
                return True
        return False

    def clear(self) -> None:
        self.state = ConversationState()

    def _summary_prefix(self) -> str:
        return "Resume de la conversation precedente :\n"
