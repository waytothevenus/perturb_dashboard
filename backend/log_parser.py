import re
import math
from dataclasses import dataclass
from typing import Optional

TIMESTAMP_LINE = re.compile(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$')

# Legacy two-line correlation header (older runs). Kept so historical
# log replays still pair task_id/response_time_ms with the score line.
LEGACY_TASK_PATTERN = re.compile(
    r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s*\|\s*\S+\s*\|\s*INFO\s*\|'
    r'\s*verify_and_score\s+task_id=(\S+)\s+response_time_ms=(\d+)'
)

# Batch header (new format) — emitted once per scoring round.
# Carries the timestamp the trailing bare `uid=` lines inherit.
BATCH_HEADER_PATTERN = re.compile(
    r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s*\|\s*\S+\s*\|\s*INFO\s*\|'
    r'\s*miner_response_evaluations\s+block=(\d+)\s+count=(\d+)'
)

# Challenge summary (new format) — task_id for the upcoming batch.
# Fields are alphabetical and `true_label` may contain spaces, so each
# field is extracted independently rather than via positional capture.
CHALLENGE_SUMMARY_PATTERN = re.compile(
    r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s*\|\s*\S+\s*\|\s*INFO\s*\|'
    r'(?:\s*\[run_id=[^\]]*\])?\s*challenge_summary\b'
)
_CS_TASK_ID     = re.compile(r'\btask_id=(\S+)')
_CS_PROMPT      = re.compile(r'\bprompt=(\S+)')
_CS_EPSILON     = re.compile(r'\bepsilon=([\d.eE+\-]+)')
_CS_LLM_VERIF   = re.compile(r'\bllm_verified=(\w+)')
_CS_FALLBACK    = re.compile(r'\bfallback_used=(\w+)')
_CS_TRUE_LABEL  = re.compile(r'\btrue_label=(.+?)\s*$')

# Score line — handles both formats:
#   • old: `<ts> | name | INFO | uid=… score=… processed=… …`  (no response_time_ms)
#   • new: `uid=… score=… response_time_ms=… processed=… …`    (no line prefix)
SCORE_PATTERN = re.compile(
    r'(?:(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s*\|\s*\S+\s*\|\s*INFO\s*\|\s*)?'
    r'uid=(\d+)\s+status=(\d+)\s+score=([\d.eE+\-]+)'
    r'(?:\s+response_time_ms=(\d+))?'
    r'\s+processed=(\d+)'
    r'\s+reason=(\S+)\s+norm=([\d.eE+\-]+)\s+rmse=([\d.eE+\-]+)'
    r'\s+epsilon=([\d.eE+\-]+)\s+ssim=([\d.eE+\-]+)\s+psnr_db=([\d.eE+\-]+|inf|-inf)'
)

RANK_PATTERN = re.compile(
    r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3})\s*\|\s*\S+\s*\|\s*INFO\s*\|'
    r'\s*rank=(\d+)\s+uid=(\d+)\s+avg100=([\d.eE+\-]+)'
    r'\s+emission_raw=([\d.eE+\-]+)\s+emission=([\d.eE+\-]+)'
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


@dataclass
class RankEntry:
    timestamp: str
    rank: int
    uid: int
    avg100: float
    emission_raw: float
    emission: float

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "rank": self.rank,
            "uid": self.uid,
            "avg100": self.avg100,
            "emission_raw": self.emission_raw,
            "emission": self.emission,
        }


@dataclass
class ChallengeEntry:
    timestamp: str
    task_id: str
    category: str        # source: `prompt`
    output_label: str    # source: `true_label`
    epsilon: float
    llm_verified: bool
    fallback_used: bool


