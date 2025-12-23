from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    # Whisper
    whisper_model: str
    whisper_language: str

    # Optional encryption-at-rest for transcript/summary stored in SQLite.
    # If empty, store plaintext JSON.
    storage_passphrase: str

    # Optional local summary engine
    ollama_url: str
    ollama_model: str


def get_settings() -> Settings:
    return Settings(
        whisper_model=os.environ.get("SIDECAR_WHISPER_MODEL", "large"),
        whisper_language=os.environ.get("SIDECAR_WHISPER_LANGUAGE", "bn"),
        storage_passphrase=os.environ.get("SIDECAR_STORAGE_PASSPHRASE", ""),
        ollama_url=os.environ.get("SIDECAR_OLLAMA_URL", "http://127.0.0.1:11434"),
        ollama_model=os.environ.get("SIDECAR_OLLAMA_MODEL", "llama3.1:8b"),
    )
