# ragkit/desktop/main.py
"""RAGKIT Desktop backend — Étape 12 : finalisation."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from logging.handlers import RotatingFileHandler

# Add project root to sys.path to allow absolute imports when run as a script
import os
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from ragkit.desktop.settings_store import ensure_storage_dirs, get_log_dir  # noqa: E402

logger = logging.getLogger(__name__)

def setup_logging() -> None:
    # Ensure directories are created before configuring logging
    ensure_storage_dirs()

    log_file = get_log_dir() / "ragkit-backend.log"
    file_handler = RotatingFileHandler(
        log_file, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    file_handler.setFormatter(formatter)

    logging.basicConfig(
        level=logging.INFO,
        handlers=[
            file_handler,
            logging.StreamHandler(sys.stdout)
        ]
    )

APP_NAME = "LOKO"
VERSION = "1.4.17"


def create_app() -> FastAPI:
    app = FastAPI(title="RAGKIT Desktop API", version=VERSION)
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    from ragkit.desktop.api import wizard, ingestion, chunking, embedding, vector_store, retrieval, rerank, llm, chat, agents, monitoring, security, general
    from ragkit.desktop.ingestion_runtime import runtime

    app.include_router(wizard.router)
    app.include_router(ingestion.router)
    app.include_router(ingestion.settings_router)
    app.include_router(chunking.router)
    app.include_router(embedding.router)
    app.include_router(vector_store.router)
    app.include_router(retrieval.router)
    app.include_router(rerank.router)
    app.include_router(llm.router)
    app.include_router(agents.router)
    app.include_router(chat.router)
    app.include_router(monitoring.router)
    app.include_router(security.router)
    app.include_router(general.router)

    @app.on_event("startup")
    async def _start_background_tasks():
        _install_windows_error_handler()
        # Initialize conversations DB and migrate existing JSON files
        from ragkit.desktop.conversation_db import get_conversation_db
        db = get_conversation_db()
        db.migrate_json_files()
        runtime.ensure_background_tasks()

    @app.get("/health")
    async def health_check():
        return {"ok": True, "version": VERSION}
    
    @app.post("/shutdown")
    async def shutdown():
        logger.info("Shutdown requested")
        asyncio.get_event_loop().call_later(0.5, lambda: os._exit(0))
        return {"ok": True}
    
    return app


def _install_windows_error_handler() -> None:
    """Suppress ConnectionResetError on Windows ProactorEventLoop.

    Windows raises WinError 10054 when a client disconnects abruptly (e.g.
    Tauri health-check probes).  Without this handler the unhandled exception
    crashes the entire uvicorn server.
    """
    if sys.platform != "win32":
        return

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.get_event_loop()
    original_handler = loop.get_exception_handler()

    def _handler(loop: asyncio.AbstractEventLoop, context: dict) -> None:
        exception = context.get("exception")
        if isinstance(exception, ConnectionResetError):
            logger.debug("Suppressed ConnectionResetError: %s", exception)
            return
        if original_handler:
            original_handler(loop, context)
        else:
            loop.default_exception_handler(context)

    loop.set_exception_handler(_handler)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8100)
    args = parser.parse_args()

    setup_logging()

    app = create_app()
    logger.info(f"Starting RAGKIT backend on port {args.port}")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=args.port,
        log_level="info",
        timeout_keep_alive=30,
    )


if __name__ == "__main__":
    main()
