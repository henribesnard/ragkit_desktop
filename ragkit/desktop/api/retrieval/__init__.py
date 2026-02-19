"""Retrieval API package — combines semantic, lexical, and unified search routers."""

from __future__ import annotations

from fastapi import APIRouter

from .lexical_api import router as _lexical_router
from .semantic_api import router as _semantic_router
from .unified_api import router as _unified_router

router = APIRouter()
router.include_router(_semantic_router)
router.include_router(_lexical_router)
router.include_router(_unified_router)

__all__ = ["router"]
