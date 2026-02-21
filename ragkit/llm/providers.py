"""Concrete LLM providers (OpenAI, Anthropic, Ollama, Mistral)."""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any, AsyncIterator

import httpx

from ragkit.config.llm_schema import LLMConfig
from ragkit.llm.base import (
    BaseLLMProvider,
    LLMMessage,
    LLMResponse,
    LLMStreamChunk,
    LLMTestResult,
    LLMUsage,
)

_TRANSIENT_HTTP_CODES = {408, 409, 425, 429, 500, 502, 503, 504}


def _usage_from_dict(data: dict[str, Any] | None) -> LLMUsage:
    payload = data or {}
    prompt = int(payload.get("prompt_tokens") or payload.get("input_tokens") or 0)
    completion = int(payload.get("completion_tokens") or payload.get("output_tokens") or 0)
    total = int(payload.get("total_tokens") or (prompt + completion))
    return LLMUsage(prompt_tokens=prompt, completion_tokens=completion, total_tokens=total)


def _fallback_usage(prompt_text: str, completion_text: str) -> LLMUsage:
    prompt_tokens = max(1, len(prompt_text.split()))
    completion_tokens = max(1, len(completion_text.split())) if completion_text.strip() else 0
    return LLMUsage(
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
    )


async def _post_with_retries(
    *,
    client: httpx.AsyncClient,
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any],
    max_retries: int,
) -> httpx.Response:
    last_error: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as exc:
            last_error = exc
            if exc.response.status_code not in _TRANSIENT_HTTP_CODES or attempt >= max_retries:
                raise
        except (httpx.TimeoutException, httpx.RequestError) as exc:
            last_error = exc
            if attempt >= max_retries:
                raise
        await asyncio.sleep(min(0.25 * (2**attempt), 2.0))
    if last_error is not None:
        raise last_error
    raise RuntimeError("Unexpected retry failure")


