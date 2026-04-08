"""Async scheduler for periodic source synchronisation."""

from __future__ import annotations

import asyncio
import logging

from ragkit.desktop import settings_store
from ragkit.desktop.ingestion_runtime import IngestionRuntime, runtime
from ragkit.desktop.models import SourceEntry, SyncFrequency


logger = logging.getLogger(__name__)


class SyncScheduler:
    """Planificateur de synchronisation asynchrone."""

    def __init__(self, runtime_ref: IngestionRuntime) -> None:
        self._runtime = runtime_ref
        self._tasks: dict[str, asyncio.Task] = {}
        self._running = False

    async def start(self) -> None:
        """Demarre le scheduler et programme les sources actives."""
        if self._running:
            return
        self._running = True
        settings = settings_store.load_settings()
        if settings.ingestion:
            for source in settings.ingestion.sources:
                if source.enabled and source.sync_frequency != SyncFrequency.MANUAL:
                    await self.schedule_source(source)

    async def stop(self) -> None:
        """Arrete tous les jobs planifies."""
        self._running = False
        for task in list(self._tasks.values()):
            task.cancel()
        self._tasks.clear()

    async def schedule_source(self, source: SourceEntry) -> None:
        """Programme la synchronisation recurrente d'une source."""
        if not self._running:
            return
        await self.unschedule_source(source.id)
        interval = self._frequency_to_seconds(source.sync_frequency)
        if interval is None:
            return
        self._tasks[source.id] = asyncio.create_task(self._sync_loop(source.id, interval))

    async def unschedule_source(self, source_id: str) -> None:
        task = self._tasks.pop(source_id, None)
        if task:
            task.cancel()

    async def trigger_now(self, source_id: str) -> None:
        """Declenche une synchronisation immediate pour une source."""
        if not self._running:
            return
        await self._run_sync(source_id)

    async def _sync_loop(self, source_id: str, interval: int) -> None:
        while self._running:
            await asyncio.sleep(interval)
            await self._run_sync(source_id)

    async def _run_sync(self, source_id: str) -> None:
        try:
            await self._runtime.start(incremental=True, source_ids=[source_id])
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Scheduled sync failed for %s: %s", source_id, exc)

    @staticmethod
    def _frequency_to_seconds(freq: SyncFrequency) -> int | None:
        return {
            SyncFrequency.MANUAL: None,
            SyncFrequency.EVERY_15_MIN: 15 * 60,
            SyncFrequency.HOURLY: 60 * 60,
            SyncFrequency.EVERY_6H: 6 * 60 * 60,
            SyncFrequency.DAILY: 24 * 60 * 60,
            SyncFrequency.WEEKLY: 7 * 24 * 60 * 60,
        }.get(freq)


sync_scheduler = SyncScheduler(runtime)

