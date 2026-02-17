from __future__ import annotations

import asyncio

from ragkit.config.retrieval_schema import SearchType
from ragkit.retrieval.search_router import SearchRouter


def test_search_router_dispatches_to_semantic_handler() -> None:
    called: dict[str, bool] = {"semantic": False, "lexical": False, "hybrid": False}

    async def semantic_handler(**_kwargs):
        called["semantic"] = True
        return "semantic-result"

    async def lexical_handler(**_kwargs):
        called["lexical"] = True
        return "lexical-result"

    async def hybrid_handler(**_kwargs):
        called["hybrid"] = True
        return "hybrid-result"

    router = SearchRouter(
        semantic_handler=semantic_handler,
        lexical_handler=lexical_handler,
        hybrid_handler=hybrid_handler,
        default_type=SearchType.HYBRID,
    )
    result = asyncio.run(router.search(search_type=SearchType.SEMANTIC, query="alpha"))

    assert result == "semantic-result"
    assert called["semantic"] is True
    assert called["lexical"] is False
    assert called["hybrid"] is False


def test_search_router_uses_default_type_when_none() -> None:
    called: dict[str, bool] = {"semantic": False, "lexical": False, "hybrid": False}

    async def semantic_handler(**_kwargs):
        called["semantic"] = True
        return "semantic-result"

    async def lexical_handler(**_kwargs):
        called["lexical"] = True
        return "lexical-result"

    async def hybrid_handler(**_kwargs):
        called["hybrid"] = True
        return "hybrid-result"

    router = SearchRouter(
        semantic_handler=semantic_handler,
        lexical_handler=lexical_handler,
        hybrid_handler=hybrid_handler,
        default_type=SearchType.HYBRID,
    )
    result = asyncio.run(router.search(query="alpha"))

    assert result == "hybrid-result"
    assert called["semantic"] is False
    assert called["lexical"] is False
    assert called["hybrid"] is True
