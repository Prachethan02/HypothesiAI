"""
Pydantic schemas for Stage 12 – Research Pattern Mining.
Results are labelled "underexplored candidate", never "research gap".
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Request ──────────────────────────────────────────────────────────────────

class PatternMiningRequest(BaseModel):
    min_support: float = Field(
        default=0.02, ge=0.001, le=1.0,
        description="Minimum support threshold for FP-Growth / Apriori (fraction of papers).",
    )
    min_confidence: float = Field(
        default=0.3, ge=0.0, le=1.0,
        description="Minimum confidence for association rules.",
    )
    algorithm: str = Field(
        default="fpgrowth",
        description="Pattern mining algorithm: 'fpgrowth' or 'apriori'.",
    )
    combo_types: List[str] = Field(
        default=["method+dataset", "method+metric", "method+domain", "method+dataset+metric"],
        description="Combination types to mine.",
    )
    papers_entities: Optional[Dict[str, List[Dict[str, Any]]]] = Field(
        default=None,
        description="Optional dict of paper_id -> list of extracted entities.",
    )


# ── Frequent pattern ─────────────────────────────────────────────────────────

class FrequentPattern(BaseModel):
    pattern_id: str
    run_id: str
    pattern_label: str
    items: List[str]
    entity_types: List[str]
    support: float
    paper_count: int
    paper_ids: List[str]
    algorithm: str
    combo_type: str


# ── Association rule ─────────────────────────────────────────────────────────

class AssociationRule(BaseModel):
    rule_id: str
    run_id: str
    antecedent: List[str]
    consequent: List[str]
    support: float
    confidence: float
    lift: float
    paper_count: int
    paper_ids: List[str]


# ── Underexplored candidate ──────────────────────────────────────────────────

class UnderexploredCandidate(BaseModel):
    candidate_id: str
    run_id: str
    combo_type: str
    items: List[str]
    combo_label: str
    observed_support: Optional[float] = None
    underexplored_score: float = Field(
        description="Heuristic signal strength [0-1]. Higher = more underexplored. NOT a gap score.",
    )
    paper_count: int
    paper_ids: List[str]
    label: str = Field(
        default="underexplored candidate",
        description="Always 'underexplored candidate'. Never 'research gap' unless externally validated.",
    )
    note: str


# ── Stats ────────────────────────────────────────────────────────────────────

class PatternMiningStats(BaseModel):
    frequent_pattern_count: int
    association_rule_count: int
    underexplored_candidate_count: int


# ── Response ─────────────────────────────────────────────────────────────────

class PatternMiningResponse(BaseModel):
    success: bool
    run_id: str
    algorithm: str
    n_papers: int
    min_support: float
    min_confidence: float
    frequent_patterns: List[FrequentPattern]
    association_rules: List[AssociationRule]
    underexplored_candidates: List[UnderexploredCandidate]
    stats: PatternMiningStats


# ── List / summary responses ─────────────────────────────────────────────────

class PatternRunSummary(BaseModel):
    run_id: str
    algorithm: str
    n_papers: int
    min_support: float
    frequent_pattern_count: int
    association_rule_count: int
    underexplored_candidate_count: int
    created_at: Optional[str] = None


class PatternListResponse(BaseModel):
    success: bool
    runs: List[PatternRunSummary] = Field(default_factory=list)
    latest_run_id: Optional[str] = None
