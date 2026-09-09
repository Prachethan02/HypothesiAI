"""
Pydantic schemas for Stage 14 – Unified Evidence Aggregation Engine.
Aggregates multi-signal analytical outputs into structured candidate research-gap Evidence objects.
Hypothesis generation is strictly deferred to future stages.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ScoringWeightsConfig(BaseModel):
    recurring_limitations: float = Field(default=0.12, ge=0.0, le=1.0)
    future_work_frequency: float = Field(default=0.12, ge=0.0, le=1.0)
    limitation_clusters: float = Field(default=0.15, ge=0.0, le=1.0)
    topic_trends: float = Field(default=0.06, ge=0.0, le=1.0)
    underexplored_method_dataset: float = Field(default=0.12, ge=0.0, le=1.0)
    contradiction_evidence: float = Field(default=0.15, ge=0.0, le=1.0)
    kg_structural_gaps: float = Field(default=0.10, ge=0.0, le=1.0)
    disconnected_research_areas: float = Field(default=0.08, ge=0.0, le=1.0)
    temporal_decline_stagnation: float = Field(default=0.05, ge=0.0, le=1.0)
    independent_paper_support: float = Field(default=0.05, ge=0.0, le=1.0)


class SourcePaperRef(BaseModel):
    id: str
    title: str
    doi: Optional[str] = None
    publication_year: Optional[int] = None


class EvidenceItem(BaseModel):
    evidence_id: str = Field(..., description="Unique UUID for this candidate research-gap evidence")
    type: str = Field(
        ...,
        description=(
            "Evidence signal type: 'recurring_limitations', 'future_work_frequency', "
            "'limitation_clusters', 'topic_trends', 'underexplored_method_dataset', "
            "'contradiction_evidence', 'kg_structural_gaps', 'disconnected_research_areas', "
            "'temporal_decline_stagnation', or 'independent_paper_support'"
        ),
    )
    title: str = Field(..., description="Concise title summarizing the candidate research gap signal")
    description: str = Field(..., description="Objective, structured description of the evidence")
    score: float = Field(..., ge=0.0, le=1.0, description="Normalized weighted evidence score")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in the underlying analytical signal")
    source_papers: List[SourcePaperRef] = Field(default_factory=list, description="Associated source papers")
    source_pages: List[int] = Field(default_factory=list, description="Referenced page numbers from original PDFs")
    source_statements: List[str] = Field(default_factory=list, description="Verbatim statement snippets from the corpus")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Signal-specific analytical metrics")


class EvidenceAggregationRequest(BaseModel):
    weights: Optional[ScoringWeightsConfig] = None
    min_score: float = Field(default=0.20, ge=0.0, le=1.0, description="Filter out candidate evidence below score")
    min_paper_support: int = Field(default=1, ge=1, description="Minimum independent papers required")
    target_domain: Optional[str] = Field(default=None, description="Optional domain or topic filter")


class EvidenceAggregationStats(BaseModel):
    total_signals_evaluated: int
    candidate_evidence_count: int
    signals_by_type: Dict[str, int]
    papers_covered: int


class EvidenceAggregationResponse(BaseModel):
    success: bool
    run_id: str
    weights_used: ScoringWeightsConfig
    stats: EvidenceAggregationStats
    evidence: List[EvidenceItem]
    message: Optional[str] = None
