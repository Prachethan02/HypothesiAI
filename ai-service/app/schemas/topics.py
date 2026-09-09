from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any


class TopicDocumentInput(BaseModel):
    id: str = Field(..., description="Unique ID of the document/statement")
    text: str = Field(..., description="Text content of the document")
    embedding: Optional[List[float]] = Field(
        default=None,
        description="Optional precomputed MiniLM embedding. Generated if omitted.",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="paper_id, statement_type, paper_title, entity provenance",
    )


class ClusterDocumentInput(TopicDocumentInput):
    pass


class TopicGenerationRequest(BaseModel):
    documents: List[TopicDocumentInput] = Field(..., description="Statements to cluster")
    nr_topics: Optional[str] = Field(default="auto", description="Unused by HDBSCAN; kept for compatibility")
    min_topic_size: int = Field(default=3, description="Deprecated alias of min_cluster_size")
    min_cluster_size: int = Field(default=3, ge=2, description="HDBSCAN minimum cluster size")
    min_samples: Optional[int] = Field(default=None, description="HDBSCAN min_samples; defaults to min_cluster_size - 1")


class ClusterGenerationRequest(TopicGenerationRequest):
    pass


class TopicRepresentation(BaseModel):
    word: str
    score: float


class ClusterEvidenceItem(BaseModel):
    document_id: str
    paper_id: Optional[str] = None
    paper_title: Optional[str] = None
    statement_type: str
    text: str
    similarity_to_centroid: Optional[float] = None
    is_representative: bool = False


class ClusterResult(BaseModel):
    cluster_id: int
    is_noise: bool = False
    statement_type: str
    name: str
    summary: str
    representation: List[TopicRepresentation] = Field(default_factory=list)
    size: int
    paper_count: int
    paper_ids: List[str] = Field(default_factory=list)
    representative_statements: List[str] = Field(default_factory=list)
    evidence: List[ClusterEvidenceItem] = Field(default_factory=list)
    signal_kind: str = Field(
        default="evidence_cluster",
        description="Clusters are evidence signals, not research gaps.",
    )


class TopicResult(ClusterResult):
    """Backward-compatible alias used by older clients."""

    topic_id: Optional[int] = None
    frequency: Optional[int] = None
    representative_docs: Optional[List[str]] = None

    def model_post_init(self, __context: Any) -> None:
        if self.topic_id is None:
            self.topic_id = self.cluster_id
        if self.frequency is None:
            self.frequency = self.size
        if self.representative_docs is None:
            self.representative_docs = self.representative_statements


class TopicGenerationResponse(BaseModel):
    success: bool
    model_id: str
    algorithm: str = "hdbscan"
    min_cluster_size: int = 3
    signal_kind: str = "evidence_cluster"
    topics: List[ClusterResult]
    document_mapping: Dict[str, int] = Field(
        ...,
        description="Mapping of input document ID -> cluster_id (-1 for HDBSCAN noise/outliers)",
    )
    stats: Dict[str, Any] = Field(default_factory=dict)


class ClusterGenerationResponse(TopicGenerationResponse):
    pass
