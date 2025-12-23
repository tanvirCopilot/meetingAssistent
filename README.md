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
