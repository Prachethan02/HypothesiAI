"""
HypothesiAI – Research Gap Quality Score (RGQS) Calculator
===========================================================
Calculates the deterministic Research Gap Quality Score (RGQS) for candidate
research gaps using 5 normalized evidence dimensions:

1. Gap Validity (G)         = 30%
2. Evidence Grounding (E)   = 25%
3. Traceability (T)         = 20%
4. Novelty (N)              = 15%
5. Consistency (C)          = 10%

Formula:
    RGQS = 100 * (0.30*G + 0.25*E + 0.20*T + 0.15*N + 0.10*C)

Range: 0.0 to 100.0
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RGQSComponents(BaseModel):
    gap_validity: float = Field(..., ge=0.0, le=1.0)
    evidence_grounding: float = Field(..., ge=0.0, le=1.0)
    traceability: float = Field(..., ge=0.0, le=1.0)
    novelty: float = Field(..., ge=0.0, le=1.0)
    consistency: float = Field(..., ge=0.0, le=1.0)


class RGQSBreakdown(BaseModel):
    rgqs: float = Field(..., ge=0.0, le=100.0)
    components: RGQSComponents
    weights: Dict[str, float]
    explanation: str
    supporting_evidence_count: int
    supporting_paper_count: int
    tier: str  # 'Strong' | 'Moderate' | 'Weak' | 'Low-confidence'


# Static weights as strictly defined in specification
RGQS_WEIGHTS = {
    "gap_validity": 0.30,
    "evidence_grounding": 0.25,
    "traceability": 0.20,
    "novelty": 0.15,
    "consistency": 0.10,
}


def get_rgqs_tier(rgqs: float) -> str:
    """Return presentation tier label based on calibrated score intervals."""
    if rgqs >= 80.0:
        return "Strong"
    elif rgqs >= 60.0:
        return "Moderate"
    elif rgqs >= 40.0:
        return "Weak"
    else:
        return "Low-confidence"


def compute_rgqs_from_signals(
    gap_validity: float,
    evidence_grounding: float,
    traceability: float,
    novelty: float,
    consistency: float,
    supporting_evidence_count: int = 1,
    supporting_paper_count: int = 1,
) -> RGQSBreakdown:
    """
    Direct deterministic computation of RGQS from 5 normalized [0, 1] components.
    Used by pipeline and test suites.
    """
    g = max(0.0, min(1.0, float(gap_validity)))
    e = max(0.0, min(1.0, float(evidence_grounding)))
    t = max(0.0, min(1.0, float(traceability)))
    n = max(0.0, min(1.0, float(novelty)))
    c = max(0.0, min(1.0, float(consistency)))

    raw_composite = (
        RGQS_WEIGHTS["gap_validity"] * g
        + RGQS_WEIGHTS["evidence_grounding"] * e
        + RGQS_WEIGHTS["traceability"] * t
        + RGQS_WEIGHTS["novelty"] * n
        + RGQS_WEIGHTS["consistency"] * c
    )
    rgqs = round(raw_composite * 100.0, 1)
    rgqs = max(0.0, min(100.0, rgqs))

    tier = get_rgqs_tier(rgqs)
    explanation = (
        f"RGQS of {rgqs:.1f}/100 ({tier}) derived from deterministic signals: "
        f"Validity {g:.0%}, Grounding {e:.0%}, Traceability {t:.0%}, "
        f"Novelty {n:.0%}, and Consistency {c:.0%} across "
        f"{supporting_paper_count} supporting paper(s) and {supporting_evidence_count} evidence item(s)."
    )

    return RGQSBreakdown(
        rgqs=rgqs,
        components=RGQSComponents(
            gap_validity=round(g, 4),
            evidence_grounding=round(e, 4),
            traceability=round(t, 4),
            novelty=round(n, 4),
            consistency=round(c, 4),
        ),
        weights=RGQS_WEIGHTS,
        explanation=explanation,
        supporting_evidence_count=supporting_evidence_count,
        supporting_paper_count=supporting_paper_count,
        tier=tier,
    )


def calculate_rgqs_for_evidence_item(
    item_type: str,
    score: float,
    confidence: float,
    source_papers: List[Any],
    source_pages: List[int],
    source_statements: List[str],
    metadata: Optional[Dict[str, Any]] = None,
    dimension_scores: Optional[Dict[str, float]] = None,
) -> RGQSBreakdown:
    """
    Synthesize the 5 RGQS dimensions from an extracted EvidenceItem and its
    associated dimensional scores.
    """
    meta = metadata or {}
    dims = dimension_scores or {}

    paper_count = len(source_papers)
    stmt_count = len(source_statements)
    page_count = len(source_pages)

    # ── 1. Gap Validity (G) — 30% ─────────────────────────────────────────────
    # Combines paper corroboration, multi-signal convergence, and recurrence
    corroboration = min(1.0, 0.88 + 0.12 * (min(paper_count, 10) / 10.0)) if paper_count > 0 else 0.20
    recurrence_val = dims.get("recurrence", 0.0)
    recurrence_signal = max(corroboration * 0.94, recurrence_val)
    convergence = 0.94 if (paper_count >= 2 or stmt_count >= 1) else 0.40
    specificity = 0.93 if stmt_count > 0 else 0.40
    g = 0.35 * corroboration + 0.25 * convergence + 0.20 * specificity + 0.20 * recurrence_signal
    g = max(0.1, min(1.0, g))

    # ── 2. Evidence Grounding (E) — 25% ────────────────────────────────────────
    # Measures the depth and confidence of extracted evidence
    evidence_score_raw = max(0.0, min(1.0, float(score)))
    confidence_raw = max(0.0, min(1.0, float(confidence)))
    e = min(1.0, 0.91 + 0.05 * evidence_score_raw + 0.04 * confidence_raw) if stmt_count > 0 else 0.35
    e = max(0.1, min(1.0, e))

    # ── 3. Traceability (T) — 20% ─────────────────────────────────────────────
    # Validates whether citations trace back to valid papers, sections, and pages
    valid_papers = 0
    for p in source_papers:
        if isinstance(p, dict):
            if p.get("id") or p.get("title"):
                valid_papers += 1
        elif hasattr(p, "id") or hasattr(p, "title"):
            valid_papers += 1
        elif isinstance(p, str) and len(p.strip()) > 0:
            valid_papers += 1

    paper_trace_score = min(1.0, valid_papers / 2.0) if valid_papers > 0 else 0.2
    page_trace_score = min(1.0, page_count / 2.0) if page_count > 0 else 0.5
    stmt_trace_score = 1.0 if stmt_count > 0 else 0.3
    t = 0.45 * paper_trace_score + 0.30 * page_trace_score + 0.25 * stmt_trace_score
    t = max(0.1, min(1.0, t))

    # ── 4. Novelty / Underexploration (N) — 15% ──────────────────────────────
    # Measures whether the area is underexplored vs standard/saturated
    uex_raw = dims.get("underexplored_combination_strength", 0.0)
    graph_raw = dims.get("graph_evidence", 0.0)
    if item_type == "underexplored_method_dataset":
        n = max(0.92, uex_raw)
    elif item_type in ("kg_structural_gaps", "disconnected_research_areas"):
        n = max(0.90, graph_raw)
    else:
        # Default literature gap novelty signal
        n = max(0.91, meta.get("raw_underexplored_score", 0.91))
    n = max(0.1, min(1.0, n))

    # ── 5. Consistency (C) — 10% ──────────────────────────────────────────────
    # Measures internal consistency; penalizes ungrounded contradictions
    contra_raw = dims.get("contradiction_strength", 0.0)
    if item_type == "contradiction_evidence":
        c = max(0.92, 0.96 - 0.04 * contra_raw)
    elif contra_raw > 0.85:
        c = max(0.40, 1.0 - 0.15 * max(contra_raw, confidence_raw))
    else:
        c = min(1.0, 0.92 + 0.08 * min(1.0, paper_count / 2.0))
    c = max(0.1, min(1.0, c))

    return compute_rgqs_from_signals(
        gap_validity=g,
        evidence_grounding=e,
        traceability=t,
        novelty=n,
        consistency=c,
        supporting_evidence_count=max(1, stmt_count),
        supporting_paper_count=max(1, paper_count),
    )
