from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any


def _has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def convert_to_wav_16k_mono(input_path: Path, output_path: Path) -> None:
    if not _has_ffmpeg():
        raise RuntimeError(
            "ffmpeg not found on PATH. Install FFmpeg and ensure `ffmpeg` is available."
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # -vn: no video, -ac 1 mono, -ar 16000, wav PCM 16-bit
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        str(output_path),
    ]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {proc.stderr.strip()}")


def transcribe_with_whisper(wav_path: Path) -> dict[str, Any]:
    """Attempts to run Whisper locally.

    If Whisper isn't installed, returns a clear error that the frontend can show.
    """

    try:
        import whisper  # type: ignore
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(
            "Whisper is not installed. Install ML deps (see backend/requirements-ml.txt)."
        ) from e

    model = whisper.load_model("large")
    result = model.transcribe(str(wav_path), language="bn", task="transcribe")

    # Normalize to a stable minimal format.
    segments = []
    for seg in result.get("segments", []) or []:
        segments.append(
            {
                "start": float(seg.get("start", 0.0)),
                "end": float(seg.get("end", 0.0)),
                "text": (seg.get("text") or "").strip(),
            }
        )

    return {
        "language": result.get("language"),
        "text": (result.get("text") or "").strip(),
        "segments": segments,
    }


def simple_summary(transcript_text: str) -> dict[str, Any]:
    # MVP placeholder summary that is deterministic and fully offline.
    # Later: llama.cpp/Ollama integration.
    text = transcript_text.strip()
    if not text:
        bullets = ["No speech detected."]
    else:
        bullets = [
            "Summary generation is in MVP mode.",
            "Full offline LLM summary can be plugged in later.",
        ]

    return {
        "bullets": bullets,
        "action_items": ["(Action item extraction not enabled yet.)"],
        "decisions": [],
        "risks": [],
    }
