"""
Pydantic schemas for Stage 15 – Research-Gap Ranking Engine.

Computes explainable composite scores from Stage 14 evidence items using
9 configurable dimensions. Scores are evidence-derived signals; they are NOT
presented as objective scientific truth.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.schemas.evidence import EvidenceItem, SourcePaperRef


class RankingWeightsConfig(BaseModel):
    """
    9 configurable weight dimensions for composing a gap's overall score.
    All values must be between 0.0 and 1.0. Weights are normalised internally
    so they do not need to sum to 1.
    """
    recurrence: float = Field(
        default=0.15, ge=0.0, le=1.0,
        description="Weight for how frequently the gap theme recurs across the corpus.",
    )
    evidence_strength: float = Field(
        default=0.20, ge=0.0, le=1.0,
        description="Weight for the raw evidence score from Stage 14 aggregation.",
    )
    independent_paper_support: float = Field(
        default=0.15, ge=0.0, le=1.0,
        description="Weight for the number of independent papers that surface the signal.",
    )
    contradiction_strength: float = Field(
        default=0.12, ge=0.0, le=1.0,
        description="Weight for the presence and strength of NLI-detected contradictions.",
    )
    underexplored_combination_strength: float = Field(
        default=0.12, ge=0.0, le=1.0,
        description="Weight for underexplored method-dataset or method-metric combinations.",
    )
    topic_relevance: float = Field(
        default=0.08, ge=0.0, le=1.0,
        description="Weight for how strongly the gap is associated with a coherent topic cluster.",
    )
    temporal_signal: float = Field(
        default=0.06, ge=0.0, le=1.0,
        description="Weight for temporal evidence (declining coverage, stagnating trend).",
    )
    graph_evidence: float = Field(
        default=0.07, ge=0.0, le=1.0,
        description="Weight for knowledge-graph structural gap signals.",
    )
    confidence: float = Field(
        default=0.05, ge=0.0, le=1.0,
        description="Weight for the model confidence in the underlying analytical signal.",
    )


class RankedGapDimension(BaseModel):
    """A single dimension contribution to a gap's composite score."""
    name: str
    weight: float
    raw_score: float = Field(..., ge=0.0, le=1.0)
    weighted_contribution: float = Field(..., ge=0.0)
    explanation: str


class RankedGap(BaseModel):
    """A candidate research gap with an explainable composite ranking score."""
    gap_id: str = Field(..., description="Unique identifier (same as source evidence_id)")
    title: str
    description: str
    composite_score: float = Field(..., ge=0.0, le=1.0)
    confidence: float = Field(..., ge=0.0, le=1.0)
    rank: int = Field(..., ge=1)
    dimensions: List[RankedGapDimension] = Field(
        default_factory=list,
        description="Per-dimension breakdown of the composite score.",
    )
    evidence_type: str = Field(..., description="Primary evidence signal type from Stage 14")
    evidence_ids: List[str] = Field(
        default_factory=list,
        description="Traceability: IDs of Stage 14 evidence items that back this gap.",
    )
    source_papers: List[SourcePaperRef] = Field(default_factory=list)
    source_pages: List[int] = Field(default_factory=list)
    source_statements: List[str] = Field(default_factory=list)
    why_identified: str = Field(
        ...,
        description=(
            "Machine-generated prose explaining which evidence signals drove identification. "
            "This is a computational summary, not a verified scientific conclusion."
        ),
    )
    rgqs: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Research Gap Quality Score (0-100) combining Validity, Grounding, Traceability, Novelty, Consistency.",
    )
    rgqs_breakdown: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Detailed 5-dimension breakdown of the RGQS calculation.",
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)


class GapRankingRequest(BaseModel):
    weights: Optional[RankingWeightsConfig] = None
    min_composite_score: float = Field(
        default=0.10, ge=0.0, le=1.0,
        description="Exclude gaps whose composite score is below this threshold.",
    )
    min_evidence_count: int = Field(
        default=1, ge=1,
        description="Minimum number of source evidence items required.",
    )
    top_k: Optional[int] = Field(
        default=None, ge=1,
        description="Return at most top-k gaps. None means return all.",
    )


class GapRankingResponse(BaseModel):
    success: bool
    run_id: str
    ranked_gaps: List[RankedGap]
    total_candidates: int
    weights_used: RankingWeightsConfig
    message: Optional[str] = None
