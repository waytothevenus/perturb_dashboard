import logging
import statistics
from collections import deque
from typing import Dict, List, Optional

from database import Database
from log_parser import ScoreEntry, RankEntry, ChallengeEntry

logger = logging.getLogger(__name__)

WINDOW_SIZE = 50


class MinerData:
    def __init__(self, uid: int):
        self.uid = uid
        self.scores: deque = deque(maxlen=WINDOW_SIZE)

    def add_entry(self, entry: ScoreEntry):
        self.scores.append(entry)

    def get_stats(self) -> dict:
        if not self.scores:
            return {}

        score_vals = [e.score for e in self.scores]
        rt_vals = [e.response_time_ms for e in self.scores if e.response_time_ms is not None]
        reasons: Dict[str, int] = {}
        for e in self.scores:
            reasons[e.reason] = reasons.get(e.reason, 0) + 1

        result: dict = {
            "uid": self.uid,
            "count": len(self.scores),
            "latest_score": score_vals[-1],
            "avg_score": statistics.mean(score_vals),
            "min_score": min(score_vals),
            "max_score": max(score_vals),
            "stdev_score": statistics.stdev(score_vals) if len(score_vals) > 1 else 0.0,
            "reasons": reasons,
            "avg_norm": statistics.mean(e.norm for e in self.scores),
            "avg_rmse": statistics.mean(e.rmse for e in self.scores),
            "avg_epsilon": statistics.mean(e.epsilon for e in self.scores),
            "avg_ssim": statistics.mean(e.ssim for e in self.scores),
            "avg_psnr_db": statistics.mean(e.psnr_db for e in self.scores),
        }
        if rt_vals:
            result["avg_response_time_ms"] = statistics.mean(rt_vals)
            result["min_response_time_ms"] = min(rt_vals)
            result["max_response_time_ms"] = max(rt_vals)
        return result

    def to_dict(self) -> dict:
        return {
            "uid": self.uid,
            "scores": [e.to_dict() for e in self.scores],
            "stats": self.get_stats(),
        }


