# Perturb Validator Dashboard

Real-time dashboard for analyzing scores from the **perturb-ai/perturb-validator** WandB run.

## Features
- **Real-time** — Polls WandB every 10 s; pushes updates over WebSocket
- **Window = 50** — Displays the last 50 score entries per miner
- **Score chart** — Line chart (score + norm + SSIM) with average reference line
- **Analysis panel** — Avg/min/max/stdev, response-time stats, score distribution, reason breakdown
- **Score table** — Sortable table; click any row to expand full metrics (task_id, response_time, norm, rmse, epsilon, ssim, psnr_db, reason)

## Quick Start

```bash
chmod +x start.sh
./start.sh
```

Open **http://localhost:3000**

## Manual Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `WANDB_API_KEY` | _(none)_ | Required for private runs |
| `WANDB_ENTITY` | `perturb-ai` | WandB entity |
| `WANDB_PROJECT` | `perturb-validator` | WandB project |
| `WANDB_RUN_ID` | `dk9ms8qo` | Run ID |
| `POLL_INTERVAL` | `10` | Seconds between polls |
| `LOG_FILE_PATH` | _(none)_ | Use a local `.log` file instead of WandB |

## Log Format Parsed

```
2026-05-13 18:54:53,192 | __main__ | INFO | verify_and_score task_id=... response_time_ms=2006
2026-05-13 18:54:53,509 | __main__ | INFO | uid=106 status=200 score=0.000000 processed=38 reason=below_min_delta norm=0.000000 rmse=0.000000 epsilon=0.076300 ssim=0.000000 psnr_db=0.0000
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/status` | Server status |
| `GET /api/miners` | All miners summary |
| `GET /api/miners/{uid}` | Single miner full detail (last 50 scores) |
| `GET /api/stats` | Overall stats |
| `WS /ws` | Real-time WebSocket feed |
