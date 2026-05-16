import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Set

from dotenv import load_dotenv

# Load .env BEFORE importing modules that read env vars at import time
# (wandb_fetcher captures WANDB_ENTITY/PROJECT/RUN_ID at module load).
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from data_store import DataStore
from database import Database
from log_parser import LogParser
from wandb_fetcher import fetch_new_lines_wandb, fetch_new_lines_local

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(name)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "60"))

WANDB_API_KEY = os.environ.get("WANDB_API_KEY", "")
LOG_FILE_PATH  = os.environ.get("LOG_FILE_PATH", "")

db = Database()
store = DataStore(db)
parser = LogParser()
clients: Set[WebSocket] = set()
_last_cursor: str | None = None  # WandB GraphQL cursor
_local_line_count: int = 0       # fallback: local file line count
_fetch_lock = asyncio.Lock()


async def _broadcast(message: dict):
    dead = set()
    for ws in clients:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    clients.difference_update(dead)


async def _do_fetch() -> list:
    """Fetch new log lines from WandB or local file. Updates cursors."""
    global _last_cursor, _local_line_count

    if LOG_FILE_PATH and os.path.isfile(LOG_FILE_PATH):
        new_lines, new_count = await asyncio.get_event_loop().run_in_executor(
            None, fetch_new_lines_local, LOG_FILE_PATH, _local_line_count
        )
        _local_line_count = new_count
        return new_lines

    if WANDB_API_KEY:
        new_lines, new_cursor = await asyncio.get_event_loop().run_in_executor(
            None, fetch_new_lines_wandb, WANDB_API_KEY, _last_cursor
        )
        if new_cursor:
            _last_cursor = new_cursor
        return new_lines

    logger.warning("No data source configured (set WANDB_API_KEY or LOG_FILE_PATH)")
    return []


async def _poll_loop():
    while True:
        try:
            async with _fetch_lock:
                new_lines = await _do_fetch()
                if new_lines:
                    score_entries, rank_entries, challenge_entries = parser.parse_lines(new_lines)
                    new_dicts: list = []
                    ranking_updated = False
                    challenge_updated = False
                    if score_entries:
                        new_dicts = store.add_entries(score_entries)
                    if rank_entries:
                        ranking_updated = store.add_ranking(rank_entries)
                    if challenge_entries:
                        challenge_updated = store.add_challenge_entries(challenge_entries)
                    if new_dicts or ranking_updated or challenge_updated:
                        logger.info(
                            "Parsed %d score entries, %d rank entries, %d challenge entries from %d lines",
                            len(score_entries), len(rank_entries), len(challenge_entries), len(new_lines),
                        )
                        await _broadcast({
                            "type": "scores_update",
                            "data": {
                                "miners_summary": store.get_all_miners_summary(),
                                "overall_stats": store.get_overall_stats(),
                                "new_entries": new_dicts,
                                "latest_ranking": store.get_latest_ranking(),
                                "matrix_data": store.get_score_matrix(),
                                "task_distribution": store.get_task_distribution(),
                            },
                        })
        except Exception as exc:
            logger.error("Poll error: %s", exc)
        await asyncio.sleep(POLL_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_poll_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    db.close()


app = FastAPI(title="Perturb Validator Dashboard", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/status")
async def status():
    return {
        "status": "ok",
        "total_miners": len(store._miners),
        "poll_interval_s": POLL_INTERVAL,
        "wandb_cursor": _last_cursor,
        "local_lines_processed": _local_line_count,
    }


class ConfigUpdate(BaseModel):
    wandb_entity: str | None = None
    wandb_project: str | None = None
    wandb_run_id: str | None = None


@app.get("/api/config")
async def get_config():
    return {
        "wandb_entity":  os.environ.get("WANDB_ENTITY",  "perturb-ai"),
        "wandb_project": os.environ.get("WANDB_PROJECT", "perturb-validator"),
        "wandb_run_id":  os.environ.get("WANDB_RUN_ID",  "dk9ms8qo"),
    }


@app.post("/api/config")
async def update_config(cfg: ConfigUpdate):
    global _last_cursor, _local_line_count
    async with _fetch_lock:
        if cfg.wandb_entity is not None:
            os.environ["WANDB_ENTITY"] = cfg.wandb_entity
        if cfg.wandb_project is not None:
            os.environ["WANDB_PROJECT"] = cfg.wandb_project
        if cfg.wandb_run_id is not None:
            os.environ["WANDB_RUN_ID"] = cfg.wandb_run_id
        # Reset fetch state so the next poll re-fetches from the beginning
        _last_cursor = None
        _local_line_count = 0
        store.clear()
        logger.info(
            "Config updated: entity=%s project=%s run_id=%s",
            os.environ.get("WANDB_ENTITY"),
            os.environ.get("WANDB_PROJECT"),
            os.environ.get("WANDB_RUN_ID"),
        )
    # Notify all connected clients to reset their local state
    await _broadcast({"type": "config_changed"})
    return await get_config()
async def get_miners():
    return store.get_all_miners_summary()


@app.get("/api/miners/{uid}")
async def get_miner(uid: int, page: int = 1, page_size: int = 50):
    data = store.get_miner_paginated(uid, page=page, page_size=page_size)
    if data is None:
        return JSONResponse(status_code=404, content={"error": f"Miner {uid} not found"})
    return data


@app.get("/api/stats")
async def get_stats():
    return store.get_overall_stats()


@app.get("/api/matrix")
async def get_matrix():
    return store.get_score_matrix()


@app.get("/api/ranking")
async def get_ranking():
    r = store.get_latest_ranking()
    if r is None:
        return JSONResponse(status_code=404, content={"error": "No ranking data available yet"})
    return r


@app.get("/api/tasks")
async def get_tasks():
    return store.get_task_distribution()


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    # Send full current state on connect
    await websocket.send_json({
        "type": "initial_state",
        "data": {
            "miners_summary": store.get_all_miners_summary(),
            "overall_stats": store.get_overall_stats(),
            "latest_ranking": store.get_latest_ranking(),
            "matrix_data": store.get_score_matrix(),
            "task_distribution": store.get_task_distribution(),
        },
    })
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except (WebSocketDisconnect, Exception):
        clients.discard(websocket)
