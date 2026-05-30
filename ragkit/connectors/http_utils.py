"""Retryable async HTTP client for connectors.

Wraps ``httpx.AsyncClient`` with:
- Exponential back-off with jitter (3 attempts by default)
- Automatic ``429 Too Many Requests`` handling via ``Retry-After``
- Configurable concurrency semaphore
- Structured logging of every attempt
"""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Module-level semaphore shared by all connectors to cap total concurrency.
_global_semaphore: asyncio.Semaphore | None = None
_SEMAPHORE_LIMIT = 10


def _get_semaphore() -> asyncio.Semaphore:
    global _global_semaphore
    if _global_semaphore is None:
        _global_semaphore = asyncio.Semaphore(_SEMAPHORE_LIMIT)
    return _global_semaphore


class RetryableHttpClient:
    """Thin wrapper around :class:`httpx.AsyncClient` adding retry logic.

    Parameters
    ----------
    max_retries:
        Maximum number of retry attempts (excluding the first call).
    backoff_factor:
        Multiplier for the exponential wait between retries (seconds).
    max_backoff:
        Upper bound on the wait between retries (seconds).
    timeout:
        Default request timeout in seconds.
    headers:
        Default headers applied to every request.
    retryable_status_codes:
        HTTP status codes that trigger a retry (in addition to ``429``).
    follow_redirects:
        Whether to follow HTTP redirects.
    """

    def __init__(
        self,
        *,
        max_retries: int = 3,
        backoff_factor: float = 1.0,
        max_backoff: float = 60.0,
        timeout: float = 30.0,
        headers: dict[str, str] | None = None,
        retryable_status_codes: set[int] | None = None,
        follow_redirects: bool = True,
    ) -> None:
        self.max_retries = max(0, max_retries)
        self.backoff_factor = backoff_factor
        self.max_backoff = max_backoff
        self.timeout = timeout
        self.default_headers = headers or {}
        self.retryable_status_codes = retryable_status_codes or {429, 500, 502, 503, 504}
        self.follow_redirects = follow_redirects

    async def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
        json: Any | None = None,
        data: Any | None = None,
        content: bytes | None = None,
        timeout: float | None = None,
    ) -> httpx.Response:
        """Execute an HTTP request with automatic retries."""
        merged_headers = {**self.default_headers, **(headers or {})}
        effective_timeout = timeout if timeout is not None else self.timeout
        sem = _get_semaphore()

        last_exc: Exception | None = None
        for attempt in range(1 + self.max_retries):
            async with sem:
                try:
                    async with httpx.AsyncClient(
                        timeout=effective_timeout,
                        follow_redirects=self.follow_redirects,
                    ) as client:
                        response = await client.request(
                            method,
                            url,
                            headers=merged_headers,
                            params=params,
                            json=json,
                            data=data,
                            content=content,
                        )
                except (httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout, httpx.PoolTimeout) as exc:
                    last_exc = exc
                    if attempt < self.max_retries:
                        wait = self._backoff(attempt)
                        logger.warning(
                            "HTTP %s %s attempt %d failed (%s), retrying in %.1fs",
                            method, url, attempt + 1, exc, wait,
                        )
                        await asyncio.sleep(wait)
                        continue
                    raise
                except Exception:
                    raise

                if response.status_code == 429 and attempt < self.max_retries:
                    wait = self._retry_after(response, attempt)
                    logger.warning(
                        "HTTP %s %s returned 429, retrying in %.1fs (attempt %d/%d)",
                        method, url, wait, attempt + 1, self.max_retries + 1,
                    )
                    await asyncio.sleep(wait)
                    continue

                if response.status_code in self.retryable_status_codes and attempt < self.max_retries:
                    wait = self._backoff(attempt)
                    logger.warning(
                        "HTTP %s %s returned %d, retrying in %.1fs (attempt %d/%d)",
                        method, url, response.status_code, wait,
                        attempt + 1, self.max_retries + 1,
                    )
                    await asyncio.sleep(wait)
                    continue

                return response

        # Should not be reached but satisfies the type checker.
        if last_exc is not None:
            raise last_exc
        raise RuntimeError("Retry loop exhausted without a response")

    # Convenience wrappers

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self.request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self.request("POST", url, **kwargs)

    async def head(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self.request("HEAD", url, **kwargs)

    # Internal helpers

    def _backoff(self, attempt: int) -> float:
        wait = self.backoff_factor * (2 ** attempt)
        jitter = random.uniform(0, wait * 0.25)
        return min(wait + jitter, self.max_backoff)

    def _retry_after(self, response: httpx.Response, attempt: int) -> float:
        header = response.headers.get("retry-after", "")
        if header:
            try:
                return min(float(header), self.max_backoff)
            except ValueError:
                pass
        return self._backoff(attempt)
