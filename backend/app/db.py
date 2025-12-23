from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import get_settings
from .crypto import decrypt_json, encrypt_json
from .storage import get_db_path


def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    db_path = get_db_path()
    conn = _connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS recordings (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              created_at TEXT NOT NULL,
              audio_path TEXT NOT NULL,
              transcript_json TEXT,
              summary_json TEXT
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def insert_recording(*, recording_id: str, title: str, audio_path: str) -> None:
    conn = _connect(get_db_path())
    try:
        conn.execute(
            "INSERT INTO recordings(id, title, created_at, audio_path) VALUES(?,?,?,?)",
            (
                recording_id,
                title,
                datetime.now(timezone.utc).isoformat(),
                audio_path,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def update_processing_result(
    *,
    recording_id: str,
    transcript: dict[str, Any] | None,
    summary: dict[str, Any] | None,
) -> None:
    settings = get_settings()
    conn = _connect(get_db_path())
    try:
        transcript_json: str | None
        summary_json: str | None

        if transcript is None:
            transcript_json = None
        else:
            if settings.storage_passphrase:
                transcript_json = json.dumps(encrypt_json(json.dumps(transcript), settings.storage_passphrase))
            else:
                transcript_json = json.dumps(transcript)

        if summary is None:
            summary_json = None
        else:
            if settings.storage_passphrase:
                summary_json = json.dumps(encrypt_json(json.dumps(summary), settings.storage_passphrase))
            else:
                summary_json = json.dumps(summary)

        conn.execute(
            "UPDATE recordings SET transcript_json=?, summary_json=? WHERE id=?",
            (
                transcript_json,
                summary_json,
                recording_id,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def get_recording(recording_id: str) -> dict[str, Any] | None:
    settings = get_settings()
    conn = _connect(get_db_path())
    try:
        row = conn.execute("SELECT * FROM recordings WHERE id=?", (recording_id,)).fetchone()
        if row is None:
            return None

        transcript = None
        if row["transcript_json"]:
            raw = json.loads(row["transcript_json"])
            if isinstance(raw, dict) and "_enc" in raw and settings.storage_passphrase:
                transcript = json.loads(decrypt_json(raw, settings.storage_passphrase))
            else:
                transcript = raw

        summary = None
        if row["summary_json"]:
            raw = json.loads(row["summary_json"])
            if isinstance(raw, dict) and "_enc" in raw and settings.storage_passphrase:
                summary = json.loads(decrypt_json(raw, settings.storage_passphrase))
            else:
                summary = raw
        return {
            "id": row["id"],
            "title": row["title"],
            "created_at": row["created_at"],
            "audio_path": row["audio_path"],
            "transcript": transcript,
            "summary": summary,
        }
    finally:
        conn.close()