class OpenAIProvider(BaseLLMProvider):
    API_URL = "https://api.openai.com/v1/chat/completions"

    def __init__(self, config: LLMConfig, api_key: str):
        self.config = config
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _messages_payload(self, messages: list[LLMMessage]) -> list[dict[str, str]]:
        return [{"role": msg.role, "content": msg.content} for msg in messages]

    async def generate(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.1,
        max_tokens: int = 2000,
        top_p: float = 0.9,
    ) -> LLMResponse:
        started = time.perf_counter()
        payload = {
            "model": self.config.model,
            "messages": self._messages_payload(messages),
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(float(self.config.timeout))) as client:
            response = await _post_with_retries(
                client=client,
                url=self.API_URL,
                headers=self._headers(),
                payload=payload,
                max_retries=self.config.max_retries,
            )
        data = response.json()
        choices = data.get("choices", []) if isinstance(data, dict) else []
        content = ""
        if choices and isinstance(choices[0], dict):
            message = choices[0].get("message", {})
            if isinstance(message, dict):
                content = str(message.get("content", "") or "")
        usage = _usage_from_dict(data.get("usage") if isinstance(data, dict) else None)
        if usage.total_tokens <= 0:
            usage = _fallback_usage(" ".join(msg.content for msg in messages), content)
        latency_ms = max(1, int((time.perf_counter() - started) * 1000))
        return LLMResponse(content=content, usage=usage, model=self.config.model, latency_ms=latency_ms)

    async def stream(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.1,
        max_tokens: int = 2000,
        top_p: float = 0.9,
    ) -> AsyncIterator[LLMStreamChunk]:
        payload = {
            "model": self.config.model,
            "messages": self._messages_payload(messages),
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        started = time.perf_counter()
        first_token_latency: int | None = None
        usage: LLMUsage | None = None
        full_text_parts: list[str] = []
        async with httpx.AsyncClient(timeout=httpx.Timeout(float(self.config.timeout))) as client:
            async with client.stream("POST", self.API_URL, headers=self._headers(), json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        packet = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    if not isinstance(packet, dict):
                        continue
                    packet_usage = packet.get("usage")
                    if isinstance(packet_usage, dict):
                        usage = _usage_from_dict(packet_usage)
                    choices = packet.get("choices", [])
                    if not choices or not isinstance(choices[0], dict):
                        continue
                    delta = choices[0].get("delta", {})
                    if not isinstance(delta, dict):
                        continue
                    token = str(delta.get("content", "") or "")
                    if not token:
                        continue
                    full_text_parts.append(token)
                    if first_token_latency is None:
                        first_token_latency = max(1, int((time.perf_counter() - started) * 1000))
                    yield LLMStreamChunk(content=token, is_final=False, usage=None, latency_ms=first_token_latency)
        full_text = "".join(full_text_parts)
        if usage is None or usage.total_tokens <= 0:
            usage = _fallback_usage(" ".join(msg.content for msg in messages), full_text)
        yield LLMStreamChunk(
            content="",
            is_final=True,
            usage=usage,
            latency_ms=first_token_latency or max(1, int((time.perf_counter() - started) * 1000)),
        )

    async def test_connection(self) -> LLMTestResult:
        started = time.perf_counter()
        try:
            response = await self.generate(
                messages=[LLMMessage(role="user", content="Reply with: ok")],
                temperature=0.0,
                max_tokens=16,
                top_p=1.0,
            )
            latency_ms = max(1, int((time.perf_counter() - started) * 1000))
            return LLMTestResult(
                success=True,
                model=self.config.model,
                response_text=response.content[:120],
                latency_ms=latency_ms,
            )
        except Exception as exc:
            return LLMTestResult(
                success=False,
                model=self.config.model,
                response_text="",
                latency_ms=0,
                error=str(exc),
            )


class MistralProvider(OpenAIProvider):
    API_URL = "https://api.mistral.ai/v1/chat/completions"


class AnthropicProvider(BaseLLMProvider):
    API_URL = "https://api.anthropic.com/v1/messages"
    API_VERSION = "2023-06-01"

    def __init__(self, config: LLMConfig, api_key: str):
        self.config = config
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": self.API_VERSION,
            "content-type": "application/json",
        }

    def _to_payload_messages(self, messages: list[LLMMessage]) -> tuple[str | None, list[dict[str, str]]]:
        system_parts: list[str] = []
        payload_messages: list[dict[str, str]] = []
        for message in messages:
            if message.role == "system":
                system_parts.append(message.content)
            else:
                role = "assistant" if message.role == "assistant" else "user"
                payload_messages.append({"role": role, "content": message.content})
        system_prompt = "\n\n".join(part for part in system_parts if part.strip()) or None
        return system_prompt, payload_messages

    async def generate(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.1,
        max_tokens: int = 2000,
        top_p: float = 0.9,
    ) -> LLMResponse:
        started = time.perf_counter()
        system_prompt, payload_messages = self._to_payload_messages(messages)
        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": payload_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
            "stream": False,
        }
        if system_prompt:
            payload["system"] = system_prompt
        async with httpx.AsyncClient(timeout=httpx.Timeout(float(self.config.timeout))) as client:
            response = await _post_with_retries(
                client=client,
                url=self.API_URL,
                headers=self._headers(),
                payload=payload,
                max_retries=self.config.max_retries,
            )
        data = response.json()
        content_blocks = data.get("content", []) if isinstance(data, dict) else []
        text_parts: list[str] = []
        if isinstance(content_blocks, list):
            for block in content_blocks:
                if isinstance(block, dict) and block.get("type") == "text":
                    text_parts.append(str(block.get("text", "") or ""))
        content = "".join(text_parts)
        usage = _usage_from_dict(data.get("usage") if isinstance(data, dict) else None)
        if usage.total_tokens <= 0:
            usage = _fallback_usage(" ".join(msg.content for msg in messages), content)
        latency_ms = max(1, int((time.perf_counter() - started) * 1000))
        return LLMResponse(content=content, usage=usage, model=self.config.model, latency_ms=latency_ms)

    async def stream(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.1,
        max_tokens: int = 2000,
        top_p: float = 0.9,
    ) -> AsyncIterator[LLMStreamChunk]:
        system_prompt, payload_messages = self._to_payload_messages(messages)
        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": payload_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
            "stream": True,
        }
        if system_prompt:
            payload["system"] = system_prompt

        started = time.perf_counter()
        first_token_latency: int | None = None
        prompt_tokens = 0
        completion_tokens = 0
        full_text_parts: list[str] = []

        async with httpx.AsyncClient(timeout=httpx.Timeout(float(self.config.timeout))) as client:
            async with client.stream("POST", self.API_URL, headers=self._headers(), json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        packet = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    if not isinstance(packet, dict):
                        continue
                    packet_type = str(packet.get("type", ""))
                    if packet_type == "message_start":
                        usage = packet.get("message", {}).get("usage", {})
                        if isinstance(usage, dict):
                            prompt_tokens = int(usage.get("input_tokens") or prompt_tokens)
                    elif packet_type == "message_delta":
                        usage = packet.get("usage", {})
                        if isinstance(usage, dict):
                            completion_tokens = int(usage.get("output_tokens") or completion_tokens)
                    elif packet_type == "content_block_delta":
                        delta = packet.get("delta", {})
                        token = str(delta.get("text", "") if isinstance(delta, dict) else "")
                        if token:
                            full_text_parts.append(token)
                            if first_token_latency is None:
                                first_token_latency = max(1, int((time.perf_counter() - started) * 1000))
                            yield LLMStreamChunk(
                                content=token,
                                is_final=False,
                                usage=None,
                                latency_ms=first_token_latency,
                            )

        full_text = "".join(full_text_parts)
        usage = LLMUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens or max(1, len(full_text.split())),
            total_tokens=(prompt_tokens + (completion_tokens or max(1, len(full_text.split())))),
        )
        if usage.total_tokens <= 0:
            usage = _fallback_usage(" ".join(msg.content for msg in messages), full_text)
        yield LLMStreamChunk(
            content="",
            is_final=True,
            usage=usage,
            latency_ms=first_token_latency or max(1, int((time.perf_counter() - started) * 1000)),
        )

    async def test_connection(self) -> LLMTestResult:
        started = time.perf_counter()
        try:
            response = await self.generate(
                messages=[LLMMessage(role="user", content="Reply with: ok")],
                temperature=0.0,
                max_tokens=16,
                top_p=1.0,
            )
            latency_ms = max(1, int((time.perf_counter() - started) * 1000))
            return LLMTestResult(
                success=True,
                model=self.config.model,
                response_text=response.content[:120],
                latency_ms=latency_ms,
            )
        except Exception as exc:
            return LLMTestResult(
                success=False,
                model=self.config.model,
                response_text="",
                latency_ms=0,
                error=str(exc),
            )


