"""Pydantic schemas for LLM generation configuration and chat APIs."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator

from ragkit.config.retrieval_schema import SearchFilters, SearchType


class LLMProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    OLLAMA = "ollama"
    MISTRAL = "mistral"


class CitationFormat(str, Enum):
    INLINE = "inline"
    FOOTNOTE = "footnote"


class ResponseLanguage(str, Enum):
    AUTO = "auto"
    FR = "fr"
    EN = "en"


DEFAULT_SYSTEM_PROMPT = """Tu es un assistant specialise dans l'analyse de documents. Tu reponds aux questions en te basant UNIQUEMENT sur le contexte fourni entre les balises <context> et </context>.

Regles :
1. Base ta reponse exclusivement sur le contexte fourni. Ne genere jamais d'information qui ne s'y trouve pas.
2. Cite tes sources en utilisant le format {citation_format_instruction} apres chaque affirmation importante.
3. Si l'information demandee n'est pas dans le contexte, dis-le honnetement en utilisant la phrase : "{uncertainty_phrase}".
4. Reponds dans la langue de la question, sauf indication contraire.
5. Structure ta reponse de maniere claire avec des paragraphes, listes ou titres si necessaire.
6. Si plusieurs sources se contredisent, signale-le explicitement."""


class LLMConfig(BaseModel):
    """LLM generation configuration."""

    provider: LLMProvider = LLMProvider.OPENAI
    model: str = "gpt-4o-mini"
    api_key_set: bool = False

    # Generation.
    temperature: float = Field(default=0.1, ge=0.0, le=2.0)
    max_tokens: int = Field(default=2000, ge=100, le=16384)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)

    # Behavior.
    cite_sources: bool = True
    citation_format: CitationFormat = CitationFormat.INLINE
    admit_uncertainty: bool = True
    uncertainty_phrase: str = "Je n'ai pas trouve cette information dans les documents disponibles."
    response_language: ResponseLanguage = ResponseLanguage.AUTO

    # Context.
    context_max_chunks: int = Field(default=5, ge=1, le=30)
    context_max_tokens: int = Field(default=4000, ge=500, le=32000)

    # Prompt.
    system_prompt: str = DEFAULT_SYSTEM_PROMPT

    # Advanced.
    timeout: int = Field(default=60, ge=10, le=300)
    max_retries: int = Field(default=2, ge=0, le=5)
    streaming: bool = True
    debug_default: bool = False

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_fields(cls, data):
        if not isinstance(data, dict):
            return data
        normalized = dict(data)

        provider = str(normalized.get("provider", "openai")).strip().lower()
        provider_aliases = {
            "openai": LLMProvider.OPENAI.value,
            "anthropic": LLMProvider.ANTHROPIC.value,
            "claude": LLMProvider.ANTHROPIC.value,
            "ollama": LLMProvider.OLLAMA.value,
            "mistral": LLMProvider.MISTRAL.value,
            "mistralai": LLMProvider.MISTRAL.value,
        }
        normalized["provider"] = provider_aliases.get(provider, provider)

        for key, default in {
            "temperature": 0.1,
            "max_tokens": 2000,
            "top_p": 0.9,
            "cite_sources": True,
            "citation_format": CitationFormat.INLINE.value,
            "admit_uncertainty": True,
            "uncertainty_phrase": "Je n'ai pas trouve cette information dans les documents disponibles.",
            "response_language": ResponseLanguage.AUTO.value,
            "context_max_chunks": 5,
            "context_max_tokens": 4000,
            "system_prompt": DEFAULT_SYSTEM_PROMPT,
            "timeout": 60,
            "max_retries": 2,
            "streaming": True,
            "debug_default": False,
        }.items():
            if normalized.get(key) is None:
                normalized[key] = default

        model = normalized.get("model")
        if model is None or not str(model).strip():
            normalized["model"] = default_model_for_provider(
                LLMProvider(normalized["provider"])
            )
        else:
            normalized["model"] = str(model).strip()

        return normalized

    @field_validator("uncertainty_phrase", "system_prompt")
    @classmethod
    def strip_non_empty_text(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("Field cannot be empty.")
        return text

    @model_validator(mode="after")
    def validate_context_limits(self) -> "LLMConfig":
        if self.context_max_tokens < self.context_max_chunks * 50:
            raise ValueError("context_max_tokens is too small for the configured context_max_chunks.")
        return self


class LLMModelInfo(BaseModel):
    id: str
    name: str
    provider: LLMProvider
    context_window: int
    cost_input: str | None = None
    cost_output: str | None = None
    languages: str = "multilingual"
    quality_rating: int = Field(ge=1, le=5)
    latency_hint: str | None = None
    local: bool = False


class LLMTestResult(BaseModel):
    success: bool
    model: str
    response_text: str
    latency_ms: int
    error: str | None = None


class ChatQuery(BaseModel):
    """Complete chat query - triggers retrieval + generation pipeline."""

    query: str = Field(..., min_length=1, max_length=5000)
    search_type: SearchType | None = None
    alpha: float | None = Field(default=None, ge=0.0, le=1.0)
    filters: SearchFilters | None = None
    include_debug: bool = False

    @field_validator("query")
    @classmethod
    def validate_query(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Query must not be empty.")
        return cleaned


class ChatSource(BaseModel):
    id: int
    chunk_id: str
    title: str
    path: str | None
    page: int | None
    score: float
    text_preview: str


class ChatDebugInfo(BaseModel):
    retrieval_latency_ms: int
    search_type: str
    chunks_retrieved: int
    reranking_applied: bool

    context_chunks: int
    context_tokens: int
    context_truncated: bool

    model: str
    temperature: float
    prompt_tokens: int
    completion_tokens: int
    time_to_first_token_ms: int
    total_latency_ms: int
    estimated_cost_usd: float | None
    sources_detail: list[dict[str, Any]] = Field(default_factory=list)

    # Optional extra for troubleshooting.
    prompt_preview: str | None = None


class ChatResponse(BaseModel):
    query: str
    answer: str
    sources: list[ChatSource] = Field(default_factory=list)
    search_type: str
    debug: ChatDebugInfo | None = None


OPENAI_MODELS: list[LLMModelInfo] = [
    LLMModelInfo(
        id="gpt-4o-mini",
        name="GPT-4o Mini",
        provider=LLMProvider.OPENAI,
        context_window=128_000,
        cost_input="$0.15 / 1M",
        cost_output="$0.60 / 1M",
        languages="multilingual",
        quality_rating=4,
        latency_hint="~500-1500 ms first token",
    ),
    LLMModelInfo(
        id="gpt-4o",
        name="GPT-4o",
        provider=LLMProvider.OPENAI,
        context_window=128_000,
        cost_input="$2.50 / 1M",
        cost_output="$10.00 / 1M",
        languages="multilingual",
        quality_rating=5,
        latency_hint="~700-2000 ms first token",
    ),
]

ANTHROPIC_MODELS: list[LLMModelInfo] = [
    LLMModelInfo(
        id="claude-3-5-sonnet-20241022",
        name="Claude 3.5 Sonnet",
        provider=LLMProvider.ANTHROPIC,
        context_window=200_000,
        cost_input="$3.00 / 1M",
        cost_output="$15.00 / 1M",
        languages="multilingual",
        quality_rating=5,
        latency_hint="~700-2200 ms first token",
    ),
    LLMModelInfo(
        id="claude-3-haiku-20240307",
        name="Claude 3 Haiku",
        provider=LLMProvider.ANTHROPIC,
        context_window=200_000,
        cost_input="$0.25 / 1M",
        cost_output="$1.25 / 1M",
        languages="multilingual",
        quality_rating=4,
        latency_hint="~400-1200 ms first token",
    ),
]

OLLAMA_MODELS: list[LLMModelInfo] = [
    LLMModelInfo(
        id="llama3",
        name="Llama 3 (Ollama)",
        provider=LLMProvider.OLLAMA,
        context_window=8192,
        languages="multilingual",
        quality_rating=3,
        latency_hint="depends on local hardware",
        local=True,
    ),
    LLMModelInfo(
        id="mistral",
        name="Mistral (Ollama)",
        provider=LLMProvider.OLLAMA,
        context_window=8192,
        languages="multilingual",
        quality_rating=3,
        latency_hint="depends on local hardware",
        local=True,
    ),
    LLMModelInfo(
        id="phi3",
        name="Phi-3 (Ollama)",
        provider=LLMProvider.OLLAMA,
        context_window=4096,
        languages="multilingual",
        quality_rating=3,
        latency_hint="depends on local hardware",
        local=True,
    ),
]

MISTRAL_MODELS: list[LLMModelInfo] = [
    LLMModelInfo(
        id="mistral-small-latest",
        name="Mistral Small Latest",
        provider=LLMProvider.MISTRAL,
        context_window=32_000,
        cost_input="$0.20 / 1M",
        cost_output="$0.60 / 1M",
        languages="multilingual",
        quality_rating=4,
        latency_hint="~600-1600 ms first token",
    ),
    LLMModelInfo(
        id="mistral-large-latest",
        name="Mistral Large Latest",
        provider=LLMProvider.MISTRAL,
        context_window=128_000,
        cost_input="$2.00 / 1M",
        cost_output="$6.00 / 1M",
        languages="multilingual",
        quality_rating=5,
        latency_hint="~800-2200 ms first token",
    ),
]


def model_catalog_for_provider(provider: LLMProvider) -> list[LLMModelInfo]:
    if provider == LLMProvider.OPENAI:
        return OPENAI_MODELS
    if provider == LLMProvider.ANTHROPIC:
        return ANTHROPIC_MODELS
    if provider == LLMProvider.OLLAMA:
        return OLLAMA_MODELS
    if provider == LLMProvider.MISTRAL:
        return MISTRAL_MODELS
    return []


def default_model_for_provider(provider: LLMProvider) -> str:
    catalog = model_catalog_for_provider(provider)
    if catalog:
        return catalog[0].id
    return "gpt-4o-mini"