class DataStore:
    def __init__(self, db: Database):
        self._db = db
        self._miners: Dict[int, MinerData] = {}
        self._total_processed = 0
        # Deduplication sets — pre-populated from DB so the first poll that
        # re-fetches all historical lines doesn't re-insert anything.
        self._seen: set = db.get_seen_score_keys()
        self._seen_rank_events: set = db.get_seen_rank_keys()
        self._seen_task_ids: set = db.get_seen_task_ids()
        # In-memory aggregations
        self._rankings: List[dict] = []
        self._task_dist: Dict[tuple, int] = {}
        # Restore in-memory state from existing DB data
        self._load_from_db()

    # ------------------------------------------------------------------
    # Startup: restore in-memory state from DB
    # ------------------------------------------------------------------

    def _load_from_db(self) -> None:
        # Recent scores per uid (last WINDOW_SIZE) -> _miners deques
        recent = self._db.load_recent_scores_per_uid(WINDOW_SIZE)
        for uid, rows in recent.items():
            self._miners[uid] = MinerData(uid)
            for row in rows:
                entry = ScoreEntry(
                    timestamp=row["timestamp"],
                    task_id=row["task_id"],
                    response_time_ms=row["response_time_ms"],
                    uid=row["uid"],
                    status=row["status"],
                    score=row["score"],
                    processed=row["processed"],
                    reason=row["reason"],
                    norm=row["norm"],
                    rmse=row["rmse"],
                    epsilon=row["epsilon"],
                    ssim=row["ssim"],
                    psnr_db=row["psnr_db"],
                )
                self._miners[uid].add_entry(entry)

        # Total score count (all-time, not windowed)
        self._total_processed = self._db.get_total_score_count()

        # Task distribution from all stored challenges
        for r in self._db.load_task_distribution():
            self._task_dist[(r["category"], r["output_label"])] = r["count"]

        # All ranking snapshots
        self._rankings = self._db.load_all_rankings()

        if self._miners or self._task_dist or self._rankings:
            logger.info(
                "Restored from DB: %d miners, %d task label combos, %d ranking snapshots",
                len(self._miners), len(self._task_dist), len(self._rankings),
            )

    def add_entries(self, entries: List[ScoreEntry]) -> List[dict]:
        """Add entries, skipping duplicates; persist new ones to DB; return new dicts."""
        new_dicts = []
        truly_new = []
        for entry in sorted(entries, key=lambda e: (e.uid, e.processed)):
            key = (entry.uid, entry.processed)
            if key in self._seen:
                continue
            self._seen.add(key)
            truly_new.append(entry)
            uid = entry.uid
            if uid not in self._miners:
                self._miners[uid] = MinerData(uid)
            self._miners[uid].add_entry(entry)
            self._total_processed += 1
            new_dicts.append(entry.to_dict())
        if truly_new:
            self._db.insert_score_entries(truly_new)
        return new_dicts

    def get_all_miners_summary(self) -> List[dict]:
        return [m.get_stats() for m in sorted(self._miners.values(), key=lambda x: x.uid)]

    def add_ranking(self, rank_entries: List[RankEntry]) -> bool:
        """Deduplicate, persist to DB, and update in-memory ranking snapshots."""
        new_entries = []
        for e in rank_entries:
            key = (e.timestamp, e.rank, e.uid)
            if key not in self._seen_rank_events:
                self._seen_rank_events.add(key)
                new_entries.append(e)
        if not new_entries:
            return False
        # Persist before grouping
        self._db.insert_ranking_entries(new_entries)
        # Split into snapshots: rank=1 starts a new set_weights snapshot
        snapshots: List[list] = []
        current: list = []
        for e in new_entries:
            if e.rank == 1 and current:
                snapshots.append(current)
                current = []
            current.append(e)
        if current:
            snapshots.append(current)
        for group in snapshots:
            group.sort(key=lambda e: e.rank)
            self._rankings.append({
                "timestamp": group[0].timestamp,
                "entries": [e.to_dict() for e in group],
            })
        return True

    def get_latest_ranking(self) -> Optional[dict]:
        return self._rankings[-1] if self._rankings else None

    def add_challenge_entries(self, entries: List[ChallengeEntry]) -> bool:
        """Deduplicate by task_id, persist to DB, and update in-memory counts."""
        truly_new = []
        for e in entries:
            if e.task_id in self._seen_task_ids:
                continue
            self._seen_task_ids.add(e.task_id)
            truly_new.append(e)
            key = (e.category, e.output_label)
            self._task_dist[key] = self._task_dist.get(key, 0) + 1
        if truly_new:
            self._db.insert_challenge_entries(truly_new)
        return bool(truly_new)

    def get_task_distribution(self) -> List[dict]:
        rows = [
            {"category": cat, "output_label": label, "count": cnt}
            for (cat, label), cnt in self._task_dist.items()
        ]
        rows.sort(key=lambda r: (-r["count"], r["category"], r["output_label"]))
        return rows

    def get_miner(self, uid: int) -> Optional[dict]:
        m = self._miners.get(uid)
        return m.to_dict() if m else None

    def get_miner_paginated(self, uid: int, page: int = 1, page_size: int = 50) -> Optional[dict]:
        """Return paginated scores for a miner with category/output_label from challenge JOIN."""
        m = self._miners.get(uid)
        if m is None:
            return None
        scores = self._db.load_miner_scores_paginated(uid, page, page_size)
        total = self._db.get_miner_score_count(uid)
        return {
            "uid": uid,
            "stats": m.get_stats(),
            "scores": scores,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    def get_score_matrix(self) -> dict:
        miners = sorted(self._miners.values(), key=lambda x: x.uid)
        rows = []
        for m in miners:
            stats = m.get_stats()
            slots = []
            for e in m.scores:
                slots.append({
                    "score": e.score,
                    "reason": e.reason,
                    "task_id": e.task_id,
                    "timestamp": e.timestamp,
                    "response_time_ms": e.response_time_ms,
                })
            while len(slots) < WINDOW_SIZE:
                slots.append(None)
            rows.append({
                "uid": m.uid,
                "avg_score": stats.get("avg_score"),
                "latest_score": stats.get("latest_score"),
                "slots": slots,
            })
        return {"rows": rows, "window_size": WINDOW_SIZE}

    def clear(self):
        """Reset all state (called when the WandB run changes)."""
        self._miners.clear()
        self._seen.clear()
        self._total_processed = 0
        self._rankings.clear()
        self._seen_rank_events.clear()
        self._task_dist.clear()
        self._seen_task_ids.clear()
        self._db.clear_all()

    def get_overall_stats(self) -> dict:
        if not self._miners:
            return {"total_miners": 0, "total_processed": 0}
        all_scores = [e.score for m in self._miners.values() for e in m.scores]
        return {
            "total_miners": len(self._miners),
            "total_processed": self._total_processed,
            "overall_avg_score": statistics.mean(all_scores) if all_scores else 0.0,
            "overall_max_score": max(all_scores) if all_scores else 0.0,
        }
