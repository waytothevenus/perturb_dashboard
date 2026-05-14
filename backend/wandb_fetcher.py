"""Fetch WandB run log lines via GraphQL logLines API.

Uses `useImprovedPagination: true` which provides true chronological cursor-
based pagination through the full log history. On the first call (no cursor)
it pages through the entire log from the beginning. On subsequent calls the
saved cursor means only new lines are fetched.

Fallback: local file (LOG_FILE_PATH env var).
"""

import base64
import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_PAGE_SIZE = 500


def _wandb_config() -> tuple:
    """Read WandB config at call time so .env loading order doesn't matter."""
    return (
        os.environ.get("WANDB_ENTITY",  "perturb-ai"),
        os.environ.get("WANDB_PROJECT", "perturb-validator"),
        os.environ.get("WANDB_RUN_ID",  "dk9ms8qo"),
    )

_LOG_LINES_QUERY = """
query RunLogLines($entity: String!, $project: String!, $run: String!, $after: String, $first: Int) {
  project(entityName: $entity, name: $project) {
    run(name: $run) {
      logLineCount
      logLines(first: $first, after: $after, useImprovedPagination: true) {
        pageInfo { hasNextPage endCursor }
        edges { node { line } }
      }
    }
  }
}
"""


def _gql_page(api_key: str, after: Optional[str] = None) -> tuple:
    """Fetch one page of log lines.
    Returns (lines, has_next, end_cursor, total).
    """
    entity, project, run_id = _wandb_config()
    creds = base64.b64encode(f"api:{api_key}".encode()).decode()
    headers = {
        "Authorization": f"Basic {creds}",
        "Content-Type": "application/json",
    }
    variables = {
        "entity":  entity,
        "project": project,
        "run":     run_id,
        "first":   _PAGE_SIZE,
        "after":   after,
    }
    resp = requests.post(
        "https://api.wandb.ai/graphql",
        json={"query": _LOG_LINES_QUERY, "variables": variables},
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    if "errors" in data:
        raise RuntimeError(f"GraphQL errors: {data['errors']}")

    project_data = data.get("data", {}).get("project")
    if project_data is None:
        raise RuntimeError(f"WandB project not found: {entity}/{project}")
    run_data = project_data.get("run")
    if run_data is None:
        raise RuntimeError(f"WandB run not found: {entity}/{project}/{run_id}")
    total      = run_data.get("logLineCount", 0)
    ll         = run_data.get("logLines", {})
    pi         = ll.get("pageInfo", {})
    edges      = ll.get("edges", [])
    lines      = [e["node"]["line"] for e in edges]
    has_next   = pi.get("hasNextPage", False)
    end_cursor = pi.get("endCursor", None)
    return lines, has_next, end_cursor, total


def fetch_new_lines_wandb(api_key: str, after_cursor: Optional[str]) -> tuple:
    """Fetch all log lines added after `after_cursor`.

    With useImprovedPagination each page returns a distinct chronological
    slice. Pages through the full history on first call (cursor=None), then
    only fetches new lines on subsequent calls.

    Returns (new_lines: list[str], new_cursor: str|None).
    """
    all_lines: list = []
    cursor      = after_cursor
    last_cursor = after_cursor

    while True:
        try:
            lines, has_next, end_cursor, _total = _gql_page(api_key, after=cursor)
        except Exception as exc:
            logger.warning("WandB logLines fetch failed: %s", exc)
            break

        if lines:
            all_lines.extend(lines)
        if end_cursor:
            last_cursor = end_cursor

        if not has_next:
            break
        cursor = end_cursor

    logger.info("Fetched %d log lines (cursor: %s → %s)", len(all_lines), after_cursor, last_cursor)
    return all_lines, last_cursor


# ── Local file fallback ────────────────────────────────────────────────────────

def fetch_new_lines_local(path: str, last_count: int) -> tuple:
    """Read new lines from a local file since `last_count`.
    Returns (new_lines: list[str], new_count: int).
    """
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        all_lines = fh.read().splitlines()
    return all_lines[last_count:], len(all_lines)
