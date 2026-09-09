"""
Stage 15 – Research-Gap Ranking Engine: FastAPI endpoints.

GET  /research-gaps/weights   — default RankingWeightsConfig
POST /research-gaps/rank      — compute and store ranked gaps
GET  /research-gaps           — list ranked gaps (with filters)
GET  /research-gaps/{gap_id}  — detail for a single gap
"""
from __future__ import annotations

import uuid
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.ranking import (
    GapRankingRequest,
    GapRankingResponse,
    RankedGap,
    RankingWeightsConfig,
)
from app.pipeline.ranking.gap_ranking_service import gap_ranking_service
from app.db.store import gap_ranking_store

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/weights", response_model=RankingWeightsConfig)
async def get_ranking_weights():
    """Return the default configurable ranking weights for all 9 dimensions."""
    return RankingWeightsConfig()


@router.post("/rank", response_model=GapRankingResponse)
async def rank_research_gaps(req: GapRankingRequest):
    """
    Compute explainable composite scores for all Stage 14 candidate evidence items
    and return them as ranked research gaps.

    NOTE: Composite scores are computationally derived evidence signals.
    They are not verified scientific conclusions.
    """
    run_id = str(uuid.uuid4())
    try:
        ranked_gaps, total_candidates, weights_used = gap_ranking_service.rank_gaps(
            weights=req.weights,
            min_composite_score=req.min_composite_score,
            min_evidence_count=req.min_evidence_count,
            top_k=req.top_k,
        )

        # Persist result in in-memory store
        gap_ranking_store[run_id] = {
            "run_id": run_id,
            "ranked_gaps": [g.model_dump() for g in ranked_gaps],
            "total_candidates": total_candidates,
            "weights_used": weights_used.model_dump(),
        }

        # Also index by gap_id for fast detail lookups
        for gap in ranked_gaps:
            gap_ranking_store[f"gap:{gap.gap_id}"] = gap.model_dump()

        return GapRankingResponse(
            success=True,
            run_id=run_id,
            ranked_gaps=ranked_gaps,
            total_candidates=total_candidates,
            weights_used=weights_used,
            message=(
                f"Ranked {len(ranked_gaps)} candidate gap(s) from "
                f"{total_candidates} evidence items. "
                "Scores are evidence signals only."
            ),
        )
    except Exception as exc:
        logger.exception("Gap ranking failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("", response_model=Dict[str, Any])
async def list_research_gaps(
    min_score: float = Query(default=0.0, ge=0.0, le=1.0),
    top_k: Optional[int] = Query(default=None, ge=1),
    evidence_type: Optional[str] = Query(default=None),
):
    """
    List ranked research gaps. Results are sorted by composite score descending.
    Use min_score, top_k, and evidence_type to narrow the result set.
    """
    # Collect all gaps from the most recent ranking run
    all_gaps: List[Dict[str, Any]] = []
    for key, val in gap_ranking_store.items():
        if key.startswith("gap:"):
            all_gaps.append(val)

    # Apply filters
    if min_score > 0:
        all_gaps = [g for g in all_gaps if g.get("composite_score", 0) >= min_score]
    if evidence_type:
        all_gaps = [g for g in all_gaps if g.get("evidence_type") == evidence_type]

    all_gaps.sort(key=lambda g: g.get("composite_score", 0), reverse=True)

    if top_k is not None:
        all_gaps = all_gaps[:top_k]

    # Re-number ranks after filtering
    for i, g in enumerate(all_gaps, start=1):
        g["rank"] = i

    return {
        "success": True,
        "total": len(all_gaps),
        "ranked_gaps": all_gaps,
    }


@router.get("/{gap_id}", response_model=Dict[str, Any])
async def get_research_gap(gap_id: str):
    """Return the full detail for a single ranked research gap by its gap_id."""
    gap = gap_ranking_store.get(f"gap:{gap_id}")
    if gap is None:
        # Try DB fallback
        try:
            import psycopg2, os, json  # type: ignore
            conn = psycopg2.connect(
                host=os.getenv("POSTGRES_HOST", "localhost"),
                port=int(os.getenv("POSTGRES_PORT", "5432")),
                dbname=os.getenv("POSTGRES_DB", "hypothesiai"),
                user=os.getenv("POSTGRES_USER", "postgres"),
                password=os.getenv("POSTGRES_PASSWORD", ""),
            )
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM ranked_research_gaps WHERE gap_id = %s", (gap_id,)
            )
            row = cur.fetchone()
            cur.close()
            conn.close()
            if row is None:
                raise HTTPException(status_code=404, detail=f"Gap '{gap_id}' not found.")
            cols = [d[0] for d in cur.description] if cur.description else []
            gap = dict(zip(cols, row))
        except HTTPException:
            raise
        except Exception as db_exc:
            logger.warning("DB lookup failed for gap %s: %s", gap_id, db_exc)
            raise HTTPException(status_code=404, detail=f"Gap '{gap_id}' not found.")

    return {"success": True, "gap": gap}
