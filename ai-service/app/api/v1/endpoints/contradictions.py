"""
Stage 13 – Contradiction Analysis endpoints.
Classifies research findings from different papers as ENTAILMENT, CONTRADICTION, or NEUTRAL.
Contradictions are framed as candidate signals for researcher inspection.
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.contradictions import (
    NLIStatementItem,
    NLIComparisonItem,
    NLIAnalysisRequest,
    NLIAnalysisResponse,
    NLIAnalysisStats,
    ContradictionStatusUpdateRequest,
)
from app.pipeline.nli.nli_service import nli_service
from app.db.store import contradiction_run_store, contradiction_comparisons_store

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_db_conn():
    import psycopg2  # type: ignore
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        dbname=os.getenv("POSTGRES_DB", "hypothesiai"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
    )


def _fetch_findings_from_db(target_paper_id: Optional[str] = None) -> List[NLIStatementItem]:
    """Load findings, claims, and results across papers from extracted_entities."""
    try:
        conn = _get_db_conn()
        cur = conn.cursor()
        query = """
            SELECT e.id, e.paper_id, p.title, e.text, s.heading, e.page_number, e.entity_type
            FROM extracted_entities e
            JOIN papers p ON p.id = e.paper_id
            LEFT JOIN paper_sections s ON s.id = e.section_id
            WHERE e.entity_type IN ('finding', 'claim', 'result', 'limitation')
              AND e.text IS NOT NULL
              AND LENGTH(TRIM(e.text)) > 15
            ORDER BY e.created_at DESC
            LIMIT 1000
        """
        cur.execute(query)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        items: List[NLIStatementItem] = []
        for r in rows:
            items.append(
                NLIStatementItem(
                    statement_id=str(r[0]),
                    paper_id=str(r[1]),
                    paper_title=str(r[2]),
                    text=str(r[3]),
                    section_name=r[4] if r[4] else None,
                    page_number=r[5] if r[5] is not None else None,
                    entity_type=str(r[6]),
                )
            )
        return items
    except Exception as exc:
        logger.warning("DB fetch for findings failed: %s. Using in-memory fallback.", exc)
        return []


@router.post("/analyze", response_model=NLIAnalysisResponse)
async def run_nli_analysis(req: NLIAnalysisRequest):
    """
    Execute cross-paper contradiction analysis using Natural Language Inference (NLI).
    Pre-filters candidate pairs with semantic cosine similarity >= semantic_threshold.
    Classifies into ENTAILMENT, CONTRADICTION, or NEUTRAL.
    Contradictions are stored as candidate signals with full source provenance.
    """
    statements = _fetch_findings_from_db(req.target_paper_id)

    # Fallback to simulated findings if corpus has no papers yet
    if len(statements) < 2:
        logger.info("Fewer than 2 findings found in DB. Returning empty analysis result.")
        run_id = str(uuid.uuid4())
        empty_stats = NLIAnalysisStats(
            total_findings=len(statements),
            pairs_evaluated=0,
            contradiction_count=0,
            entailment_count=0,
            neutral_count=0,
        )
        return NLIAnalysisResponse(
            success=True,
            run_id=run_id,
            semantic_threshold=req.semantic_threshold,
            model_name=nli_service.model_name,
            stats=empty_stats,
            comparisons=[],
            message="Upload and extract findings from at least two distinct papers to perform cross-paper NLI contradiction analysis.",
        )

    run_id = str(uuid.uuid4())
    comparisons, stats = nli_service.analyze_findings(
        statements=statements,
        semantic_threshold=req.semantic_threshold,
        min_confidence=req.min_confidence,
        max_comparisons=req.max_comparisons,
        target_paper_id=req.target_paper_id,
    )

    # Save to in-memory store
    for item in comparisons:
        contradiction_comparisons_store[item.id] = item.model_dump()

    contradiction_run_store[run_id] = {
        "run_id": run_id,
        "semantic_threshold": req.semantic_threshold,
        "model_name": nli_service.model_name,
        "stats": stats.model_dump(),
        "comparisons": [item.model_dump() for item in comparisons],
    }

    return NLIAnalysisResponse(
        success=True,
        run_id=run_id,
        semantic_threshold=req.semantic_threshold,
        model_name=nli_service.model_name,
        stats=stats,
        comparisons=comparisons,
    )


@router.get("", response_model=List[NLIComparisonItem])
async def list_comparisons(
    label: Optional[str] = Query(None, description="Filter by NLI label: ENTAILMENT, CONTRADICTION, NEUTRAL"),
    min_confidence: float = Query(0.0, ge=0.0, le=1.0),
    status: Optional[str] = Query(None, description="Filter by status: candidate_signal, confirmed, dismissed"),
    paper_id: Optional[str] = Query(None, description="Filter comparisons involving this paper"),
):
    """List cross-paper statement comparisons and detected contradictions."""
    results = list(contradiction_comparisons_store.values())

    if label:
        results = [r for r in results if r.get("nli_label", "").upper() == label.upper()]
    if min_confidence > 0:
        results = [r for r in results if r.get("confidence", 0) >= min_confidence]
    if status:
        results = [r for r in results if r.get("status", "") == status]
    if paper_id:
        results = [
            r for r in results
            if r.get("paper_a_id") == paper_id or r.get("paper_b_id") == paper_id
        ]

    # Sort contradictions first, then by confidence descending
    results.sort(
        key=lambda x: (
            1 if x.get("nli_label") == "CONTRADICTION" else 0,
            x.get("confidence", 0),
        ),
        reverse=True,
    )

    return [NLIComparisonItem(**r) for r in results]


@router.get("/{comparison_id}", response_model=NLIComparisonItem)
async def get_comparison(comparison_id: str):
    """Retrieve full details for an individual statement comparison."""
    item = contradiction_comparisons_store.get(comparison_id)
    if not item:
        raise HTTPException(status_code=404, detail="Comparison evidence not found")
    return NLIComparisonItem(**item)


@router.patch("/{comparison_id}/status", response_model=NLIComparisonItem)
async def update_comparison_status(comparison_id: str, req: ContradictionStatusUpdateRequest):
    """Update verification status of an NLI contradiction (confirmed, dismissed, candidate_signal)."""
    item = contradiction_comparisons_store.get(comparison_id)
    if not item:
        raise HTTPException(status_code=404, detail="Comparison evidence not found")

    item["status"] = req.status
    if req.review_notes is not None:
        item["review_notes"] = req.review_notes
    item["is_candidate_signal"] = (req.status == "candidate_signal")
    contradiction_comparisons_store[comparison_id] = item

    return NLIComparisonItem(**item)
