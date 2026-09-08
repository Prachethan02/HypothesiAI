"""
HypothesiAI — Stage 6: Extraction Schemas
========================================
Pydantic models for structured research-information extraction.
Every extracted entity retains full provenance:
  paper_id, page_number, section, text/span, entity_type, confidence, source_reference.
"""
from __future__ import annotations

import uuid
from typing import Optional, Literal
from pydantic import BaseModel, Field
from app.schemas.pipeline import TextSegment

# Canonical Entity Types matching user specification & domain model
EntityType = Literal[
    "method",
    "dataset",
    "metric",
    "concept",
    "finding",
    "limitation",
    "future_work",
    "objective",
    "population_domain",
]

ALL_ENTITY_TYPES: list[str] = [
    "method",
    "dataset",
    "metric",
    "concept",
    "finding",
    "limitation",
    "future_work",
    "objective",
    "population_domain",
]


class ExtractedEntitySchema(BaseModel):
    """
    Atomic extracted research entity with full provenance metadata.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paper_id: str = Field(..., description="UUID of the parent paper")
    page_number: Optional[int] = Field(None, description="1-indexed source page number")
    section: str = Field(..., description="Source section type (e.g. methods, results, limitations)")
    text: str = Field(..., description="Extracted entity mention, claim, or statement span")
    entity_type: str = Field(..., description="Categorized entity type")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Extraction confidence score")
    source_reference: str = Field(
        ...,
        description="Human-readable provenance citation, e.g. 'Section: methods, Page 3'",
    )
    normalized_name: Optional[str] = Field(None, description="Canonical or lemmatized form of the entity")
    metadata: dict = Field(default_factory=dict, description="Additional context, bounding boxes, or offsets")


class ExtractionRequest(BaseModel):
    """
    Request payload to extract research information from paper text segments.
    """
    paper_id: str = Field(..., description="UUID of the paper record")
    segments: list[TextSegment] = Field(..., description="List of segmented text blocks with provenance")
    enable_neural: bool = Field(default=True, description="Whether to execute DistilBERT components if available")


class ExtractionResult(BaseModel):
    """
    Complete response containing all extracted entities and summary metrics.
    """
    paper_id: str
    total_entities: int
    entities: list[ExtractedEntitySchema]
    entity_counts: dict[str, int] = Field(default_factory=dict)
