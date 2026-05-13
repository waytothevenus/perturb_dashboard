#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Perturb Validator Dashboard ==="
echo ""

# ---- Backend ----
echo "[1/4] Setting up Python virtualenv..."
cd "$ROOT/backend"
[ -d venv ] || python3 -m venv venv
venv/bin/pip install -r requirements.txt -q

# ---- Frontend ----
echo "[2/4] Installing Node dependencies..."
cd "$ROOT/frontend"
[ -d node_modules ] || npm install --silent

echo "[3/4] Starting backend (port 8000)..."
cd "$ROOT/backend"
venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

sleep 2

echo "[4/4] Starting frontend (port 3000)..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Dashboard running at: http://localhost:3000"
echo "API docs at:          http://localhost:8000/docs"
echo ""
echo "REQUIRED (private run): export WANDB_API_KEY=<your_key> before running"
echo "OR use a local log:     export LOG_FILE_PATH=/path/to/output.log"
echo "Optional:               export POLL_INTERVAL=10  (seconds between polls)"
echo ""
echo "Press Ctrl+C to stop."

cleanup() {
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait
