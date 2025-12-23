# Side-Car (working title)

Local-only desktop meeting intelligence app (Windows-first).

## Dev quickstart (Windows)

### One command (backend + desktop)

```powershell
cd g:\Development\App\meetingAssistent
npm run dev
```

### 1) Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload
```

Open: http://127.0.0.1:8765/health

### Optional ML / encryption

- Whisper (offline STT): install [backend/requirements-ml.txt](backend/requirements-ml.txt) (and a compatible PyTorch build).
- Encryption at rest (optional): install [backend/requirements-crypto.txt](backend/requirements-crypto.txt) and set `SIDECAR_STORAGE_PASSPHRASE`.

Backend env vars:
- `SIDECAR_WHISPER_MODEL` (default `large`)
- `SIDECAR_WHISPER_LANGUAGE` (default `bn`)
- `SIDECAR_STORAGE_PASSPHRASE` (default empty/disabled)
- `SIDECAR_OLLAMA_URL` (default `http://127.0.0.1:11434`)
- `SIDECAR_OLLAMA_MODEL` (default `llama3.1:8b`)

### 2) Desktop app

```powershell
cd apps\desktop
npm install
npm run dev
```

## Architecture

- Electron + React + TypeScript UI
- Local Python FastAPI backend
- All processing is local; no cloud calls are required by default.
