from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ResolutionConfigSchema(BaseModel):
    """Configurable thresholds and options for research entity normalization."""
    exact_match_threshold: float = Field(
        default=1.0,
        description="Threshold for exact normalized string matches"
    )
    rapidfuzz_token_sort_threshold: float = Field(
        default=0.85,
        ge=0.0,
        le=1.0,
        description="RapidFuzz Token Sort Ratio threshold for spelling/word-order variations"
    )
    rapidfuzz_ratio_threshold: float = Field(
        default=0.82,
        ge=0.0,
        le=1.0,
        description="RapidFuzz basic Ratio threshold"
    )
    semantic_cosine_threshold: float = Field(
        default=0.82,
        ge=0.0,
        le=1.0,
        description="MiniLM semantic embedding cosine similarity threshold"
    )
    hybrid_min_confidence: float = Field(
        default=0.85,
        ge=0.0,
        le=1.0,
        description="Minimum combined confidence required to merge under hybrid method"
    )
    rapidfuzz_weight: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Weight of RapidFuzz string score in hybrid resolution"
    )
    semantic_weight: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Weight of semantic cosine score in hybrid resolution"
    )
    require_type_match: bool = Field(
        default=True,
        description="Guardrail: strictly reject candidates with incompatible entity types"
    )
    enable_acronym_matching: bool = Field(
        default=True,
        description="Enable acronym and scientific abbreviation detection and expansion"
    )


class EntityItem(BaseModel):
    """A research entity item submitted for normalization."""
    id: Optional[str] = None
    text: str
    entity_type: str = "entity"
    paper_id: Optional[str] = None
    embedding: Optional[List[float]] = None
    metadata: Optional[Dict[str, Any]] = None


class ResolutionDecision(BaseModel):
    """Audit log record for an entity resolution decision (merged or rejected)."""
    decision_id: str
    original_text: str
    candidate_text: Optional[str] = None
    canonical_entity: str
    entity_type: str
    similarity_score: float
    resolution_method: str  # "exact", "abbreviation", "rapidfuzz", "cosine_embedding", "hybrid", "none"
    confidence: float
    decision: str  # "merged", "rejected", "new_canonical"
    rationale: str
    metrics: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str


class ResolvedEntity(BaseModel):
    """Final canonical resolution for an entity."""
    original_id: Optional[str] = None
    original_text: str
    canonical_entity: str
    entity_type: str
    similarity_score: float
    resolution_method: str
    confidence: float
    decision_id: str
    aliases: List[str] = Field(default_factory=list)


class ResolveEntitiesRequest(BaseModel):
    """Batch normalization request for entities."""
    entities: List[EntityItem]
    config: Optional[ResolutionConfigSchema] = None
    existing_canonicals: Optional[List[str]] = None


class ResolveEntitiesResponse(BaseModel):
    """Batch normalization response with resolved entities and full audit trail."""
    resolved_entities: List[ResolvedEntity]
    unique_canonical_count: int
    merged_count: int
    audit_trail: List[ResolutionDecision]


class PairCompareRequest(BaseModel):
    """Compare a pair of entities to decide if they should merge."""
    entity_a: EntityItem
    entity_b: EntityItem
    config: Optional[ResolutionConfigSchema] = None


class PairCompareResponse(BaseModel):
    """Detailed comparison response for an entity candidate pair."""
    should_merge: bool
    canonical_entity: str
    similarity_score: float
    resolution_method: str
    confidence: float
    decision: ResolutionDecision
