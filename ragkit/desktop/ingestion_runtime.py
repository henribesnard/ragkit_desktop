"""Ingestion runtime manager for step 4 dashboard capabilities."""

from __future__ import annotations

import asyncio
import hashlib
import json
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

from ragkit.chunking.engine import create_chunker
from ragkit.config.chunking_schema import ChunkingConfig
from ragkit.config.embedding_schema import EmbeddingConfig
from ragkit.config.vector_store_schema import GeneralSettings, IngestionMode, VectorStoreConfig
from ragkit.desktop import documents
from ragkit.desktop.models import (
    ChangeDetectionResult,
    IngestionChange,
    IngestionHistoryEntry,
    IngestionLogEntry,
    IngestionProgress,
    SettingsPayload,
)
from ragkit.desktop.settings_store import get_data_dir, load_settings
from ragkit.embedding.engine import EmbeddingEngine
from ragkit.storage.base import VectorPoint, create_vector_store


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
        self._registry = get_data_dir() / "ingestion_registry.db"
        self._ensure_db()

    def _ensure_db(self) -> None:
        self._registry.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self._registry) as con:
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS ingestion_registry (
                    doc_id TEXT PRIMARY KEY,
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
        with sqlite3.connect(self._registry) as con:
            rows = con.execute(
                "SELECT doc_id,file_path,file_hash,file_size,last_modified,chunk_count FROM ingestion_registry"
            ).fetchall()
        return {
            row[1]: {
                "doc_id": row[0],
                "file_hash": row[2],
                "file_size": row[3],
                "last_modified": row[4],
                "chunk_count": row[5],
            }
            for row in rows
        }

    async def _auto_ingestion_loop(self) -> None:
        while True:
            try:
                settings = load_settings()
                general_settings = GeneralSettings.model_validate(settings.general or {})

                if general_settings.ingestion_mode != IngestionMode.AUTOMATIC:
                    self._pending_auto_trigger_at = None
                    self._last_auto_signature = None
                    await asyncio.sleep(2)
                    continue

                if self._task and not self._task.done():
                    await asyncio.sleep(2)
                    continue

                changes = self.detect_changes(settings)
                signature = "|".join(sorted(f"{change.type}:{change.path}" for change in changes.changes))
                now = time.monotonic()

                if not signature:
                    self._pending_auto_trigger_at = None
                    self._last_auto_signature = None
                    await asyncio.sleep(2)
                    continue

                if signature != self._last_auto_signature:
                    self._last_auto_signature = signature
                    self._pending_auto_trigger_at = now + max(general_settings.auto_ingestion_delay, 5)
                    await asyncio.sleep(2)
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
                # Keep watcher loop resilient and try again.
                await asyncio.sleep(2)
                continue

            await asyncio.sleep(2)

    def detect_changes(self, settings: SettingsPayload | None = None) -> ChangeDetectionResult:
        settings = settings or load_settings()
        if not settings.ingestion or not settings.ingestion.source.path:
            return ChangeDetectionResult()
        root = Path(settings.ingestion.source.path).expanduser()
        if not root.exists():
            return ChangeDetectionResult()
        current: dict[str, dict] = {}
        selected = set(settings.ingestion.source.file_types)
        for file_path in documents._iter_files(
            root,
            recursive=settings.ingestion.source.recursive,
            excluded_dirs=settings.ingestion.source.excluded_dirs,
            exclusion_patterns=settings.ingestion.source.exclusion_patterns,
            max_file_size_mb=settings.ingestion.source.max_file_size_mb,
        ):
            ext = documents._normalize_extension(file_path.suffix)
            if ext not in selected:
                continue
            rel = file_path.relative_to(root).as_posix()
            payload = file_path.read_bytes()
            current[rel] = {
                "hash": hashlib.sha256(payload).hexdigest(),
                "size": file_path.stat().st_size,
                "mtime": datetime.fromtimestamp(file_path.stat().st_mtime, tz=timezone.utc).isoformat(),
            }

        previous = self._load_registry()
        changes: list[IngestionChange] = []
        for rel, info in current.items():
            if rel not in previous:
                changes.append(IngestionChange(type="added", path=rel, file_size=info["size"], last_modified=info["mtime"]))
            elif info["hash"] != previous[rel]["file_hash"]:
                changes.append(IngestionChange(type="modified", path=rel, file_size=info["size"], last_modified=info["mtime"]))
        for rel in previous:
            if rel not in current:
                changes.append(IngestionChange(type="removed", path=rel))
        return ChangeDetectionResult(
            changes=changes,
            added=sum(1 for c in changes if c.type == "added"),
            modified=sum(1 for c in changes if c.type == "modified"),
            removed=sum(1 for c in changes if c.type == "removed"),
        )

    async def start(self, incremental: bool = False) -> dict:
        self.ensure_background_tasks()
        if self._task and not self._task.done():
            return {"version": self.progress.version, "status": self.progress.status}
        self._cancelled = False
        self._pause.set()
        self._task = asyncio.create_task(self._run(incremental=incremental))
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
        with sqlite3.connect(self._registry) as con:
            row = con.execute("SELECT version FROM ingestion_history ORDER BY rowid DESC LIMIT 1").fetchone()
        if not row:
            return "v1"
        return f"v{int(row[0].lstrip('v')) + 1}"

    async def _run(self, incremental: bool) -> None:
        self.ensure_background_tasks()
        settings = load_settings()
        if not settings.ingestion:
            self.progress.status = "failed"
            return
        source_root = Path(settings.ingestion.source.path).expanduser()
        if not source_root.exists():
            self.progress.status = "failed"
            return

        version = self._next_version()
        self.progress = IngestionProgress(status="running", version=version, is_incremental=incremental, phase="scanning")
        started = time.perf_counter()
        started_at = self._now()
        self.logs = [IngestionLogEntry(timestamp=started_at, level="info", message=f"Ingestion {version} démarrée")]

        chunk_cfg = ChunkingConfig.model_validate(settings.chunking or {})
        emb_cfg = EmbeddingConfig.model_validate(settings.embedding or {})
        vec_cfg = VectorStoreConfig.model_validate(settings.vector_store or {})
        store = create_vector_store(vec_cfg)
        embedder = EmbeddingEngine(emb_cfg)
        chunker = create_chunker(chunk_cfg)

        changes = self.detect_changes(settings)
        registry_before = self._load_registry()
        removed_paths = [change.path for change in changes.changes if change.type == "removed"]
        docs_added = sum(1 for change in changes.changes if change.type == "added")
        docs_modified = sum(1 for change in changes.changes if change.type == "modified")
        docs_removed = len(removed_paths)
        docs_skipped = 0
        docs, _ = documents.analyze_documents(settings.ingestion)

        to_process = docs
        if incremental:
            impacted = {c.path for c in changes.changes if c.type in {"added", "modified"}}
            to_process = [d for d in docs if d.file_path in impacted]
            docs_skipped = max(len(docs) - len(to_process), 0)

        if to_process:
            sample_text = documents.get_document_text(settings.ingestion, to_process[0])
            dims = emb_cfg.dimensions or len(embedder.embed_text(sample_text[:300]).vector)
        else:
            dims = emb_cfg.dimensions or 768
        await store.initialize(dims)
        await store.create_snapshot(version)

        # Keep index in sync when files were removed from the source folder.
        for removed_path in removed_paths:
            previous = registry_before.get(removed_path)
            if not previous:
                continue
            doc_id = previous.get("doc_id")
            if not doc_id:
                continue
            await store.delete_by_doc_id(str(doc_id))
            with sqlite3.connect(self._registry) as con:
                con.execute("DELETE FROM ingestion_registry WHERE doc_id = ?", (doc_id,))

        with sqlite3.connect(self._registry) as con:
            con.execute(
                "INSERT OR REPLACE INTO ingestion_history(version,started_at,status,total_docs,is_incremental,config_snapshot) VALUES(?,?,?,?,?,?)",
                (version, started_at, "running", len(to_process), 1 if incremental else 0, json.dumps(settings.model_dump(mode="json"))),
            )

        doc_times: list[float] = []
        self.progress.doc_total = len(to_process)
        for idx, doc in enumerate(to_process, start=1):
            await self._pause.wait()
            if self._cancelled:
                break
            self.progress.doc_index = idx
            self.progress.current_doc = doc.filename
            self.progress.phase = "parsing"
            text = documents.get_document_text(settings.ingestion, doc)
            self.progress.phase = "chunking"
            chunks = chunker.chunk(text, {"doc_id": doc.id, "doc_path": doc.file_path, "doc_title": doc.title or doc.filename})
            self.progress.phase = "embedding"
            outputs = embedder.embed_texts([c.content for c in chunks])
            self.progress.phase = "storing"
            points = [
                VectorPoint(
                    id=hashlib.sha1(f"{doc.id}:{i}:{chunk.content}".encode("utf-8")).hexdigest(),
                    vector=outputs[i].vector,
                    payload={
                        "doc_id": doc.id,
                        "doc_title": doc.title or doc.filename,
                        "filename": doc.filename,
                        "doc_path": doc.file_path,
                        "doc_type": doc.file_type,
                        "doc_language": doc.language,
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
            file_abs = source_root / doc.file_path
            file_hash = hashlib.sha256(file_abs.read_bytes()).hexdigest() if file_abs.exists() else ""
            with sqlite3.connect(self._registry) as con:
                con.execute(
                    "INSERT OR REPLACE INTO ingestion_registry(doc_id,file_path,file_hash,file_size,last_modified,chunk_count,ingestion_version,ingested_at) VALUES(?,?,?,?,?,?,?,?)",
                    (doc.id, doc.file_path, file_hash, doc.file_size_bytes, doc.last_modified, len(chunks), version, self._now()),
                )
            self.progress.docs_succeeded += 1
            self.progress.total_chunks += len(chunks)
            elapsed = time.perf_counter() - started
            dt = elapsed - sum(doc_times)
            doc_times.append(dt)
            self.progress.elapsed_seconds = elapsed
            if len(doc_times) >= 1:
                avg = sum(doc_times) / len(doc_times)
                self.progress.estimated_remaining_seconds = max((len(to_process) - idx) * avg, 0)
            self.logs.append(IngestionLogEntry(timestamp=self._now(), level="success", message=f"{doc.filename} — {len(chunks)} chunks"))
            await self.publish("progress", self.progress.model_dump(mode="json"))

        self.progress.phase = "finalizing"
        stats = await store.collection_stats()
        end_status = "cancelled" if self._cancelled else "completed"
        self.progress.status = end_status
        self.progress.elapsed_seconds = time.perf_counter() - started
        completed_at = self._now()
        with sqlite3.connect(self._registry) as con:
            con.execute(
                "UPDATE ingestion_history SET completed_at=?,status=?,total_chunks=?,duration_seconds=?,docs_added=?,docs_modified=?,docs_removed=?,docs_skipped=?,docs_failed=? WHERE version=?",
                (
                    completed_at,
                    end_status,
                    stats.vectors_count,
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
