"""Query analyzer for intent detection and RAG routing decisions."""

from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass

from ragkit.config.agents_schema import AgentsConfig, Intent
from ragkit.llm.base import BaseLLMProvider, LLMMessage


@dataclass
class AnalysisResult:
    intent: Intent
    needs_rag: bool
    confidence: float
    reasoning: str
    latency_ms: int


class QueryAnalyzer:
    """Classify each user message into an intent and RAG requirement."""

    def __init__(self, config: AgentsConfig, llm: BaseLLMProvider):
        self.config = config
        self.llm = llm

    async def analyze(self, message: str, history: list[dict] | None = None) -> AnalysisResult:
        if self.config.always_retrieve:
            return AnalysisResult(
                intent=Intent.QUESTION,
                needs_rag=True,
                confidence=1.0,
                reasoning="always_retrieve is enabled",
                latency_ms=0,
            )

        started = time.perf_counter()
        history_str = self._format_history(history or [])
        intents_str = ", ".join(intent.value for intent in self.config.detect_intents)
        prompt = (
            self.config.prompt_analyzer.replace("{conversation_history}", history_str)
            .replace("{user_message}", message)
            .replace("{intents_list}", intents_str)
        )

        try:
            response = await asyncio.wait_for(
                self.llm.generate(
                    messages=[
                        LLMMessage(role="system", content=prompt),
                        LLMMessage(role="user", content=message),
                    ],
                    temperature=0.0,
                    max_tokens=200,
                    top_p=1.0,
                ),
                timeout=float(self.config.analyzer_timeout),
            )
            parsed = self._parse_payload(response.content)
            intent = self._normalize_intent(parsed.get("intent"))
            needs_rag = bool(parsed.get("needs_rag", self._default_needs_rag_for_intent(intent)))
            confidence = max(0.0, min(1.0, float(parsed.get("confidence", 0.5))))
            reasoning = str(parsed.get("reasoning", "") or "").strip()

            if intent not in self.config.detect_intents:
                intent = Intent.QUESTION
                needs_rag = True
                reasoning = reasoning or "Intent not enabled; fallback to question."

            latency_ms = max(1, int((time.perf_counter() - started) * 1000))
            return AnalysisResult(
                intent=intent,
                needs_rag=needs_rag,
                confidence=confidence,
                reasoning=reasoning or "Analyzer response parsed.",
                latency_ms=latency_ms,
            )
        except Exception:
            latency_ms = max(1, int((time.perf_counter() - started) * 1000))
            return AnalysisResult(
                intent=Intent.QUESTION,
                needs_rag=True,
                confidence=0.5,
                reasoning="Failed to parse analyzer response, defaulting to question",
                latency_ms=latency_ms,
            )

    def _format_history(self, history: list[dict]) -> str:
        if not history:
            return "(pas d'historique)"
        lines: list[str] = []
        for message in history[-5:]:
            role = str(message.get("role") or "")
            label = "Utilisateur" if role == "user" else "Assistant"
            content = str(message.get("content") or "").strip()[:200]
            lines.append(f"{label}: {content}")
        return "\n".join(lines)

    def _parse_payload(self, payload: str) -> dict:
        raw = (payload or "").strip()
        if raw.startswith("```"):
            raw = raw.removeprefix("```json").removeprefix("```").strip()
            if raw.endswith("```"):
                raw = raw[: -len("```")].strip()
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            raw = raw[start : end + 1]
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("Analyzer did not return an object.")
        return data

    def _normalize_intent(self, raw: object) -> Intent:
        text = str(raw or Intent.QUESTION.value).strip().lower()
        return Intent(text)

    def _default_needs_rag_for_intent(self, intent: Intent) -> bool:
        return intent in {Intent.QUESTION, Intent.CLARIFICATION}
