@echo off
setlocal EnableDelayedExpansion

echo === Perturb Validator Dashboard ===
echo.

set ROOT=%~dp0
set ROOT=%ROOT:~0,-1%

:: ---- Backend ----
echo [1/4] Setting up Python virtualenv...
cd /d "%ROOT%\backend"
if not exist venv (
    python -m venv venv
)
venv\Scripts\pip install -r requirements.txt -q

:: ---- Frontend ----
echo [2/4] Installing Node dependencies...
cd /d "%ROOT%\frontend"
if not exist node_modules (
    npm install --silent
)

echo [3/4] Starting backend (port 8000)...
cd /d "%ROOT%\backend"
start "Backend" venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8000 --reload

timeout /t 3 /nobreak >nul

echo [4/4] Starting frontend (port 3000)...
cd /d "%ROOT%\frontend"
start "Frontend" npm run dev

echo.
echo Dashboard running at: http://localhost:3000
echo API docs at:          http://localhost:8000/docs
echo.
echo NOTE: Set WANDB_API_KEY in backend\.env before starting.
echo       Or set it as a system/user environment variable.
echo.
echo Both services are running in separate windows.
echo Close those windows (or press Ctrl+C in each) to stop.
echo.
pause
