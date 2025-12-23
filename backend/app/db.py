from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

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
    conn = _connect(get_db_path())
    try:
        conn.execute(
            "UPDATE recordings SET transcript_json=?, summary_json=? WHERE id=?",
            (
                json.dumps(transcript) if transcript is not None else None,
                json.dumps(summary) if summary is not None else None,
                recording_id,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def get_recording(recording_id: str) -> dict[str, Any] | None:
    conn = _connect(get_db_path())
    try:
        row = conn.execute("SELECT * FROM recordings WHERE id=?", (recording_id,)).fetchone()
        if row is None:
            return None
        transcript = json.loads(row["transcript_json"]) if row["transcript_json"] else None
        summary = json.loads(row["summary_json"]) if row["summary_json"] else None
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
