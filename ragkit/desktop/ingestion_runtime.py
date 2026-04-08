"""Ingestion runtime manager for step 4 dashboard capabilities."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import sqlite3
import time
from datetime import datetime, timezone
from typing import Any

from ragkit.chunking.engine import create_chunker
from ragkit.config.chunking_schema import ChunkingConfig
from ragkit.config.embedding_schema import EmbeddingConfig, EmbeddingProvider
from ragkit.config.retrieval_schema import LexicalSearchConfig
from ragkit.config.vector_store_schema import GeneralSettings, IngestionMode, VectorStoreConfig
from ragkit.desktop import documents
from ragkit.desktop.models import (
    ChangeDetectionResult,
    IngestionChange,
    IngestionHistoryEntry,
    IngestionLogEntry,
    IngestionProgress,
    SettingsPayload,
    SourceEntry,
)
from ragkit.desktop.profiles import build_full_config
from ragkit.desktop import settings_store
from ragkit.embedding.engine import EmbeddingEngine
from ragkit.connectors.base import ConnectorDocument
from ragkit.connectors.credentials import CredentialManager
from ragkit.connectors.registry import create_connector
from ragkit.desktop.migration import migrate_settings_to_multi_sources
from ragkit.retrieval.lexical_engine import BM25Index
from ragkit.storage.base import VectorPoint, create_vector_store


logger = logging.getLogger(__name__)

class IngestionRuntime:
    def __init__(self) -> None:
        self.progress = IngestionProgress()
        self.logs: list[IngestionLogEntry] = []
        self._subscribers: list[asyncio.Queue[dict]] = []
        self._task: asyncio.Task | None = None
        self._auto_task: asyncio.Task | None = None
        self._pause = asyncio.Event()
        self._pause.set()
        self._cancelled = False
        self._pending_auto_trigger_at: float | None = None
        self._last_auto_signature: str | None = None
        self._registry = settings_store.get_data_dir() / "ingestion_registry.db"
        self._pending_docs_by_id: dict[str, ConnectorDocument] = {}
        self._credential_manager = CredentialManager()
        self._db_ready = False
        try:
            self._ensure_db()
        except Exception as exc:  # pragma: no cover - defensive for read-only envs
            logger.warning("Failed to initialize ingestion registry database: %s", exc)

    async def _count_source_documents_fast(
        self,
        settings: SettingsPayload,
        source_ids: list[str] | None = None,
    ) -> int:
        sources = self._resolve_sources(settings)
        if source_ids:
            allowed = set(source_ids)
            sources = [source for source in sources if source.id in allowed]
        if not sources:
            return 0

        count = 0
        for source in sources:
            if not source.enabled:
                continue
            try:
                credential = self._get_credential(source)
                connector = create_connector(source.type, source.id, source.config, credential)
                # the list_documents is usually reasonably fast (e.g., local FS scan or one API call)
                docs = await connector.list_documents()
                count += len(docs)
            except Exception as e:
                logger.error("Failed to fast-count documents for source %s: %s", source.name, e)
        return count

    def _ensure_db(self) -> None:
        self._registry.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self._registry) as con:
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS ingestion_registry (
                    doc_id TEXT PRIMARY KEY,
                    source_id TEXT,
                    file_path TEXT NOT NULL,
                    file_hash TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    last_modified TEXT NOT NULL,
                    chunk_count INTEGER NOT NULL,
                    ingestion_version TEXT NOT NULL,
                    ingested_at TEXT NOT NULL
                )
                """
            )
            cols = {row[1] for row in con.execute("PRAGMA table_info(ingestion_registry)").fetchall()}
            if "source_id" not in cols:
                con.execute("ALTER TABLE ingestion_registry ADD COLUMN source_id TEXT")
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS ingestion_history (
                    version TEXT PRIMARY KEY,
                    started_at TEXT NOT NULL,
                    completed_at TEXT,
                    status TEXT NOT NULL,
                    total_docs INTEGER,
                    total_chunks INTEGER,
                    docs_added INTEGER DEFAULT 0,
                    docs_modified INTEGER DEFAULT 0,
                    docs_removed INTEGER DEFAULT 0,
                    docs_skipped INTEGER DEFAULT 0,
                    docs_failed INTEGER DEFAULT 0,
                    duration_seconds REAL,
                    is_incremental BOOLEAN DEFAULT 0,
                    config_snapshot TEXT
                )
                """
            )
        self._db_ready = True

    def _ensure_db_ready(self) -> None:
        if not self._db_ready:
            self._ensure_db()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    async def publish(self, event: str, data: dict) -> None:
        for queue in list(self._subscribers):
            await queue.put({"event": event, "data": data})

    def ensure_background_tasks(self) -> None:
        if self._auto_task and not self._auto_task.done():
            return
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        self._auto_task = loop.create_task(self._auto_ingestion_loop())

    def subscribe(self) -> asyncio.Queue[dict]:
        q: asyncio.Queue[dict] = asyncio.Queue()
        self._subscribers.append(q)
        return q

    def unsubscribe(self, queue: asyncio.Queue[dict]) -> None:
        if queue in self._subscribers:
            self._subscribers.remove(queue)

    def _load_registry(self) -> dict[str, dict]:
        self._ensure_db_ready()
        with sqlite3.connect(self._registry) as con:
            rows = con.execute(
                "SELECT doc_id,source_id,file_path,file_hash,file_size,last_modified,chunk_count FROM ingestion_registry"
            ).fetchall()
        return {
            row[0]: {
                "doc_id": row[0],
                "source_id": row[1],
                "file_path": row[2],
                "file_hash": row[3],
                "file_size": row[4],
                "last_modified": row[5],
                "chunk_count": row[6],
            }
            for row in rows
        }

    def _bm25_index_dir(self) -> Path:
        return settings_store.get_data_dir() / "bm25_index"

    def _resolve_lexical_config(self, settings: SettingsPayload) -> LexicalSearchConfig:
        retrieval_payload = settings.retrieval if isinstance(settings.retrieval, dict) else {}
        lexical_payload = retrieval_payload.get("lexical", {}) if isinstance(retrieval_payload, dict) else {}
        if lexical_payload:
            return LexicalSearchConfig.model_validate(lexical_payload)

        profile_name = settings.profile or "general"
        full_config = build_full_config(profile_name, settings.calibration_answers)
        retrieval_profile_payload = full_config.get("retrieval", {})
        lexical_profile_payload = (
            retrieval_profile_payload.get("lexical", {}) if isinstance(retrieval_profile_payload, dict) else {}
        )
        return LexicalSearchConfig.model_validate(lexical_profile_payload)

    def _resolve_general_settings(self, settings: SettingsPayload) -> GeneralSettings:
        payload = dict(settings.general) if isinstance(settings.general, dict) else {}

        mode = str(payload.get("ingestion_mode") or "").strip().lower()
        if mode == "auto":
            payload["ingestion_mode"] = IngestionMode.AUTOMATIC.value
        elif mode in {IngestionMode.AUTOMATIC.value, IngestionMode.MANUAL.value}:
            payload["ingestion_mode"] = mode
        else:
            payload.pop("ingestion_mode", None)

        if "ingestion_mode" not in payload:
            calibration = settings.calibration_answers if isinstance(settings.calibration_answers, dict) else {}
            if bool(calibration.get("q5") or calibration.get("q5_frequent_updates")):
                payload["ingestion_mode"] = IngestionMode.AUTOMATIC.value

        return GeneralSettings.model_validate(payload)

    def _resolve_sources(self, settings: SettingsPayload) -> list[SourceEntry]:
        ingestion = settings.ingestion
        if ingestion is None:
            return []
        if not ingestion.sources and getattr(ingestion, "source", None) and ingestion.source.path:
            try:
                ingestion = migrate_settings_to_multi_sources(ingestion)
                settings.ingestion = ingestion
            except Exception as exc:
                logger.warning("Failed to migrate legacy source config: %s", exc)
        return list(ingestion.sources or [])

    def _get_credential(self, source: SourceEntry) -> dict[str, Any] | None:
        key = source.credential_key or source.id
        try:
            return self._credential_manager.retrieve(key)
        except Exception as exc:
            logger.warning("Failed to retrieve credential for source %s: %s", source.name, exc)
            return None

    def _effective_embedding_batch_size(self, embedder: EmbeddingEngine) -> int:
        configured = max(1, int(getattr(embedder.config, "batch_size", 100) or 100))
        if embedder.config.provider == EmbeddingProvider.OLLAMA:
            return min(configured, 32)
        return configured

    async def _embed_document_chunks(
        self,
        *,
        embedder: EmbeddingEngine,
        texts: list[str],
        started: float,
    ) -> list:
        if not texts:
            return []

        outputs: list = []
        batch_size = self._effective_embedding_batch_size(embedder)
        for offset in range(0, len(texts), batch_size):
            await self._pause.wait()
            if self._cancelled:
                break
            batch = texts[offset : offset + batch_size]
            batch_outputs = await asyncio.to_thread(embedder.embed_texts, batch)
            outputs.extend(batch_outputs)
            self.progress.elapsed_seconds = time.perf_counter() - started
            await self.publish("progress", self.progress.model_dump(mode="json"))
        return outputs

    async def _auto_ingestion_loop(self) -> None:
        while True:
            try:
                # Run settings load in thread to avoid any I/O blocking
                settings = await asyncio.to_thread(settings_store.load_settings)
                general_settings = self._resolve_general_settings(settings)

                if general_settings.ingestion_mode != IngestionMode.AUTOMATIC:
                    self._pending_auto_trigger_at = None
                    self._last_auto_signature = None
                    await asyncio.sleep(30)
                    continue

                if self._task and not self._task.done():
                    await asyncio.sleep(30)
                    continue

                # detect_changes is async and reads metadata or APIs.
                changes = await self.detect_changes(settings)
                signature = "|".join(sorted(f"{change.type}:{change.path}" for change in changes.changes))
                now = time.monotonic()

                if not signature:
                    self._pending_auto_trigger_at = None
                    self._last_auto_signature = None
                    await asyncio.sleep(30)
                    continue

                if signature != self._last_auto_signature:
                    self._last_auto_signature = signature
                    self._pending_auto_trigger_at = now + max(general_settings.auto_ingestion_delay, 5)
                    await asyncio.sleep(30)
                    continue

                if self._pending_auto_trigger_at and now >= self._pending_auto_trigger_at:
                    self.logs.append(
                        IngestionLogEntry(
                            timestamp=self._now(),
                            level="info",
                            message="Auto ingestion déclenchée après délai de stabilisation.",
                        )
                    )
                    await self.start(incremental=True)
                    self._pending_auto_trigger_at = None
                    self._last_auto_signature = None
            except Exception:
                logger.exception("Auto-ingestion loop error")
                await asyncio.sleep(30)
                continue

            await asyncio.sleep(30)

    async def detect_changes(
        self,
        settings: SettingsPayload | None = None,
        source_ids: list[str] | None = None,
    ) -> ChangeDetectionResult:
        settings = settings or settings_store.load_settings()
        sources = self._resolve_sources(settings)
        active_sources = [source for source in sources if source.enabled]
        if source_ids:
            allowed = set(source_ids)
            active_sources = [source for source in active_sources if source.id in allowed]
        if not active_sources:
            return ChangeDetectionResult()
            
        previous = self._load_registry()
        legacy_entries = {doc_id: info for doc_id, info in previous.items() if not info.get("source_id")}

        if legacy_entries and len(active_sources) == 1:
            legacy_source_id = active_sources[0].id
            for info in legacy_entries.values():
                info["source_id"] = legacy_source_id
            with sqlite3.connect(self._registry) as con:
                con.execute(
                    "UPDATE ingestion_registry SET source_id = ? WHERE source_id IS NULL OR source_id = ''",
                    (legacy_source_id,),
                )

        known_hashes_by_source: dict[str, dict[str, str]] = {source.id: {} for source in active_sources}
        for doc_id, info in previous.items():
            source_id = info.get("source_id")
            if source_id in known_hashes_by_source:
                known_hashes_by_source[source_id][doc_id] = info["file_hash"]
        
        changes: list[IngestionChange] = []
        all_removed_ids: set[str] = set()
        self._pending_docs_by_id = {}
        
        for source in active_sources:
            try:
                credential = self._get_credential(source)
                connector = create_connector(source.type, source.id, source.config, credential)
                delta = await connector.detect_changes(known_hashes_by_source.get(source.id, {}))
                
                for doc in delta.added:
                    path = doc.file_path or doc.url or doc.title
                    self._pending_docs_by_id[doc.id] = doc
                    changes.append(IngestionChange(type="added", path=path, file_size=doc.file_size_bytes, last_modified=doc.last_modified, doc_id=doc.id, source_id=source.id))
                for doc in delta.modified:
                    path = doc.file_path or doc.url or doc.title
                    self._pending_docs_by_id[doc.id] = doc
                    changes.append(IngestionChange(type="modified", path=path, file_size=doc.file_size_bytes, last_modified=doc.last_modified, doc_id=doc.id, source_id=source.id))
                all_removed_ids.update(delta.removed_ids)
            except Exception as e:
                logger.error("Failed to detect changes for source %s: %s", source.name, e)
                
        for doc_id in all_removed_ids:
            info = previous.get(doc_id)
            if info:
                changes.append(IngestionChange(type="removed", path=info["file_path"], doc_id=doc_id, source_id=info.get("source_id")))
                
        return ChangeDetectionResult(
            changes=changes,
            added=sum(1 for c in changes if c.type == "added"),
            modified=sum(1 for c in changes if c.type == "modified"),
            removed=len(all_removed_ids),
        )

    async def start(self, incremental: bool = False, source_ids: list[str] | None = None) -> dict:
        self.ensure_background_tasks()
        if self._task and not self._task.done():
            return {"version": self.progress.version, "status": self.progress.status}
        self._cancelled = False
        self._pause.set()
        # Ensure callers see a "running" status immediately to avoid race conditions
        # with the async task scheduling.
        self.progress.status = "running"
        self.progress.is_incremental = incremental
        self.progress.phase = "queued"
        self._task = asyncio.create_task(self._run(incremental=incremental, source_ids=source_ids))
        return {"version": self.progress.version, "status": "running"}

    async def pause(self) -> dict:
        self._pause.clear()
        self.progress.status = "paused"
        return {"status": "paused"}

    async def resume(self) -> dict:
        self._pause.set()
        self.progress.status = "running"
        return {"status": "running"}

    async def cancel(self) -> dict:
        self._cancelled = True
        self._pause.set()
        self.progress.status = "cancelled"
        return {"status": "cancelled"}

    def _next_version(self) -> str:
        self._ensure_db_ready()
        with sqlite3.connect(self._registry) as con:
            row = con.execute("SELECT version FROM ingestion_history ORDER BY rowid DESC LIMIT 1").fetchone()
        if not row:
            return "v1"
        return f"v{int(row[0].lstrip('v')) + 1}"

    async def _run(self, incremental: bool, source_ids: list[str] | None = None) -> None:
        self.ensure_background_tasks()
        settings = await asyncio.to_thread(settings_store.load_settings)
        if not settings.ingestion:
            logger.warning("Ingestion skipped: no ingestion config in settings")
            self.progress.status = "failed"
            return
        sources = self._resolve_sources(settings)
        if not sources:
            logger.warning("Ingestion skipped: no sources configured")
            self.progress.status = "failed"
            return
        active_sources = [source for source in sources if source.enabled]
        if source_ids:
            allowed = set(source_ids)
            active_sources = [source for source in active_sources if source.id in allowed]
        if not active_sources:
            logger.warning(
                "Ingestion skipped: %s",
                "no matching sources" if source_ids else "all sources are disabled",
            )
            self.progress.status = "failed"
            return

        version = self._next_version()
        started = time.perf_counter()
        started_at = self._now()
        docs_added = 0
        docs_modified = 0
        docs_removed = 0
        docs_skipped = 0
        history_open = False
        stats_chunks = 0

        self.progress = IngestionProgress(status="running", version=version, is_incremental=incremental, phase="scanning")
        self.logs = [IngestionLogEntry(timestamp=started_at, level="info", message=f"Ingestion {version} démarrée")]

        try:
            chunk_cfg = ChunkingConfig.model_validate(settings.chunking or {})
            emb_cfg = EmbeddingConfig.model_validate(settings.embedding or {})
            vec_cfg = VectorStoreConfig.model_validate(settings.vector_store or {})
            lexical_cfg = self._resolve_lexical_config(settings)
            bm25_index = BM25Index(lexical_cfg)
            if incremental:
                bm25_index.load(self._bm25_index_dir())
            store = create_vector_store(vec_cfg)
            embedder = EmbeddingEngine(emb_cfg)
            chunker = create_chunker(chunk_cfg)

            dims = await asyncio.to_thread(embedder.resolve_dimensions)
            await store.create_snapshot(version)

            if not incremental:
                await store.delete_collection()
                with sqlite3.connect(self._registry) as con:
                    con.execute("DELETE FROM ingestion_registry")

            try:
                await store.initialize(dims)
            except ValueError as exc:
                if incremental:
                    raise RuntimeError(f"Ingestion failed: {exc}") from exc
                self.logs.append(
                    IngestionLogEntry(
                        timestamp=self._now(),
                        level="warning",
                        message="Embedding dimensions changed, rebuilding vector collection from scratch.",
                    )
                )
                await store.delete_collection()
                await store.initialize(dims)

            changes = await self.detect_changes(settings, source_ids=source_ids)
            registry_before = self._load_registry()
            
            docs_added = changes.added
            docs_modified = changes.modified
            docs_removed = changes.removed

            removed_ids = [change.doc_id for change in changes.changes if change.type == "removed" and change.doc_id]
            
            # Keep index in sync when files were removed
            for doc_id in removed_ids:
                await store.delete_by_doc_id(doc_id)
                bm25_index.remove_document_chunks(doc_id)
                with sqlite3.connect(self._registry) as con:
                    con.execute("DELETE FROM ingestion_registry WHERE doc_id = ?", (doc_id,))

            # Process added and modified
            to_process = [c for c in changes.changes if c.type in {"added", "modified"} and c.source_id and c.doc_id]
            
            with sqlite3.connect(self._registry) as con:
                con.execute(
                    "INSERT OR REPLACE INTO ingestion_history(version,started_at,status,total_docs,is_incremental,config_snapshot) VALUES(?,?,?,?,?,?)",
                    (version, started_at, "running", len(to_process), 1 if incremental else 0, json.dumps(settings.model_dump(mode="json"))),
                )
            history_open = True

            # We need connectors dict to avoid re-instantiating them for each file
            connectors = {}
            source_by_id = {source.id: source for source in active_sources}
            for source in active_sources:
                credential = self._get_credential(source)
                connectors[source.id] = create_connector(source.type, source.id, source.config, credential)

            doc_times: list[float] = []
            last_elapsed = 0.0
            self.progress.doc_total = len(to_process)
            source_docs_count = await self._count_source_documents_fast(settings, source_ids=source_ids)
            
            seen_hashes: set[str] = set()
            seen_token_sets: list[set[str]] = []

            for idx, change in enumerate(to_process, start=1):
                await self._pause.wait()
                if self._cancelled:
                    break

                self.progress.doc_index = idx
                self.progress.current_doc = change.path
                try:
                    self.progress.phase = "parsing"
                    try:
                        connector = connectors.get(change.source_id)
                        if not connector:
                            raise RuntimeError(f"Connector non trouvé pour la source {change.source_id}")
                            
                        text = await asyncio.wait_for(
                            connector.fetch_document_content(change.doc_id),
                            timeout=300
                        )
                        
                        raw_doc = self._pending_docs_by_id.get(change.doc_id)
                        if raw_doc is None:
                            try:
                                docs = await connector.list_documents()
                                raw_doc = next((doc for doc in docs if doc.id == change.doc_id), None)
                            except Exception:
                                raw_doc = None
                        if raw_doc is None:
                            raw_doc = ConnectorDocument(
                                id=change.doc_id,
                                source_id=change.source_id or "",
                                title=change.path or "Document",
                                content="",
                                content_type="text",
                                url=change.path if change.path and change.path.startswith("http") else None,
                                file_path=None if change.path and change.path.startswith("http") else change.path,
                                file_type=None,
                                file_size_bytes=change.file_size or 0,
                                last_modified=change.last_modified or "",
                            )

                        doc = await asyncio.wait_for(
                            asyncio.to_thread(documents.process_connector_document, raw_doc, text, settings.ingestion, seen_hashes, seen_token_sets),
                            timeout=60
                        )
                        if doc:
                            source_entry = source_by_id.get(change.source_id or "")
                            if source_entry:
                                doc.source_id = source_entry.id
                                doc.source_type = source_entry.type.value
                                doc.source_name = source_entry.name
                                if raw_doc.url and not doc.original_url:
                                    doc.original_url = raw_doc.url
                        
                        if not doc:
                            # Deduplicated
                            docs_skipped += 1
                            self.logs.append(
                                IngestionLogEntry(
                                    timestamp=self._now(),
                                    level="info",
                                    message=f"{change.path} (ignoré, doublon)",
                                )
                            )
                            continue
                            
                        self.progress.phase = "chunking"
                        chunks = await asyncio.wait_for(
                            asyncio.to_thread(
                                chunker.chunk,
                                text,
                                {"doc_id": doc.id, "doc_path": doc.file_path, "doc_title": doc.title or doc.filename, "source_id": doc.source_id},
                            ),
                            timeout=300
                        )
                        self.progress.phase = "embedding"
                        outputs = await asyncio.wait_for(
                            self._embed_document_chunks(
                                embedder=embedder,
                                texts=[chunk.content for chunk in chunks],
                                started=started,
                            ),
                            timeout=1800  # Give embedding up to 30 mins just in case of huge files on CPU
                        )
                    except asyncio.TimeoutError as exc:
                        raise RuntimeError("Le traitement du document a pris trop de temps et a été annulé.") from exc

                    if self._cancelled:
                        break
                    if len(outputs) != len(chunks):
                        raise RuntimeError(
                            f"Embedding output mismatch: {len(outputs)} embeddings for {len(chunks)} chunks."
                        )

                    self.progress.phase = "storing"
                    # For modified documents (or full re-index runs), remove all previous
                    # chunks first so obsolete chunks do not remain in the index.
                    if (not incremental) or (change.type == "modified"):
                        await store.delete_by_doc_id(doc.id)
                        bm25_index.remove_document_chunks(doc.id)

                    points = [
                        VectorPoint(
                            id=hashlib.sha256(f"{doc.id}:{i}:{chunk.content}".encode("utf-8")).hexdigest(),
                            vector=outputs[i].vector,
                            payload={
                                "doc_id": doc.id,
                                "doc_title": doc.title or doc.filename,
                                "filename": doc.filename,
                                "doc_path": doc.file_path,
                                "doc_type": doc.file_type,
                                "doc_language": doc.language,
                                "source_id": doc.source_id,
                                "source_type": doc.source_type,
                                "source_name": doc.source_name,
                                "original_url": doc.original_url,
                                "category": doc.category,
                                "keywords": list(doc.keywords),
                                "tags": list(doc.tags),
                                "page_number": doc.page_count,
                                "chunk_index": i,
                                "chunk_total": len(chunks),
                                "chunk_text": chunk.content,
                                "chunk_tokens": chunk.tokens,
                                "ingestion_version": version,
                                "ingested_at": self._now(),
                            },
                        )
                        for i, chunk in enumerate(chunks)
                    ]
                    await store.upsert(points)

                    for point in points:
                        payload = dict(point.payload or {})
                        bm25_index.add_document(
                            doc_id=point.id,
                            text=str(payload.get("chunk_text") or ""),
                            metadata=payload,
                            language=doc.language,
                        )

                    # Store connector-provided content hash for change detection
                    file_hash = ""
                    if "raw_doc" in locals() and raw_doc and getattr(raw_doc, "content_hash", ""):
                        file_hash = raw_doc.content_hash
                    with sqlite3.connect(self._registry) as con:
                        con.execute(
                            "INSERT OR REPLACE INTO ingestion_registry(doc_id,source_id,file_path,file_hash,file_size,last_modified,chunk_count,ingestion_version,ingested_at) VALUES(?,?,?,?,?,?,?,?,?)",
                            (doc.id, doc.source_id, doc.file_path or doc.original_url or "", file_hash, doc.file_size_bytes, doc.last_modified, len(chunks), version, self._now()),
                        )
                    self.progress.docs_succeeded += 1
                    self.progress.total_chunks += len(chunks)
                    self.logs.append(
                        IngestionLogEntry(timestamp=self._now(), level="success", message=f"{doc.filename} — {len(chunks)} chunks")
                    )
                except Exception as exc:  # pragma: no cover - defensive at runtime
                    self.progress.docs_failed += 1
                    doc_label = change.path or "Document"
                    if "doc" in locals() and doc:
                        doc_label = doc.filename or doc_label
                    self.logs.append(
                        IngestionLogEntry(
                            timestamp=self._now(),
                            level="error",
                            message=f"{doc_label} — échec: {exc}",
                        )
                    )
                    # Register failed docs with chunk_count=0 so they are not
                    # detected as "added" on the next change-detection scan,
                    # which would cause an infinite auto-ingestion loop.
                    try:
                        file_hash = ""
                        if "raw_doc" in locals() and raw_doc and getattr(raw_doc, "content_hash", ""):
                            file_hash = raw_doc.content_hash
                        if "doc" in locals() and doc:
                            doc_id = doc.id
                            source_id = doc.source_id
                            file_path = doc.file_path or doc.original_url or ""
                            file_size = doc.file_size_bytes
                            last_modified = doc.last_modified
                        else:
                            doc_id = change.doc_id or ""
                            source_id = change.source_id
                            file_path = change.path or ""
                            file_size = change.file_size or 0
                            last_modified = change.last_modified or self._now()
                        with sqlite3.connect(self._registry) as con:
                            con.execute(
                                "INSERT OR REPLACE INTO ingestion_registry(doc_id,source_id,file_path,file_hash,file_size,last_modified,chunk_count,ingestion_version,ingested_at) VALUES(?,?,?,?,?,?,?,?,?)",
                                (doc_id, source_id, file_path, file_hash, file_size, last_modified, 0, version, self._now()),
                            )
                    except Exception:
                        pass
                finally:
                    elapsed = time.perf_counter() - started
                    dt = max(elapsed - last_elapsed, 0.0)
                    last_elapsed = elapsed
                    doc_times.append(dt)
                    self.progress.elapsed_seconds = elapsed
                    avg = (sum(doc_times) / len(doc_times)) if doc_times else 0.0
                    self.progress.estimated_remaining_seconds = max((len(to_process) - idx) * avg, 0)
                    
                    if source_docs_count > 0:
                        # total_documents_indexed reflects the state of the whole collection
                        # but we want a live progress of coverage.
                        # We use the registry or a quick count to approximate if needed,
                        # but here we can just update it based on history + current progress.
                        current_indexed = self.progress.docs_succeeded + (len(registry_before) - docs_removed - docs_modified)
                        self.progress.coverage_percent = round((current_indexed / source_docs_count) * 100, 2)

                    await self.publish("progress", self.progress.model_dump(mode="json"))

            self.progress.phase = "finalizing"
            stats = await store.collection_stats()
            stats_chunks = int(stats.vectors_count)
            bm25_index.save(self._bm25_index_dir())
            end_status = "cancelled" if self._cancelled else "completed"
            self.progress.status = end_status
            self.progress.elapsed_seconds = time.perf_counter() - started
            completed_at = self._now()
            if history_open:
                with sqlite3.connect(self._registry) as con:
                    con.execute(
                        "UPDATE ingestion_history SET completed_at=?,status=?,total_chunks=?,duration_seconds=?,docs_added=?,docs_modified=?,docs_removed=?,docs_skipped=?,docs_failed=? WHERE version=?",
                        (
                            completed_at,
                            end_status,
                            stats_chunks,
                            self.progress.elapsed_seconds,
                            docs_added,
                            docs_modified,
                            docs_removed,
                            docs_skipped,
                            self.progress.docs_failed,
                            version,
                        ),
                    )
            self.logs.append(IngestionLogEntry(timestamp=completed_at, level="info", message=f"Ingestion {version} {end_status}"))
            await self.publish("complete", self.progress.model_dump(mode="json"))
        except Exception as exc:  # pragma: no cover - defensive at runtime
            self.progress.status = "failed"
            self.progress.phase = "error"
            self.progress.elapsed_seconds = time.perf_counter() - started
            completed_at = self._now()
            self.logs.append(
                IngestionLogEntry(
                    timestamp=completed_at,
                    level="error",
                    message=f"Ingestion {version} failed: {exc}",
                )
            )
            if history_open:
                with sqlite3.connect(self._registry) as con:
                    con.execute(
                        "UPDATE ingestion_history SET completed_at=?,status=?,total_chunks=?,duration_seconds=?,docs_added=?,docs_modified=?,docs_removed=?,docs_skipped=?,docs_failed=? WHERE version=?",
                        (
                            completed_at,
                            "failed",
                            stats_chunks or self.progress.total_chunks,
                            self.progress.elapsed_seconds,
                            docs_added,
                            docs_modified,
                            docs_removed,
                            docs_skipped,
                            self.progress.docs_failed or 1,
                            version,
                        ),
                    )
            await self.publish("complete", self.progress.model_dump(mode="json"))

    def get_history(self, limit: int = 10) -> list[IngestionHistoryEntry]:
        with sqlite3.connect(self._registry) as con:
            rows = con.execute(
                "SELECT version,started_at,completed_at,status,total_docs,total_chunks,docs_added,docs_modified,docs_removed,docs_skipped,docs_failed,duration_seconds,is_incremental FROM ingestion_history ORDER BY rowid DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [
            IngestionHistoryEntry(
                version=r[0],
                started_at=r[1],
                completed_at=r[2],
                status=r[3],
                total_docs=r[4] or 0,
                total_chunks=r[5] or 0,
                docs_added=r[6] or 0,
                docs_modified=r[7] or 0,
                docs_removed=r[8] or 0,
                docs_skipped=r[9] or 0,
                docs_failed=r[10] or 0,
                duration_seconds=r[11],
                is_incremental=bool(r[12]),
            )
            for r in rows
        ]


runtime = IngestionRuntime()
