"""
Pydantic schemas for Stage 11 – Evidence Clustering endpoints.
Clusters are evidence signals, not research gaps.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------

class ClusterRunRequest(BaseModel):
    min_cluster_size: int = Field(
        default=3,
        ge=2,
        description="HDBSCAN minimum cluster size. Smaller values produce more clusters.",
    )
    min_samples: Optional[int] = Field(
        default=None,
        description="HDBSCAN min_samples. Defaults to min_cluster_size - 1 if omitted.",
    )
    include_noise: bool = Field(
        default=True,
        description="Whether to include noise/outlier cluster (label -1) in the response.",
    )
    statement_types: List[str] = Field(
        default=["limitation", "future_work", "problem"],
        description="Which statement types to include in clustering.",
    )
    documents: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional list of documents to cluster directly instead of querying database.",
    )


# ---------------------------------------------------------------------------
# Evidence item within a cluster
# ---------------------------------------------------------------------------

class EvidenceStatementOut(BaseModel):
    document_id: str
    paper_id: Optional[str] = None
    paper_title: Optional[str] = None
    statement_type: str
    text: str
    similarity_to_centroid: Optional[float] = None
    is_representative: bool = False


# ---------------------------------------------------------------------------
# Individual cluster
# ---------------------------------------------------------------------------

class EvidenceClusterOut(BaseModel):
    cluster_id: int
    is_noise: bool = False
    statement_type: str
    name: str
    summary: str
    size: int
    paper_count: int
    paper_ids: List[str] = Field(default_factory=list)
    representative_statements: List[str] = Field(default_factory=list)
    top_terms: List[Dict[str, Any]] = Field(default_factory=list)
    evidence: List[EvidenceStatementOut] = Field(default_factory=list)
    signal_kind: str = Field(
        default="evidence_cluster",
        description="Clusters are evidence signals, not research gaps.",
    )


# ---------------------------------------------------------------------------
# Run response
# ---------------------------------------------------------------------------

class ClusterRunStats(BaseModel):
    algorithm: str
    min_cluster_size: int
    document_count: int
    cluster_count: int
    noise_count: int


class ClusterRunResponse(BaseModel):
    success: bool
    run_id: str
    clusters: List[EvidenceClusterOut]
    noise_cluster: Optional[EvidenceClusterOut] = None
    document_mapping: Dict[str, int] = Field(
        default_factory=dict,
        description="Map of document_id -> cluster_id (-1 = noise).",
    )
    stats: ClusterRunStats


# ---------------------------------------------------------------------------
# List response (lightweight, no full evidence)
# ---------------------------------------------------------------------------

class EvidenceClusterSummary(BaseModel):
    cluster_id: int
    is_noise: bool
    statement_type: str
    name: str
    summary: str
    size: int
    paper_count: int
    signal_kind: str = "evidence_cluster"


class ClusterListResponse(BaseModel):
    success: bool
    run_id: Optional[str] = None
    clusters: List[EvidenceClusterSummary] = Field(default_factory=list)
    noise_count: int = 0
    total_clustered: int = 0
    stats: Optional[ClusterRunStats] = None