class LogParser:
    """Stateful parser.

    New-format batch (no timestamp prefix on uid lines):
        <ts> | __main__ | INFO | [run_id=…] challenge_summary epsilon=… task_id=T …
        <ts> | __main__ | INFO | miner_response_evaluations block=B count=N
        uid=1 status=… score=… response_time_ms=… processed=… reason=… …
        uid=3 status=… score=… response_time_ms=… processed=… reason=… …

    Each bare `uid=` line inherits the batch's timestamp + task_id.

    Legacy format (kept for historical replays) emits a per-uid
    `verify_and_score task_id=… response_time_ms=…` line right before
    the prefixed `uid=…` line.
    """

    def __init__(self):
        self._batch_timestamp: Optional[str] = None
        self._batch_task_id:   Optional[str] = None
        self._legacy_pending:  Optional[dict] = None

    def parse_lines(self, lines: list) -> tuple:
        """Returns (score_entries, rank_entries, challenge_entries)."""
        score_entries: list = []
        rank_entries: list = []
        challenge_entries: list = []

        for raw in lines:
            line = raw.strip()
            if not line or TIMESTAMP_LINE.match(line):
                continue

            batch_m = BATCH_HEADER_PATTERN.search(line)
            if batch_m:
                self._batch_timestamp = batch_m.group(1)
                continue

            cs_m = CHALLENGE_SUMMARY_PATTERN.search(line)
            if cs_m:
                ts        = cs_m.group(1)
                task_m    = _CS_TASK_ID.search(line)
                prompt_m  = _CS_PROMPT.search(line)
                eps_m     = _CS_EPSILON.search(line)
                llm_m     = _CS_LLM_VERIF.search(line)
                fb_m      = _CS_FALLBACK.search(line)
                label_m   = _CS_TRUE_LABEL.search(line)
                if task_m:
                    self._batch_task_id = task_m.group(1)
                    challenge_entries.append(ChallengeEntry(
                        timestamp=ts,
                        task_id=task_m.group(1),
                        category=prompt_m.group(1) if prompt_m else "",
                        output_label=label_m.group(1).strip() if label_m else "",
                        epsilon=_safe_float(eps_m.group(1)) if eps_m else 0.0,
                        llm_verified=(llm_m.group(1) == 'True') if llm_m else False,
                        fallback_used=(fb_m.group(1) == 'True') if fb_m else False,
                    ))
                continue

            legacy_m = LEGACY_TASK_PATTERN.search(line)
            if legacy_m:
                self._legacy_pending = {
                    "task_id": legacy_m.group(2),
                    "response_time_ms": int(legacy_m.group(3)),
                }
                continue

            score_m = SCORE_PATTERN.search(line)
            if score_m:
                line_ts   = score_m.group(1)
                inline_rt = score_m.group(5)

                timestamp = line_ts or self._batch_timestamp or ""
                if inline_rt is not None:
                    response_time_ms = int(inline_rt)
                    task_id = self._batch_task_id
                elif self._legacy_pending:
                    response_time_ms = self._legacy_pending["response_time_ms"]
                    task_id = self._legacy_pending["task_id"]
                    self._legacy_pending = None
                else:
                    response_time_ms = None
                    task_id = self._batch_task_id

                score_entries.append(ScoreEntry(
                    timestamp=timestamp,
                    task_id=task_id,
                    response_time_ms=response_time_ms,
                    uid=int(score_m.group(2)),
                    status=int(score_m.group(3)),
                    score=_safe_float(score_m.group(4)),
                    processed=int(score_m.group(6)),
                    reason=score_m.group(7),
                    norm=_safe_float(score_m.group(8)),
                    rmse=_safe_float(score_m.group(9)),
                    epsilon=_safe_float(score_m.group(10)),
                    ssim=_safe_float(score_m.group(11)),
                    psnr_db=_safe_float(score_m.group(12)),
                ))
                continue

            rank_m = RANK_PATTERN.search(line)
            if rank_m:
                rank_entries.append(RankEntry(
                    timestamp=rank_m.group(1),
                    rank=int(rank_m.group(2)),
                    uid=int(rank_m.group(3)),
                    avg100=_safe_float(rank_m.group(4)),
                    emission_raw=_safe_float(rank_m.group(5)),
                    emission=_safe_float(rank_m.group(6)),
                ))

        return score_entries, rank_entries, challenge_entries
