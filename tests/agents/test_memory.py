from __future__ import annotations

import asyncio

from ragkit.agents.memory import ConversationMemory
from ragkit.config.agents_schema import AgentsConfig
from ragkit.llm.base import LLMResponse, LLMUsage


class _FakeSummaryLLM:
    async def generate(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        return LLMResponse(
            content="Resume compact de la conversation.",
            usage=LLMUsage(prompt_tokens=40, completion_tokens=8, total_tokens=48),
            model="fake",
            latency_ms=20,
        )

    async def stream(self, messages, temperature=0.1, max_tokens=2000, top_p=0.9):
        if False:
            yield

    async def test_connection(self):
        raise NotImplementedError


def test_memory_sliding_window_returns_last_n_messages() -> None:
    config = AgentsConfig.model_validate({"max_history_messages": 2, "memory_strategy": "sliding_window"})
    memory = ConversationMemory(config=config)
    memory.add_message("user", "one")
    memory.add_message("assistant", "two")
    memory.add_message("user", "three")
    history = memory.get_history_for_llm()
    assert len(history) == 2
    assert history[0]["content"] == "two"
    assert history[1]["content"] == "three"


def test_memory_summary_updates_and_truncates_messages() -> None:
    config = AgentsConfig.model_validate({"max_history_messages": 2, "memory_strategy": "summary"})
    memory = ConversationMemory(config=config, llm=_FakeSummaryLLM())
    memory.add_message("user", "question 1")
    memory.add_message("assistant", "answer 1")
    memory.add_message("user", "question 2")
    memory.add_message("assistant", "answer 2")
    asyncio.run(memory.update_summary_if_needed())
    assert memory.state.summary is not None
    assert len(memory.state.messages) == 2
    history = memory.get_history_for_llm()
    assert history[0]["role"] == "system"
