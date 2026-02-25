"""LLM provider factory and exports."""

from __future__ import annotations

from ragkit.config.llm_schema import LLMConfig, LLMProvider
from ragkit.llm.base import BaseLLMProvider
from ragkit.llm.providers import AnthropicProvider, DeepSeekProvider, MistralProvider, OllamaProvider, OpenAIProvider


def create_llm_provider(config: LLMConfig, api_key: str | None = None) -> BaseLLMProvider:
    if config.provider == LLMProvider.OPENAI:
        if not api_key:
            raise ValueError("OpenAI API key is required.")
        return OpenAIProvider(config, api_key)
    if config.provider == LLMProvider.ANTHROPIC:
        if not api_key:
            raise ValueError("Anthropic API key is required.")
        return AnthropicProvider(config, api_key)
    if config.provider == LLMProvider.MISTRAL:
        if not api_key:
            raise ValueError("Mistral API key is required.")
        return MistralProvider(config, api_key)
    if config.provider == LLMProvider.DEEPSEEK:
        if not api_key:
            raise ValueError("DeepSeek API key is required.")
        return DeepSeekProvider(config, api_key)
    if config.provider == LLMProvider.OLLAMA:
        return OllamaProvider(config)
    raise ValueError(f"Unsupported LLM provider: {config.provider}")


__all__ = [
    "AnthropicProvider",
    "BaseLLMProvider",
    "DeepSeekProvider",
    "MistralProvider",
    "OllamaProvider",
    "OpenAIProvider",
    "create_llm_provider",
]
