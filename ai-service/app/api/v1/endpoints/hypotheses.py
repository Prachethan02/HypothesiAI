"""
Stage 16 – Evidence-Grounded Hypothesis Generation: FastAPI endpoints.

POST /hypotheses/generate  — Generate or regenerate hypothesis from a ranked gap
GET  /hypotheses           — List all generated hypotheses
GET  /hypotheses/{id}      — Get a single hypothesis with full evidence bundle
GET  /hypotheses/by-gap/{gap_id} — Get hypothesis for a specific ranked gap
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.hypotheses import (
    GenerateHypothesisRequest,
    GenerateHypothesisResponse,
    GroundedHypothesis,
)
from app.pipeline.generation.hypothesis_generator import hypothesis_generator
from app.db.store import hypothesis_store

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/generate", response_model=GenerateHypothesisResponse)
async def generate_hypothesis(req: GenerateHypothesisRequest):
    """
    Generate or regenerate an evidence-grounded scientific hypothesis for a ranked research gap.
    Enforces strict anti-hallucination guardrails and extracts 9 structured dimensions.
    """
    try:
        hypothesis = hypothesis_generator.generate_hypothesis(
            gap_id=req.gap_id,
            force_regenerate=req.force_regenerate,
            temperature=req.temperature,
        )

        return GenerateHypothesisResponse(
            success=True,
            hypothesis=hypothesis,
            evidence_used=hypothesis.evidence_bundle,
            message=(
                f"Successfully synthesized hypothesis for gap '{req.gap_id}'. "
                f"Grounding verified across {len(hypothesis.supporting_evidence)} empirical references."
            ),
        )
    except Exception as exc:
        logger.exception("Hypothesis generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("", response_model=Dict[str, Any])
async def list_hypotheses(gap_id: Optional[str] = Query(default=None)):
    """List all generated hypotheses. Filterable by gap_id."""
    items: List[Dict[str, Any]] = []
    seen_ids = set()

    for key, val in hypothesis_store.items():
        if key.startswith("id:") and isinstance(val, dict):
            hid = val.get("hypothesis_id")
            if hid and hid not in seen_ids:
                seen_ids.add(hid)
                if gap_id and val.get("gap_id") != gap_id:
                    continue
                items.append(val)

    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return {
        "success": True,
        "total": len(items),
        "hypotheses": items,
    }


@router.get("/{hypothesis_id}", response_model=Dict[str, Any])
async def get_hypothesis(hypothesis_id: str):
    """Retrieve a single hypothesis by its hypothesis_id."""
    hypo = hypothesis_store.get(f"id:{hypothesis_id}")

    if not hypo:
        # Search by value
        for k, v in hypothesis_store.items():
            if isinstance(v, dict) and v.get("hypothesis_id") == hypothesis_id:
                hypo = v
                break

    if not hypo:
        raise HTTPException(status_code=404, detail=f"Hypothesis '{hypothesis_id}' not found.")

    return {
        "success": True,
        "hypothesis": hypo,
    }


@router.get("/by-gap/{gap_id}", response_model=Dict[str, Any])
async def get_hypothesis_by_gap(gap_id: str):
    """Retrieve hypothesis generated for a specific ranked research gap."""
    hypo = hypothesis_store.get(f"hypo:{gap_id}")

    if not hypo:
        raise HTTPException(status_code=404, detail=f"No hypothesis found for gap '{gap_id}'.")

    return {
        "success": True,
        "hypothesis": hypo,
    }
