"""Query rewriter for multi-turn RAG conversations."""

from __future__ import annotations

import time
from dataclasses import dataclass

from ragkit.config.agents_schema import AgentsConfig
from ragkit.llm.base import BaseLLMProvider, LLMMessage


@dataclass
class RewriteResult:
    original_query: str
    rewritten_queries: list[str]
    latency_ms: int


class QueryRewriter:
    """Reformulate user queries into standalone retrieval-friendly forms."""

    def __init__(self, config: AgentsConfig, llm: BaseLLMProvider):
        self.config = config
        self.llm = llm

    async def rewrite(self, query: str, history: list[dict] | None = None) -> RewriteResult:
        if not self.config.query_rewriting.enabled or self.config.query_rewriting.num_rewrites <= 0:
            return RewriteResult(
                original_query=query,
                rewritten_queries=[query],
                latency_ms=0,
            )

        started = time.perf_counter()
        history_str = self._format_history(history or [])
        rewritten: list[str] = []

        for _ in range(self.config.query_rewriting.num_rewrites):
            prompt = (
                self.config.prompt_rewriting.replace("{conversation_history}", history_str)
                .replace("{user_query}", query)
            )
            response = await self.llm.generate(
                messages=[LLMMessage(role="user", content=prompt)],
                temperature=0.0,
                max_tokens=200,
                top_p=1.0,
            )
            candidate = str(response.content or "").strip().strip('"').strip("'")
            if candidate:
                rewritten.append(candidate)

        deduped: list[str] = []
        seen: set[str] = set()
        for candidate in rewritten:
            normalized = candidate.strip()
            key = normalized.casefold()
            if not normalized or key in seen:
                continue
            seen.add(key)
            deduped.append(normalized)

        latency_ms = max(1, int((time.perf_counter() - started) * 1000))
        if not deduped:
            deduped = [query]

        return RewriteResult(
            original_query=query,
            rewritten_queries=deduped,
            latency_ms=latency_ms,
        )

    def _format_history(self, history: list[dict]) -> str:
        if not history:
            return "(pas d'historique)"
        lines: list[str] = []
        for message in history[-6:]:
            role = str(message.get("role") or "")
            label = "Utilisateur" if role == "user" else "Assistant"
            content = str(message.get("content") or "").strip()[:200]
            lines.append(f"{label}: {content}")
        return "\n".join(lines)
