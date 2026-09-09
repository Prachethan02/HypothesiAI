"""
Stage 12 – Research Pattern Mining endpoint.

POST /patterns/run      – trigger FP-Growth/Apriori mining
GET  /patterns          – list runs (summary)
GET  /patterns/latest   – full result of the latest run
GET  /patterns/{run_id} – full result for a specific run
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.pattern_mining import (
    PatternMiningRequest,
    PatternMiningResponse,
    PatternMiningStats,
    PatternListResponse,
    PatternRunSummary,
    FrequentPattern,
    AssociationRule,
    UnderexploredCandidate,
)
from app.pipeline.patterns.pattern_mining_service import mine_patterns
from app.db.store import pattern_run_store  # in-memory fallback

router = APIRouter()
logger = logging.getLogger(__name__)


# ── DB helpers ────────────────────────────────────────────────────────────────

def _get_db_conn():
    import psycopg2  # type: ignore
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        dbname=os.getenv("POSTGRES_DB", "hypothesiai"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
    )


def _fetch_entities_by_paper() -> dict[str, list[dict]]:
    """Load extracted entities grouped by paper_id from PostgreSQL."""
    try:
        conn = _get_db_conn()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT paper_id, entity_type, text, normalized_name
            FROM extracted_entities
            WHERE entity_type IN ('method', 'dataset', 'metric', 'domain',
                                  'problem', 'population_domain')
              AND text IS NOT NULL
              AND LENGTH(TRIM(text)) > 2
            ORDER BY paper_id
            """
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        result: dict[str, list[dict]] = {}
        for paper_id, entity_type, text, normalized_name in rows:
            pid = str(paper_id)
            if pid not in result:
                result[pid] = []
            result[pid].append({
                "entity_type": entity_type,
                "text": text,
                "normalized_name": normalized_name or text,
            })
        return result
    except Exception as exc:
        logger.warning("DB fetch failed for pattern mining: %s", exc)
        return {}


def _build_response(data: dict) -> PatternMiningResponse:
    """Convert raw mine_patterns output dict to the response model."""
    return PatternMiningResponse(
        success=True,
        run_id=data["run_id"],
        algorithm=data["algorithm"],
        n_papers=data["n_papers"],
        min_support=data["min_support"],
        min_confidence=data["min_confidence"],
        frequent_patterns=[FrequentPattern(**p) for p in data["frequent_patterns"]],
        association_rules=[AssociationRule(**r) for r in data["association_rules"]],
        underexplored_candidates=[UnderexploredCandidate(**c) for c in data["underexplored_candidates"]],
        stats=PatternMiningStats(**data["stats"]),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/run", response_model=PatternMiningResponse, status_code=200)
async def run_pattern_mining(req: PatternMiningRequest):
    """
    Mine frequent research patterns using FP-Growth or Apriori.

    - Discovers frequent Method+Dataset, Method+Metric, Method+Domain,
      and Method+Dataset+Metric combinations.
    - Compares observed combinations with all candidate combinations to
      identify potentially underexplored ones.
    - Results are labelled **underexplored candidate** — NOT research gaps.
    """
    if req.papers_entities and len(req.papers_entities) > 0:
        entities_by_paper = req.papers_entities
    else:
        entities_by_paper = _fetch_entities_by_paper()

    if not entities_by_paper:
        raise HTTPException(
            status_code=400,
            detail=(
                "No entities found. "
                "Upload and process at least one paper first."
            ),
        )

    try:
        result = mine_patterns(
            entities_by_paper=entities_by_paper,
            min_support=req.min_support,
            min_confidence=req.min_confidence,
            algorithm=req.algorithm,
        )
    except Exception as exc:
        logger.error("Pattern mining failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Pattern mining failed: {exc}") from exc

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    # Cache result
    result["created_at"] = datetime.now(timezone.utc).isoformat()
    pattern_run_store[result["run_id"]] = result

    return _build_response(result)


@router.get("/latest", response_model=PatternMiningResponse)
async def get_latest_run():
    """Return the full result of the most recent pattern mining run."""
    if not pattern_run_store:
        raise HTTPException(
            status_code=404,
            detail="No pattern mining runs found. Trigger a run first.",
        )
    latest = list(pattern_run_store.values())[-1]
    return _build_response(latest)


@router.get("", response_model=PatternListResponse)
async def list_runs():
    """Return a lightweight summary list of all pattern mining runs."""
    summaries = []
    for data in pattern_run_store.values():
        summaries.append(
            PatternRunSummary(
                run_id=data["run_id"],
                algorithm=data["algorithm"],
                n_papers=data["n_papers"],
                min_support=data["min_support"],
                frequent_pattern_count=data["stats"]["frequent_pattern_count"],
                association_rule_count=data["stats"]["association_rule_count"],
                underexplored_candidate_count=data["stats"]["underexplored_candidate_count"],
                created_at=data.get("created_at"),
            )
        )
    latest_id = list(pattern_run_store.keys())[-1] if pattern_run_store else None
    return PatternListResponse(success=True, runs=summaries, latest_run_id=latest_id)


@router.get("/{run_id}", response_model=PatternMiningResponse)
async def get_run(run_id: str):
    """Return full pattern mining results for a specific run."""
    data = pattern_run_store.get(run_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found.")
    return _build_response(data)
