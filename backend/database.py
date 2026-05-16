"""SQLite persistence layer for the validator dashboard.

Stores all score entries, challenge (task) entries, and ranking snapshots with
no window limit.  Uses WAL mode for good read/write concurrency.

The database file location defaults to ./data.db next to this file and can be
overridden with the DB_PATH environment variable.
"""

import logging
import os
import sqlite3
from typing import Set

logger = logging.getLogger(__name__)


class Database:
    def __init__(self, path: str | None = None):
        self._path = path or os.environ.get(
            "DB_PATH", os.path.join(os.path.dirname(__file__), "data.db")
        )
        self._conn = sqlite3.connect(self._path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._init_schema()
        logger.info("Database opened: %s", self._path)

    # ------------------------------------------------------------------
    # Schema
    # ------------------------------------------------------------------

    def _init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS score_entries (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp        TEXT    NOT NULL,
                task_id          TEXT,
                response_time_ms INTEGER,
                uid              INTEGER NOT NULL,
                status           INTEGER,
                score            REAL,
                processed        INTEGER,
                reason           TEXT,
                norm             REAL,
                rmse             REAL,
                epsilon          REAL,
                ssim             REAL,
                psnr_db          REAL,
                UNIQUE(uid, processed)
            );
            CREATE INDEX IF NOT EXISTS idx_score_uid_id
                ON score_entries(uid, id);

            CREATE TABLE IF NOT EXISTS challenge_entries (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp     TEXT    NOT NULL,
                task_id       TEXT    NOT NULL UNIQUE,
                category      TEXT    NOT NULL,
                output_label  TEXT    NOT NULL,
                epsilon       REAL,
                llm_verified  INTEGER,
                fallback_used INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_challenge_cat
                ON challenge_entries(category, output_label);

            CREATE TABLE IF NOT EXISTS ranking_entries (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_timestamp TEXT    NOT NULL,
                rank            INTEGER NOT NULL,
                uid             INTEGER NOT NULL,
                avg100          REAL,
                emission_raw    REAL,
                emission        REAL,
                UNIQUE(entry_timestamp, rank, uid)
            );
            """
        )
        self._conn.commit()

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------

    def insert_score_entries(self, entries) -> None:
        self._conn.executemany(
            """
            INSERT OR IGNORE INTO score_entries
              (timestamp, task_id, response_time_ms, uid, status, score,
               processed, reason, norm, rmse, epsilon, ssim, psnr_db)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            [
                (
                    e.timestamp, e.task_id, e.response_time_ms,
                    e.uid, e.status, e.score, e.processed,
                    e.reason, e.norm, e.rmse, e.epsilon, e.ssim, e.psnr_db,
                )
                for e in entries
            ],
        )
        self._conn.commit()

    def insert_challenge_entries(self, entries) -> None:
        self._conn.executemany(
            """
            INSERT OR IGNORE INTO challenge_entries
              (timestamp, task_id, category, output_label,
               epsilon, llm_verified, fallback_used)
            VALUES (?,?,?,?,?,?,?)
            """,
            [
                (
                    e.timestamp, e.task_id, e.category, e.output_label,
                    e.epsilon, int(e.llm_verified), int(e.fallback_used),
                )
                for e in entries
            ],
        )
        self._conn.commit()

    def insert_ranking_entries(self, entries) -> None:
        self._conn.executemany(
            """
            INSERT OR IGNORE INTO ranking_entries
              (entry_timestamp, rank, uid, avg100, emission_raw, emission)
            VALUES (?,?,?,?,?,?)
            """,
            [
                (e.timestamp, e.rank, e.uid, e.avg100, e.emission_raw, e.emission)
                for e in entries
            ],
        )
        self._conn.commit()

    # ------------------------------------------------------------------
    # Dedup key sets (loaded once at startup to populate in-memory _seen sets)
    # ------------------------------------------------------------------

    def get_seen_score_keys(self) -> Set[tuple]:
        rows = self._conn.execute(
            "SELECT uid, processed FROM score_entries"
        ).fetchall()
        return {(r["uid"], r["processed"]) for r in rows}

    def get_seen_task_ids(self) -> Set[str]:
        rows = self._conn.execute(
            "SELECT task_id FROM challenge_entries"
        ).fetchall()
        return {r["task_id"] for r in rows}

    def get_seen_rank_keys(self) -> Set[tuple]:
        rows = self._conn.execute(
            "SELECT entry_timestamp, rank, uid FROM ranking_entries"
        ).fetchall()
        return {(r["entry_timestamp"], r["rank"], r["uid"]) for r in rows}

    # ------------------------------------------------------------------
    # Bulk reads (used on startup to restore in-memory state)
    # ------------------------------------------------------------------

    def load_recent_scores_per_uid(self, window: int = 50) -> dict:
        """Return {uid: [row_dict, ...]} with the `window` most recent entries per uid."""
        rows = self._conn.execute(
            """
            WITH ranked AS (
                SELECT *,
                       ROW_NUMBER() OVER (PARTITION BY uid ORDER BY id DESC) AS rn
                FROM score_entries
            )
            SELECT * FROM ranked WHERE rn <= ?
            ORDER BY uid ASC, id ASC
            """,
            (window,),
        ).fetchall()
        result: dict = {}
        for row in rows:
            uid = row["uid"]
            if uid not in result:
                result[uid] = []
            result[uid].append(dict(row))
        return result

    def get_total_score_count(self) -> int:
        return self._conn.execute(
            "SELECT COUNT(*) FROM score_entries"
        ).fetchone()[0]

    def load_task_distribution(self) -> list:
        rows = self._conn.execute(
            """
            SELECT category, output_label, COUNT(*) AS count
            FROM challenge_entries
            GROUP BY category, output_label
            ORDER BY count DESC, category ASC, output_label ASC
            """
        ).fetchall()
        return [
            {"category": r["category"], "output_label": r["output_label"], "count": r["count"]}
            for r in rows
        ]

    def load_miner_scores_paginated(self, uid: int, page: int, page_size: int) -> list:
        """Return one page of score entries for a miner, enriched with challenge info."""
        offset = (page - 1) * page_size
        rows = self._conn.execute(
            """
            SELECT se.*, ce.category, ce.output_label
            FROM score_entries se
            LEFT JOIN challenge_entries ce ON se.task_id = ce.task_id
            WHERE se.uid = ?
            ORDER BY se.id DESC
            LIMIT ? OFFSET ?
            """,
            (uid, page_size, offset),
        ).fetchall()
        return [dict(row) for row in rows]

    def get_miner_score_count(self, uid: int) -> int:
        """Return total number of score entries for a given miner uid."""
        return self._conn.execute(
            "SELECT COUNT(*) FROM score_entries WHERE uid = ?", (uid,)
        ).fetchone()[0]

    def load_all_rankings(self) -> list:
        """Return all ranking snapshots, grouped by rank=1 boundaries."""
        rows = self._conn.execute(
            """
            SELECT entry_timestamp, rank, uid, avg100, emission_raw, emission
            FROM ranking_entries
            ORDER BY id ASC
            """
        ).fetchall()
        if not rows:
            return []

        snapshots: list = []
        current: list = []
        for row in rows:
            if row["rank"] == 1 and current:
                ts = current[0]["_ts"]
                snapshots.append({
                    "timestamp": ts,
                    "entries": [{k: v for k, v in e.items() if k != "_ts"} for e in current],
                })
                current = []
            current.append({
                "_ts": row["entry_timestamp"],
                "rank": row["rank"],
                "uid": row["uid"],
                "avg100": row["avg100"],
                "emission_raw": row["emission_raw"],
                "emission": row["emission"],
            })
        if current:
            snapshots.append({
                "timestamp": current[0]["_ts"],
                "entries": [{k: v for k, v in e.items() if k != "_ts"} for e in current],
            })
        return snapshots

    # ------------------------------------------------------------------
    # Maintenance
    # ------------------------------------------------------------------

    def clear_all(self) -> None:
        """Delete all data — called when the WandB run ID changes."""
        self._conn.executescript(
            """
            DELETE FROM score_entries;
            DELETE FROM challenge_entries;
            DELETE FROM ranking_entries;
            """
        )
        self._conn.commit()
        logger.info("Database cleared (run change)")

    def close(self) -> None:
        self._conn.close()
