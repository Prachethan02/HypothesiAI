"""
Pydantic schemas for Stage 13 – Contradiction Analysis using Natural Language Inference (NLI).
Classifies relationships as: ENTAILMENT, CONTRADICTION, NEUTRAL.
Contradictions are framed as candidate signals, not scientific truth.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class NLIStatementItem(BaseModel):
    statement_id: str
    paper_id: str
    paper_title: str
    text: str
    section_name: Optional[str] = None
    page_number: Optional[int] = None
    entity_type: Optional[str] = "finding"


class NLIComparisonItem(BaseModel):
    id: str
    statement_a_id: str
    statement_a_text: str
    statement_a_page: Optional[int] = None
    statement_a_section: Optional[str] = None
    paper_a_id: str
    paper_a_title: str

    statement_b_id: str
    statement_b_text: str
    statement_b_page: Optional[int] = None
    statement_b_section: Optional[str] = None
    paper_b_id: str
    paper_b_title: str

    nli_label: str = Field(
        ...,
        description="Relationship classification: 'ENTAILMENT', 'CONTRADICTION', or 'NEUTRAL'",
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Model confidence in the predicted relationship"
    )
    semantic_similarity: float = Field(
        ..., ge=0.0, le=1.0, description="Cosine similarity of statement embeddings"
    )
    probabilities: Dict[str, float] = Field(
        default_factory=dict,
        description="Softmax probability distribution over {'entailment', 'contradiction', 'neutral'}",
    )
    status: str = Field(
        default="candidate_signal",
        description="Verification state: 'candidate_signal', 'confirmed', or 'dismissed'",
    )
    review_notes: Optional[str] = None
    is_candidate_signal: bool = Field(
        default=True,
        description="Flag indicating this contradiction is an unverified candidate signal",
    )


class NLIAnalysisRequest(BaseModel):
    semantic_threshold: float = Field(
        default=0.55,
        ge=0.2,
        le=0.95,
        description="Minimum embedding cosine similarity to consider statements semantically relevant",
    )
    min_confidence: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Minimum NLI model confidence to retain classified pair",
    )
    max_comparisons: int = Field(
        default=500,
        ge=10,
        le=2000,
        description="Maximum statement pairs to evaluate via NLI classifier",
    )
    target_paper_id: Optional[str] = Field(
        default=None,
        description="Optional filter to compare statements against a specific paper",
    )


class NLIAnalysisStats(BaseModel):
    total_findings: int
    pairs_evaluated: int
    contradiction_count: int
    entailment_count: int
    neutral_count: int


class NLIAnalysisResponse(BaseModel):
    success: bool
    run_id: str
    semantic_threshold: float
    model_name: str
    stats: NLIAnalysisStats
    comparisons: List[NLIComparisonItem]
    message: Optional[str] = None


class ContradictionStatusUpdateRequest(BaseModel):
    status: str = Field(
        ...,
        description="New verification status: 'confirmed', 'dismissed', or 'candidate_signal'",
    )
    review_notes: Optional[str] = None
