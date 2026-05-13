import statistics
from collections import deque
from typing import Dict, List, Optional

from log_parser import ScoreEntry

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
    def __init__(self):
        self._miners: Dict[int, MinerData] = {}
        self._total_processed = 0
        # Deduplication: track (uid, processed) pairs already stored.
        # WandB captures stdout from multiple workers so the same log line
        # appears many times. The `processed` field is a per-uid monotonic
        # counter, so (uid, processed) uniquely identifies a scoring event.
        self._seen: set = set()

    def add_entries(self, entries: List[ScoreEntry]) -> List[dict]:
        """Add entries, skipping duplicates; return new entries as dicts.

        Entries are sorted by (uid, processed) so the per-miner deque always
        holds scores in ascending processed order.
        """
        new_dicts = []
        # Sort so entries are added in ascending processed order per uid
        for entry in sorted(entries, key=lambda e: (e.uid, e.processed)):
            key = (entry.uid, entry.processed)
            if key in self._seen:
                continue
            self._seen.add(key)
            uid = entry.uid
            if uid not in self._miners:
                self._miners[uid] = MinerData(uid)
            self._miners[uid].add_entry(entry)
            self._total_processed += 1
            new_dicts.append(entry.to_dict())
        return new_dicts

    def get_all_miners_summary(self) -> List[dict]:
        return [m.get_stats() for m in sorted(self._miners.values(), key=lambda x: x.uid)]

    def get_miner(self, uid: int) -> Optional[dict]:
        m = self._miners.get(uid)
        return m.to_dict() if m else None

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
