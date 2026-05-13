import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Set

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from data_store import DataStore
from log_parser import LogParser
from wandb_fetcher import fetch_new_lines_wandb, fetch_new_lines_local

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(name)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "60"))

store = DataStore()
parser = LogParser()
clients: Set[WebSocket] = set()
_last_cursor: str | None = None  # WandB GraphQL cursor
_local_line_count: int = 0       # fallback: local file line count
_fetch_lock = asyncio.Lock()

WANDB_API_KEY = os.environ.get("WANDB_API_KEY", "")
LOG_FILE_PATH  = os.environ.get("LOG_FILE_PATH", "")


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
                    entries = parser.parse_lines(new_lines)
                    if entries:
                        new_dicts = store.add_entries(entries)
                        logger.info("Parsed %d new entries from %d lines", len(entries), len(new_lines))
                        await _broadcast({
                            "type": "scores_update",
                            "data": {
                                "miners_summary": store.get_all_miners_summary(),
                                "overall_stats": store.get_overall_stats(),
                                "new_entries": new_dicts,
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


@app.get("/api/miners")
async def get_miners():
    return store.get_all_miners_summary()


@app.get("/api/miners/{uid}")
async def get_miner(uid: int):
    data = store.get_miner(uid)
    if data is None:
        return JSONResponse(status_code=404, content={"error": f"Miner {uid} not found"})
    return data


@app.get("/api/stats")
async def get_stats():
    return store.get_overall_stats()


@app.get("/api/matrix")
async def get_matrix():
    return store.get_score_matrix()


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
        },
    })
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except (WebSocketDisconnect, Exception):
        clients.discard(websocket)
