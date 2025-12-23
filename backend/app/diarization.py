from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class DiarizationSegment:
    start: float
    end: float
    speaker: str


def diarize_wav(wav_path: Path) -> list[DiarizationSegment]:
    """Optional diarization using pyannote.

    This requires heavy ML deps and locally available model weights.
    If pyannote isn't installed/configured, raise RuntimeError with a friendly message.
    """

    try:
        from pyannote.audio import Pipeline  # type: ignore
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(
            "Diarization is not installed. Install backend/requirements-diarization.txt and configure models."
        ) from e

    # Users can point to a local pipeline via env var to avoid network calls.
    import os

    pipeline_ref = os.environ.get("SIDECAR_PYANNOTE_PIPELINE", "")
    hf_token = os.environ.get("PYANNOTE_AUTH_TOKEN", "")

    if pipeline_ref:
        pipeline = Pipeline.from_pretrained(pipeline_ref, use_auth_token=hf_token or None)
    else:
        # Default reference; may require a token and may download weights if not cached.
        pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization@2.1", use_auth_token=hf_token or None)

    diarization = pipeline(str(wav_path))

    segs: list[DiarizationSegment] = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segs.append(DiarizationSegment(start=float(turn.start), end=float(turn.end), speaker=str(speaker)))

    segs.sort(key=lambda s: s.start)
    return segs


def assign_speakers_to_whisper_segments(
    whisper_segments: list[dict[str, Any]], diarization_segments: list[DiarizationSegment]
) -> list[dict[str, Any]]:
    """Assign a speaker label to each Whisper segment based on diarization overlap."""

    if not diarization_segments:
        # Fallback: a single speaker.
        return [
            {
                **seg,
                "speaker": seg.get("speaker") or "Speaker 1",
            }
            for seg in whisper_segments
        ]

    def pick_speaker(mid_t: float) -> str:
        for d in diarization_segments:
            if d.start <= mid_t <= d.end:
                return d.speaker
        # If no match, use the closest segment.
        closest = min(diarization_segments, key=lambda d: abs(((d.start + d.end) / 2.0) - mid_t))
        return closest.speaker

    out: list[dict[str, Any]] = []
    for seg in whisper_segments:
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", 0.0))
        mid = (start + end) / 2.0
        out.append({**seg, "speaker": pick_speaker(mid)})

    return out
