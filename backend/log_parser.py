import re
import math
from dataclasses import dataclass
from typing import Optional

# Log line patterns
TIMESTAMP_LINE = re.compile(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$')

TASK_PATTERN = re.compile(
    r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s*\|\s*\S+\s*\|\s*INFO\s*\|'
    r'\s*verify_and_score\s+task_id=(\S+)\s+response_time_ms=(\d+)'
)

SCORE_PATTERN = re.compile(
    r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s*\|\s*\S+\s*\|\s*INFO\s*\|'
    r'\s*uid=(\d+)\s+status=(\d+)\s+score=([\d.eE+\-]+)\s+processed=(\d+)'
    r'\s+reason=(\S+)\s+norm=([\d.eE+\-]+)\s+rmse=([\d.eE+\-]+)'
    r'\s+epsilon=([\d.eE+\-]+)\s+ssim=([\d.eE+\-]+)\s+psnr_db=([\d.eE+\-]+|inf|-inf)'
)


def _safe_float(s: str) -> float:
    try:
        v = float(s)
        if math.isnan(v) or math.isinf(v):
            return 0.0
        return v
    except (ValueError, TypeError):
        return 0.0


@dataclass
class ScoreEntry:
    timestamp: str
    task_id: Optional[str]
    response_time_ms: Optional[int]
    uid: int
    status: int
    score: float
    processed: int
    reason: str
    norm: float
    rmse: float
    epsilon: float
    ssim: float
    psnr_db: float

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "task_id": self.task_id,
            "response_time_ms": self.response_time_ms,
            "uid": self.uid,
            "status": self.status,
            "score": self.score,
            "processed": self.processed,
            "reason": self.reason,
            "norm": self.norm,
            "rmse": self.rmse,
            "epsilon": self.epsilon,
            "ssim": self.ssim,
            "psnr_db": self.psnr_db,
        }


class LogParser:
    """Stateful parser that correlates verify_and_score lines with score lines."""

    def __init__(self):
        self._pending_task: Optional[dict] = None

    def parse_lines(self, lines: list) -> list:
        entries = []
        for line in lines:
            line = line.strip()
            if not line or TIMESTAMP_LINE.match(line):
                continue

            task_m = TASK_PATTERN.search(line)
            if task_m:
                self._pending_task = {
                    "task_id": task_m.group(2),
                    "response_time_ms": int(task_m.group(3)),
                }
                continue

            score_m = SCORE_PATTERN.search(line)
            if score_m:
                task_id = None
                response_time_ms = None
                if self._pending_task:
                    task_id = self._pending_task["task_id"]
                    response_time_ms = self._pending_task["response_time_ms"]
                    self._pending_task = None

                entry = ScoreEntry(
                    timestamp=score_m.group(1),
                    task_id=task_id,
                    response_time_ms=response_time_ms,
                    uid=int(score_m.group(2)),
                    status=int(score_m.group(3)),
                    score=_safe_float(score_m.group(4)),
                    processed=int(score_m.group(5)),
                    reason=score_m.group(6),
                    norm=_safe_float(score_m.group(7)),
                    rmse=_safe_float(score_m.group(8)),
                    epsilon=_safe_float(score_m.group(9)),
                    ssim=_safe_float(score_m.group(10)),
                    psnr_db=_safe_float(score_m.group(11)),
                )
                entries.append(entry)

        return entries
