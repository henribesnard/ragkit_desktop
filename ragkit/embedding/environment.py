from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from ragkit.config.embedding_schema import EnvironmentInfo
from ragkit.security.secrets import secrets_manager


def detect_environment() -> EnvironmentInfo:
    gpu_available = False
    gpu_name = None
    gpu_backend = None

    if shutil.which("nvidia-smi"):
        try:
            out = subprocess.check_output(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"], text=True, timeout=2)
            first = out.strip().splitlines()[0] if out.strip() else None
            if first:
                gpu_available = True
                gpu_name = first.strip()
                gpu_backend = "cuda"
        except Exception:
            pass

    ollama_available = shutil.which("ollama") is not None
    ollama_version = None
    ollama_models: list[str] = []
    if ollama_available:
        try:
            ollama_version = subprocess.check_output(["ollama", "--version"], text=True, timeout=2).strip()
            model_out = subprocess.check_output(["ollama", "list"], text=True, timeout=2)
            for line in model_out.splitlines()[1:]:
                parts = line.split()
                if parts:
                    ollama_models.append(parts[0])
        except Exception:
            pass

    local_cached_models: list[str] = []
    for cache_dir in [Path.home() / ".cache" / "huggingface" / "hub", Path.home() / ".ollama" / "models"]:
        if cache_dir.exists():
            local_cached_models.append(cache_dir.name)

    return EnvironmentInfo(
        gpu_available=gpu_available,
        gpu_name=gpu_name,
        gpu_backend=gpu_backend,
        ollama_available=ollama_available,
        ollama_version=ollama_version,
        ollama_models=ollama_models,
        local_cached_models=local_cached_models,
        keyring_available=secrets_manager.keyring_available,
    )
