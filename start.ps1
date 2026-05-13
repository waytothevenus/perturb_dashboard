# Perturb Validator Dashboard — PowerShell Launcher

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== Perturb Validator Dashboard ===" -ForegroundColor Cyan
Write-Host ""

# ---- Backend ----
Write-Host "[1/4] Setting up Python virtualenv..." -ForegroundColor Yellow
Set-Location "$Root\backend"
if (-not (Test-Path "venv")) {
    python -m venv venv
}
& venv\Scripts\pip install -r requirements.txt -q

# ---- Frontend ----
Write-Host "[2/4] Installing Node dependencies..." -ForegroundColor Yellow
Set-Location "$Root\frontend"
if (-not (Test-Path "node_modules")) {
    npm install --silent
}

# ---- Start Backend ----
Write-Host "[3/4] Starting backend (port 8000)..." -ForegroundColor Yellow
Set-Location "$Root\backend"
$backend = Start-Process -FilePath "venv\Scripts\uvicorn" `
    -ArgumentList "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload" `
    -PassThru -WindowStyle Normal

Start-Sleep -Seconds 3

# ---- Start Frontend ----
Write-Host "[4/4] Starting frontend (port 3000)..." -ForegroundColor Yellow
Set-Location "$Root\frontend"
$frontend = Start-Process -FilePath "npm" `
    -ArgumentList "run", "dev" `
    -PassThru -WindowStyle Normal

Write-Host ""
Write-Host "Dashboard running at: http://localhost:3000" -ForegroundColor Green
Write-Host "API docs at:          http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "NOTE: Set WANDB_API_KEY in backend\.env before starting."
Write-Host "      Or set it as a system/user environment variable."
Write-Host ""
Write-Host "Press Ctrl+C or close this window to stop both services." -ForegroundColor DarkGray

try {
    Wait-Process -Id $backend.Id, $frontend.Id
} finally {
    Stop-Process -Id $backend.Id  -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
}
