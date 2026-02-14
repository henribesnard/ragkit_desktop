import threading
from dataclasses import dataclass
from typing import Literal

@dataclass
class ProgressState:
    total: int = 0
    processed: int = 0
    current_file: str | None = None
    errors: int = 0
    status: Literal["idle", "running", "done", "error"] = "idle"

class AnalysisProgress:
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        self.state = ProgressState()

    @classmethod
    def get_instance(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    def start(self, total: int):
        with self._lock:
            self.state = ProgressState(total=total, status="running")

    def update(self, current_file: str, error: bool = False):
        with self._lock:
            self.state.processed += 1
            self.state.current_file = current_file
            if error:
                self.state.errors += 1

    def finish(self):
        with self._lock:
            self.state.status = "done"
            self.state.current_file = None

    def set_error(self):
        with self._lock:
            self.state.status = "error"
            self.state.current_file = None
            
    def get_snapshot(self) -> dict:
        with self._lock:
            return {
                "total": self.state.total,
                "processed": self.state.processed,
                "current_file": self.state.current_file,
                "errors": self.state.errors,
                "status": self.state.status,
                "percent": int((self.state.processed / self.state.total * 100) if self.state.total > 0 else 0)
            }
