from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Any

import urllib.request

from .config import get_settings
from .diarization import assign_speakers_to_whisper_segments, diarize_wav


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

    settings = get_settings()
    model = whisper.load_model(settings.whisper_model)
    result = model.transcribe(
        str(wav_path),
        language=settings.whisper_language,
        task="transcribe",
        fp16=False,
    )

    # Normalize to a stable minimal format.
    segments: list[dict[str, Any]] = []
    for seg in result.get("segments", []) or []:
        segments.append(
            {
                "start": float(seg.get("start", 0.0)),
                "end": float(seg.get("end", 0.0)),
                "text": (seg.get("text") or "").strip(),
            }
        )

    # Optional diarization (offline, but heavy deps). Enable with SIDECAR_DIARIZATION=1
    import os

    if os.environ.get("SIDECAR_DIARIZATION", "").strip() in ("1", "true", "yes"):
        diar = diarize_wav(wav_path)
        segments = assign_speakers_to_whisper_segments(segments, diar)
    else:
        # Default: single-speaker label
        segments = [{**s, "speaker": "Speaker 1"} for s in segments]

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


def summarize_with_ollama(transcript_text: str) -> dict[str, Any] | None:
    """Optional local LLM summary using Ollama.

    Returns None if Ollama is not reachable.
    """

    settings = get_settings()
    prompt = (
        "You are a meeting assistant. Summarize the following transcript. "
        "Return JSON with keys: bullets (array of strings), action_items (array), decisions (array), risks (array).\n\n"
        f"Transcript:\n{transcript_text.strip()}\n"
    )

    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
    }

    try:
        import json

        req = urllib.request.Request(
            url=f"{settings.ollama_url.rstrip('/')}/api/generate",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            raw = resp.read().decode("utf-8")
        # Ollama returns JSON string in `response` (itself JSON when format=json)
        obj = json.loads(raw)
        response_text = obj.get("response")
        if not response_text:
            return None
        parsed = json.loads(response_text)
        if isinstance(parsed, dict):
            return {
                "bullets": parsed.get("bullets") or [],
                "action_items": parsed.get("action_items") or [],
                "decisions": parsed.get("decisions") or [],
                "risks": parsed.get("risks") or [],
            }
        return None
    except Exception:
        return None
