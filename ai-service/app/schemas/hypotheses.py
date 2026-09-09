"""
Pydantic schemas for Stage 16 – Evidence-Grounded Hypothesis Generation.

Models the 9 required output dimensions and the complete empirical evidence bundle
fed to the LLM. Ensures strict separation of evidence from inference.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class VariableItem(BaseModel):
    """A research variable identified for the hypothesis."""
    name: str = Field(..., description="Name of the variable")
    type: str = Field(..., description="Variable classification: 'independent', 'dependent', or 'control'")
    description: str = Field(..., description="Operational definition and measurement approach")


class SupportingEvidenceRef(BaseModel):
    """Explicit mapping to an empirical evidence item or source paper."""
    evidence_id: str = Field(..., description="Source evidence ID or paper ID")
    type: str = Field(..., description="Evidence modality (e.g. limitation, contradiction, pattern)")
    description: str = Field(..., description="Summary of the empirical finding")
    source_paper_title: Optional[str] = Field(default=None, description="Title of the originating paper")


class GroundedHypothesis(BaseModel):
    """
    Evidence-grounded scientific hypothesis synthesized from analytical signals.
    Contains all 9 required output dimensions.
    """
    hypothesis_id: str = Field(..., description="Unique UUID for this generated hypothesis")
    gap_id: str = Field(..., description="Target ranked research gap identifier")
    title: str = Field(..., description="Descriptive headline for the hypothesis")

    # 1. hypothesis
    hypothesis: str = Field(..., description="Clear, testable empirical hypothesis statement")

    # 2. research question
    research_question: str = Field(..., description="The primary research inquiry addressing the gap")

    # 3. rationale
    rationale: str = Field(..., description="Scientific motivation derived strictly from the supplied evidence")

    # 4. expected relationship
    expected_relationship: str = Field(..., description="Nature and direction of relation between variables/methods")

    # 5. variables
    variables: List[VariableItem] = Field(default_factory=list, description="Independent, dependent, and control variables")

    # 6. possible methodology
    possible_methodology: str = Field(..., description="Proposed evaluation setup, benchmarks, and experimental protocol")

    # 7. expected contribution
    expected_contribution: str = Field(..., description="Novel scientific or practical contribution if confirmed")

    # 8. supporting evidence
    supporting_evidence: List[SupportingEvidenceRef] = Field(
        default_factory=list,
        description="Explicit mappings to the provided evidence items and papers",
    )

    # 9. limitations/uncertainty
    limitations_uncertainty: str = Field(
        ...,
        description="Boundary conditions, potential confounding factors, and methodological uncertainties",
    )

    # Audit & Provenance Metadata
    evidence_bundle: Dict[str, Any] = Field(
        default_factory=dict,
        description="The exact evidence inputs provided to the LLM",
    )
    confidence_score: float = Field(default=0.85, ge=0.0, le=1.0)
    llm_provider: str = Field(default="gemini", description="LLM provider name (API keys never exposed)")
    llm_model: str = Field(default="gemini-1.5-pro", description="LLM model identifier")
    regeneration_count: int = Field(default=0, ge=0, description="Number of times this hypothesis was regenerated")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    updated_at: Optional[str] = Field(default=None, description="ISO 8601 update timestamp")


class GenerateHypothesisRequest(BaseModel):
    gap_id: str = Field(..., description="ID of the Stage 15 ranked gap to formulate a hypothesis for")
    force_regenerate: bool = Field(default=False, description="Whether to re-run generation even if one exists")
    temperature: float = Field(default=0.2, ge=0.0, le=1.0, description="Sampling temperature for the LLM")


class GenerateHypothesisResponse(BaseModel):
    success: bool
    hypothesis: Optional[GroundedHypothesis] = None
    evidence_used: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
