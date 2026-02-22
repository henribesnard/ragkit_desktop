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

    ollama_path = shutil.which("ollama")
    ollama_available = ollama_path is not None
    ollama_version = None
    ollama_llm_models: list[str] = []
    ollama_embedding_models: list[str] = []
    
    if ollama_available:
        try:
            ollama_version = subprocess.check_output(["ollama", "--version"], text=True, timeout=2).strip()
            import httpx
            with httpx.Client(timeout=1.0) as client:
                res = client.get("http://127.0.0.1:11434/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    for m in data.get("models", []):
                        name = m.get("name")
                        if not name:
                            continue
                        family = m.get("details", {}).get("family", "").lower()
                        if family in ["bert", "nomic-bert", "nomic-bert-moe", "gemma3", "qwen3"]:
                            ollama_embedding_models.append(name)
                        elif family in ["llama", "qwen2", "gemma", "mixtral", "command-r", "phi3"]:
                            ollama_llm_models.append(name)
                        else:
                            if "embed" in name.lower() or "bge" in name.lower() or "minilm" in name.lower():
                                ollama_embedding_models.append(name)
                            else:
                                ollama_llm_models.append(name)
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
        ollama_llm_models=ollama_llm_models,
        ollama_embedding_models=ollama_embedding_models,
        local_cached_models=local_cached_models,
        keyring_available=secrets_manager.keyring_available,
    )
