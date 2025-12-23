from __future__ import annotations

import os
from pathlib import Path


def get_data_dir() -> Path:
    # Default to a local folder inside the repo for MVP.
    # Later: move to per-user app data.
    base = Path(os.environ.get("SIDECAR_DATA_DIR", ""))
    if base:
        base.mkdir(parents=True, exist_ok=True)
        return base

    here = Path(__file__).resolve().parent
    data_dir = (here.parent / "data").resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def get_recordings_dir() -> Path:
    recordings = get_data_dir() / "recordings"
    recordings.mkdir(parents=True, exist_ok=True)
    return recordings


def get_db_path() -> Path:
    return get_data_dir() / "sidecar.sqlite3"
