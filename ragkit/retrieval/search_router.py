"""Search router dispatching requests to semantic, lexical, or hybrid handlers."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from ragkit.config.retrieval_schema import SearchType


class SearchRouter:
    def __init__(
        self,
        semantic_handler: Callable[..., Awaitable[Any]],
        lexical_handler: Callable[..., Awaitable[Any]],
        hybrid_handler: Callable[..., Awaitable[Any]],
        default_type: SearchType = SearchType.HYBRID,
    ) -> None:
        self.semantic_handler = semantic_handler
        self.lexical_handler = lexical_handler
        self.hybrid_handler = hybrid_handler
        self.default_type = default_type

    async def search(self, search_type: SearchType | None = None, **kwargs: Any) -> Any:
        requested_type = search_type or self.default_type
        if requested_type == SearchType.SEMANTIC:
            return await self.semantic_handler(**kwargs)
        if requested_type == SearchType.LEXICAL:
            return await self.lexical_handler(**kwargs)
        return await self.hybrid_handler(**kwargs)
