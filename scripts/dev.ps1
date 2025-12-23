$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
$backendDir = Join-Path $root 'backend'
$desktopDir = Join-Path $root 'apps\desktop'

$venvPython = Join-Path $backendDir '.venv\Scripts\python.exe'

Write-Host "[Side-Car] Starting dev environment..." -ForegroundColor Cyan

if (-not (Test-Path $backendDir)) {
  throw "Backend folder not found: $backendDir"
}
if (-not (Test-Path $desktopDir)) {
  throw "Desktop folder not found: $desktopDir"
}

# Bootstrap backend venv if missing
if (-not (Test-Path $venvPython)) {
  Write-Host "[Side-Car] Creating backend venv..." -ForegroundColor Yellow
  Set-Location $backendDir
  python -m venv .venv
}

Write-Host "[Side-Car] Installing backend deps (if needed)..." -ForegroundColor Yellow
Set-Location $backendDir
& $venvPython -m pip install -r requirements.txt | Out-Host

Write-Host "[Side-Car] Starting backend on http://127.0.0.1:8765 ..." -ForegroundColor Yellow
$backendProc = Start-Process `
  -FilePath $venvPython `
  -ArgumentList @('-m','uvicorn','app.main:app','--app-dir','.', '--host','127.0.0.1','--port','8765','--reload') `
  -WorkingDirectory $backendDir `
  -PassThru

try {
  Write-Host "[Side-Car] Starting desktop app..." -ForegroundColor Yellow
  Set-Location $root
  npm --prefix $desktopDir run dev
}
finally {
  Write-Host "[Side-Car] Stopping backend..." -ForegroundColor Yellow
  if ($null -ne $backendProc -and -not $backendProc.HasExited) {
    Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
  }
}
