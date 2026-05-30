"""Tests for the retryable HTTP client."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from ragkit.connectors.http_utils import RetryableHttpClient


@pytest.fixture
def client() -> RetryableHttpClient:
    return RetryableHttpClient(max_retries=2, backoff_factor=0.01, timeout=5.0)


def _mock_response(status_code: int = 200, headers: dict | None = None, json_data: dict | None = None) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code
    resp.headers = headers or {}
    resp.json.return_value = json_data or {}
    resp.text = ""
    return resp


@pytest.mark.asyncio
async def test_successful_request(client: RetryableHttpClient) -> None:
    mock_resp = _mock_response(200, json_data={"ok": True})

    with patch("ragkit.connectors.http_utils.httpx.AsyncClient") as MockClient:
        instance = AsyncMock()
        instance.request.return_value = mock_resp
        instance.__aenter__ = AsyncMock(return_value=instance)
        instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = instance

        response = await client.get("https://example.com/api")
        assert response.status_code == 200
        assert response.json() == {"ok": True}


@pytest.mark.asyncio
async def test_retry_on_server_error(client: RetryableHttpClient) -> None:
    error_resp = _mock_response(503)
    ok_resp = _mock_response(200, json_data={"recovered": True})

    call_count = 0

    async def mock_request(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            return error_resp
        return ok_resp

    with patch("ragkit.connectors.http_utils.httpx.AsyncClient") as MockClient:
        instance = AsyncMock()
        instance.request.side_effect = mock_request
        instance.__aenter__ = AsyncMock(return_value=instance)
        instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = instance

        response = await client.get("https://example.com/api")
        assert response.status_code == 200
        assert call_count == 2


@pytest.mark.asyncio
async def test_retry_on_429_with_retry_after(client: RetryableHttpClient) -> None:
    rate_limited = _mock_response(429, headers={"retry-after": "0.01"})
    ok_resp = _mock_response(200)

    call_count = 0

    async def mock_request(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return rate_limited
        return ok_resp

    with patch("ragkit.connectors.http_utils.httpx.AsyncClient") as MockClient:
        instance = AsyncMock()
        instance.request.side_effect = mock_request
        instance.__aenter__ = AsyncMock(return_value=instance)
        instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = instance

        response = await client.get("https://example.com/api")
        assert response.status_code == 200
        assert call_count == 2


@pytest.mark.asyncio
async def test_max_retries_exhausted(client: RetryableHttpClient) -> None:
    import httpx as httpx_mod

    with patch("ragkit.connectors.http_utils.httpx.AsyncClient") as MockClient:
        instance = AsyncMock()
        instance.request.side_effect = httpx_mod.ConnectError("Connection refused")
        instance.__aenter__ = AsyncMock(return_value=instance)
        instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = instance

        with pytest.raises(httpx_mod.ConnectError):
            await client.get("https://unreachable.example.com")


@pytest.mark.asyncio
async def test_non_retryable_status_returns_immediately(client: RetryableHttpClient) -> None:
    not_found = _mock_response(404)

    with patch("ragkit.connectors.http_utils.httpx.AsyncClient") as MockClient:
        instance = AsyncMock()
        instance.request.return_value = not_found
        instance.__aenter__ = AsyncMock(return_value=instance)
        instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = instance

        response = await client.get("https://example.com/not-found")
        assert response.status_code == 404
        # Should be called only once, no retry for 404
        assert instance.request.call_count == 1


@pytest.mark.asyncio
async def test_post_request(client: RetryableHttpClient) -> None:
    ok_resp = _mock_response(201, json_data={"id": 42})

    with patch("ragkit.connectors.http_utils.httpx.AsyncClient") as MockClient:
        instance = AsyncMock()
        instance.request.return_value = ok_resp
        instance.__aenter__ = AsyncMock(return_value=instance)
        instance.__aexit__ = AsyncMock(return_value=False)
        MockClient.return_value = instance

        response = await client.post("https://example.com/api", json={"name": "test"})
        assert response.status_code == 201


def test_backoff_is_bounded() -> None:
    client = RetryableHttpClient(max_retries=10, backoff_factor=1.0, max_backoff=5.0)
    for attempt in range(10):
        wait = client._backoff(attempt)
        assert wait <= 5.0
