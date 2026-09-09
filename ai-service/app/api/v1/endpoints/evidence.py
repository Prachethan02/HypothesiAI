"""
Stage 14 – Unified Evidence Aggregation endpoints.
Aggregates multi-signal analytical findings into structured candidate research-gap Evidence objects.
Hypothesis generation is strictly deferred to future stages.
"""
from __future__ import annotations

import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.evidence import (
    EvidenceItem,
    EvidenceAggregationRequest,
    EvidenceAggregationResponse,
    ScoringWeightsConfig,
)
from app.pipeline.ranking.evidence_aggregation_service import evidence_aggregation_service
from app.db.store import evidence_aggregation_store

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/aggregate", response_model=EvidenceAggregationResponse)
async def run_evidence_aggregation(req: EvidenceAggregationRequest):
    """
    Run multi-signal evidence aggregation.
    Synthesizes outputs across limitation clusters, patterns, NLI contradictions,
    knowledge graph gaps, and topic signals into structured Evidence objects.
    Scoring weights are fully configurable.
    """
    run_id = str(uuid.uuid4())
    evidence_items, stats, weights_used = evidence_aggregation_service.aggregate_evidence(
        weights=req.weights,
        min_score=req.min_score,
        min_paper_support=req.min_paper_support,
        target_domain=req.target_domain,
    )

    evidence_aggregation_store[run_id] = {
        "run_id": run_id,
        "weights_used": weights_used.model_dump(),
        "stats": stats.model_dump(),
        "evidence": [item.model_dump() for item in evidence_items],
    }

    return EvidenceAggregationResponse(
        success=True,
        run_id=run_id,
        weights_used=weights_used,
        stats=stats,
        evidence=evidence_items,
    )


@router.get("", response_model=List[EvidenceItem])
async def list_evidence(
    signal_type: Optional[str] = Query(None, description="Filter by evidence signal type"),
    min_score: float = Query(0.0, ge=0.0, le=1.0),
    run_id: Optional[str] = Query(None, description="Optional specific run ID"),
):
    """List aggregated candidate research-gap evidence items."""
    if run_id and run_id in evidence_aggregation_store:
        items = evidence_aggregation_store[run_id].get("evidence", [])
    elif evidence_aggregation_store:
        # Return most recent run's evidence
        latest_run = list(evidence_aggregation_store.values())[-1]
        items = latest_run.get("evidence", [])
    else:
        # Run on-the-fly aggregation with defaults
        evidence_items, _, _ = evidence_aggregation_service.aggregate_evidence(min_score=min_score)
        items = [item.model_dump() for item in evidence_items]

    results = items
    if signal_type:
        results = [r for r in results if r.get("type") == signal_type]
    if min_score > 0:
        results = [r for r in results if r.get("score", 0) >= min_score]

    return [EvidenceItem(**r) for r in results]


@router.get("/weights", response_model=ScoringWeightsConfig)
async def get_default_weights():
    """Retrieve the default scoring weights configuration."""
    return ScoringWeightsConfig()


@router.get("/{evidence_id}", response_model=EvidenceItem)
async def get_evidence_item(evidence_id: str):
    """Retrieve full details for an individual candidate research-gap evidence item."""
    for run_data in evidence_aggregation_store.values():
        for item in run_data.get("evidence", []):
            if item.get("evidence_id") == evidence_id:
                return EvidenceItem(**item)
    raise HTTPException(status_code=404, detail=f"Evidence item {evidence_id} not found")
