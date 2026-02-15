# ragkit/desktop/main.py
"""RAGKIT Desktop backend - Étape 0 : squelette minimal."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

VERSION = "1.2.0"


def create_app() -> FastAPI:
    app = FastAPI(title="RAGKIT Desktop API", version=VERSION)
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    from ragkit.desktop.api import wizard, ingestion
    
    app.include_router(wizard.router)
    app.include_router(ingestion.router)

    @app.get("/health")
    async def health_check():
        return {"ok": True, "version": VERSION}
    
    @app.post("/shutdown")
    async def shutdown():
        logger.info("Shutdown requested")
        asyncio.get_event_loop().call_later(0.5, lambda: sys.exit(0))
        return {"ok": True}
    
    return app


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8100)
    args = parser.parse_args()
    
    app = create_app()
    logger.info(f"Starting RAGKIT backend on port {args.port}")
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")


if __name__ == "__main__":
    main()