class OllamaProvider(BaseLLMProvider):
    API_CHAT_URL = "http://127.0.0.1:11434/api/chat"
    API_TAGS_URL = "http://127.0.0.1:11434/api/tags"

    def __init__(self, config: LLMConfig):
        self.config = config

    def _messages_payload(self, messages: list[LLMMessage]) -> list[dict[str, str]]:
        mapped: list[dict[str, str]] = []
        for message in messages:
            role = message.role
            if role not in {"system", "user", "assistant"}:
                role = "user"
            mapped.append({"role": role, "content": message.content})
        return mapped

    async def generate(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.1,
        max_tokens: int = 2000,
        top_p: float = 0.9,
    ) -> LLMResponse:
        started = time.perf_counter()
        payload = {
            "model": self.config.model,
            "messages": self._messages_payload(messages),
            "stream": False,
            "options": {
                "temperature": temperature,
                "top_p": top_p,
                "num_predict": max_tokens,
            },
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(float(self.config.timeout))) as client:
            response = await client.post(self.API_CHAT_URL, json=payload)
            response.raise_for_status()
            data = response.json()
        message = data.get("message", {}) if isinstance(data, dict) else {}
        content = str(message.get("content", "") if isinstance(message, dict) else "")
        usage = LLMUsage(
            prompt_tokens=int(data.get("prompt_eval_count") or 0) if isinstance(data, dict) else 0,
            completion_tokens=int(data.get("eval_count") or 0) if isinstance(data, dict) else 0,
            total_tokens=0,
        )
        usage.total_tokens = usage.prompt_tokens + usage.completion_tokens
        if usage.total_tokens <= 0:
            usage = _fallback_usage(" ".join(msg.content for msg in messages), content)
        latency_ms = max(1, int((time.perf_counter() - started) * 1000))
        return LLMResponse(content=content, usage=usage, model=self.config.model, latency_ms=latency_ms)

    async def stream(
        self,
        messages: list[LLMMessage],
        temperature: float = 0.1,
        max_tokens: int = 2000,
        top_p: float = 0.9,
    ) -> AsyncIterator[LLMStreamChunk]:
        payload = {
            "model": self.config.model,
            "messages": self._messages_payload(messages),
            "stream": True,
            "options": {
                "temperature": temperature,
                "top_p": top_p,
                "num_predict": max_tokens,
            },
        }
        started = time.perf_counter()
        first_token_latency: int | None = None
        prompt_tokens = 0
        completion_tokens = 0
        full_text_parts: list[str] = []
        async with httpx.AsyncClient(timeout=httpx.Timeout(float(self.config.timeout))) as client:
            async with client.stream("POST", self.API_CHAT_URL, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        packet = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if not isinstance(packet, dict):
                        continue
                    message = packet.get("message", {})
                    token = str(message.get("content", "") if isinstance(message, dict) else "")
                    if token:
                        full_text_parts.append(token)
                        if first_token_latency is None:
                            first_token_latency = max(1, int((time.perf_counter() - started) * 1000))
                        yield LLMStreamChunk(content=token, is_final=False, latency_ms=first_token_latency)
                    if packet.get("done") is True:
                        prompt_tokens = int(packet.get("prompt_eval_count") or prompt_tokens)
                        completion_tokens = int(packet.get("eval_count") or completion_tokens)
                        break
        full_text = "".join(full_text_parts)
        usage = LLMUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        )
        if usage.total_tokens <= 0:
            usage = _fallback_usage(" ".join(msg.content for msg in messages), full_text)
        yield LLMStreamChunk(
            content="",
            is_final=True,
            usage=usage,
            latency_ms=first_token_latency or max(1, int((time.perf_counter() - started) * 1000)),
        )

    async def test_connection(self) -> LLMTestResult:
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(min(float(self.config.timeout), 15.0))) as client:
                response = await client.get(self.API_TAGS_URL)
                response.raise_for_status()
                data = response.json()
                
            models = [m.get("name") for m in data.get("models", [])]
            if self.config.model not in models:
                return LLMTestResult(
                    success=False,
                    model=self.config.model,
                    response_text="",
                    latency_ms=0,
                    error=f"Modèle '{self.config.model}' non installé dans Ollama.",
                )
                
            latency_ms = max(1, int((time.perf_counter() - started) * 1000))
            return LLMTestResult(
                success=True,
                model=self.config.model,
                response_text="Connexion réussie",
                latency_ms=latency_ms,
            )
        except Exception as exc:
            return LLMTestResult(
                success=False,
                model=self.config.model,
                response_text="",
                latency_ms=0,
                error=f"Impossible de joindre Ollama: {str(exc)}",
            )
