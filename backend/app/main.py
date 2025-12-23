from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse, Response
from fastapi.middleware.cors import CORSMiddleware

from .db import get_recording, init_db, insert_recording, update_processing_result
from .processing import convert_to_wav_16k_mono, simple_summary, summarize_with_ollama, transcribe_with_whisper
from .storage import get_recordings_dir

app = FastAPI(title="Side-Car Local Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/health")
def health():
    return {"ok": True, "service": "side-car-backend", "version": "0.1.0"}


@app.post("/recordings/upload")
async def upload_recording(
    title: str = Form(...),
    file: UploadFile = File(...),
):
    recording_id = str(uuid.uuid4())
    recordings_dir = get_recordings_dir()

    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    raw_path = recordings_dir / f"{recording_id}{suffix}"

    content = await file.read()
    raw_path.write_bytes(content)

    insert_recording(recording_id=recording_id, title=title, audio_path=str(raw_path))
    return {"id": recording_id, "audio_path": str(raw_path)}


@app.post("/recordings/{recording_id}/process")
def process_recording(recording_id: str):
    rec = get_recording(recording_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Recording not found")

    raw_path = Path(rec["audio_path"])
    wav_path = raw_path.with_suffix(".wav")

    try:
        convert_to_wav_16k_mono(raw_path, wav_path)
        transcript = transcribe_with_whisper(wav_path)
        text = transcript.get("text") or ""
        summary = summarize_with_ollama(text) or simple_summary(text)

        update_processing_result(recording_id=recording_id, transcript=transcript, summary=summary)

        return {"id": recording_id, "transcript": transcript, "summary": summary}
    except RuntimeError as e:
        # Keep failure message user-friendly.
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.get("/recordings/{recording_id}")
def get_recording_detail(recording_id: str):
    rec = get_recording(recording_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Recording not found")
    return rec


@app.get("/recordings/{recording_id}/export")
def export_recording(recording_id: str, format: str = "txt"):
    rec = get_recording(recording_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="Recording not found")

    title = rec["title"]
    transcript_text = (rec.get("transcript") or {}).get("text") or ""
    summary = rec.get("summary") or {}
    bullets = summary.get("bullets") or []
    action_items = summary.get("action_items") or []

    safe_title = "".join(ch if ch.isalnum() or ch in (" ", "-", "_") else "_" for ch in title).strip() or "meeting"

    if format == "txt":
        body = "\n".join(
            [
                title,
                "",
                "Summary:",
                *[f"- {b}" for b in bullets],
                "",
                "Action items:",
                *[f"- {a}" for a in action_items],
                "",
                "Transcript:",
                transcript_text,
                "",
            ]
        )
        return PlainTextResponse(
            body,
            headers={"Content-Disposition": f"attachment; filename=\"{safe_title}.txt\""},
        )

    if format == "md":
        body = "\n".join(
            [
                f"# {title}",
                "",
                "## Summary",
                *[f"- {b}" for b in bullets],
                "",
                "## Action items",
                *[f"- {a}" for a in action_items],
                "",
                "## Transcript",
                transcript_text,
                "",
            ]
        )
        return PlainTextResponse(
            body,
            headers={"Content-Disposition": f"attachment; filename=\"{safe_title}.md\""},
        )

    if format == "pdf":
        try:
            from io import BytesIO

            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="PDF export dependencies not installed") from e

        buf = BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=letter, title=title)
        styles = getSampleStyleSheet()
        story = [Paragraph(title, styles["Title"]), Spacer(1, 12)]

        story.append(Paragraph("Summary", styles["Heading2"]))
        for b in bullets:
            story.append(Paragraph(f"• {b}", styles["BodyText"]))
        story.append(Spacer(1, 12))

        story.append(Paragraph("Action items", styles["Heading2"]))
        for a in action_items:
            story.append(Paragraph(f"• {a}", styles["BodyText"]))
        story.append(Spacer(1, 12))

        story.append(Paragraph("Transcript", styles["Heading2"]))
        story.append(Paragraph(transcript_text.replace("\n", "<br />"), styles["BodyText"]))

        doc.build(story)
        pdf_bytes = buf.getvalue()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=\"{safe_title}.pdf\""},
        )

    raise HTTPException(status_code=400, detail="Unknown export format")
