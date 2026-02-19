"""Pydantic schemas for agents orchestration settings and chat payloads."""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from ragkit.config.llm_schema import ChatSource

DEFAULT_ANALYZER_PROMPT = """Tu es un analyseur de requetes. Ta tache est de classifier le message de l'utilisateur
et de decider si une recherche dans la base documentaire est necessaire.

Contexte de la conversation (derniers messages) :
{conversation_history}

Message de l'utilisateur : "{user_message}"

Intentions possibles : {intents_list}

Reponds UNIQUEMENT en JSON avec ce format :
{
  "intent": "question|greeting|chitchat|out_of_scope|clarification",
  "needs_rag": true|false,
  "confidence": 0.0-1.0,
  "reasoning": "Explication courte de ta decision"
}

- En cas de doute, prefere "question" avec needs_rag=true."""

DEFAULT_REWRITING_PROMPT = """Tu es un reformulateur de requetes pour un systeme de recherche documentaire.
Ta tache est de reformuler la requete de l'utilisateur pour ameliorer la recherche.

Contexte de la conversation :
{conversation_history}

Requete originale : "{user_query}"

Reformule cette requete en :
1. Resolvant les pronoms et references contextuelles ("il", "ca", "celui-ci")
2. Ajoutant le contexte implicite de la conversation
3. Rendant la requete autonome et comprehensible sans l'historique
4. Gardant la meme intention et le meme perimetre

Reponds UNIQUEMENT avec la requete reformulee, sans explication."""

DEFAULT_GREETING_PROMPT = """Tu es un assistant documentaire amical. L'utilisateur te salue ou fait une formule
de politesse. Reponds de maniere chaleureuse et concise, en rappelant brievement
que tu es la pour repondre aux questions sur ses documents.
Langue de reponse : {response_language}."""

DEFAULT_OOS_PROMPT = """Tu es un assistant documentaire. L'utilisateur pose une question qui ne concerne
pas les documents de sa base. Informe-le poliment que cette question est hors de
ton perimetre et invite-le a poser une question sur ses documents.
Ne tente PAS de repondre a la question.
Langue de reponse : {response_language}."""


class MemoryStrategy(str, Enum):
    SLIDING_WINDOW = "sliding_window"
    SUMMARY = "summary"


class Intent(str, Enum):
    QUESTION = "question"
    GREETING = "greeting"
    CHITCHAT = "chitchat"
    OUT_OF_SCOPE = "out_of_scope"
    CLARIFICATION = "clarification"


class QueryRewritingConfig(BaseModel):
    enabled: bool = True
    num_rewrites: int = Field(default=1, ge=0, le=5)


class AgentsConfig(BaseModel):
    """Agents & orchestration configuration."""

    always_retrieve: bool = False
    detect_intents: list[Intent] = Field(
        default_factory=lambda: [
            Intent.QUESTION,
            Intent.GREETING,
            Intent.CHITCHAT,
            Intent.OUT_OF_SCOPE,
        ]
    )

    query_rewriting: QueryRewritingConfig = Field(default_factory=QueryRewritingConfig)

    max_history_messages: int = Field(default=10, ge=0, le=50)
    memory_strategy: MemoryStrategy = MemoryStrategy.SLIDING_WINDOW

    prompt_analyzer: str = DEFAULT_ANALYZER_PROMPT
    prompt_rewriting: str = DEFAULT_REWRITING_PROMPT
    prompt_greeting: str = DEFAULT_GREETING_PROMPT
    prompt_out_of_scope: str = DEFAULT_OOS_PROMPT

    analyzer_model: str | None = None
    analyzer_timeout: int = Field(default=15, ge=5, le=60)
    debug_default: bool = False

    @field_validator("prompt_analyzer", "prompt_rewriting", "prompt_greeting", "prompt_out_of_scope")
    @classmethod
    def non_empty_prompt(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("Prompt cannot be empty.")
        return text

    @model_validator(mode="after")
    def ensure_question_intent(self) -> "AgentsConfig":
        intents = list(dict.fromkeys(self.detect_intents))
        if Intent.QUESTION not in intents:
            intents.insert(0, Intent.QUESTION)
        self.detect_intents = intents
        return self


class OrchestratorDebugInfo(BaseModel):
    intent: str
    intent_confidence: float
    intent_reasoning: str
    analyzer_latency_ms: int

    original_query: str
    rewritten_queries: list[str] = Field(default_factory=list)
    rewriting_latency_ms: int

    history_messages: int
    history_strategy: str
    history_tokens: int | None = None

    retrieval_debug: dict[str, Any] | None = None
    generation_debug: dict[str, Any] | None = None

    total_latency_ms: int


class OrchestratedChatResponse(BaseModel):
    query: str
    answer: str
    sources: list[ChatSource] = Field(default_factory=list)
    intent: str
    needs_rag: bool
    rewritten_query: str | None = None
    query_log_id: str | None = None
    debug: OrchestratorDebugInfo | None = None


class ConversationMessageDTO(BaseModel):
    role: str
    content: str
    intent: str | None = None
    sources: list[ChatSource] | None = None
    query_log_id: str | None = None
    feedback: Literal["positive", "negative"] | None = None
    timestamp: str


class ConversationHistory(BaseModel):
    messages: list[ConversationMessageDTO] = Field(default_factory=list)
    total_messages: int = 0
    has_summary: bool = False
