from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

class TopicDocumentInput(BaseModel):
    id: str = Field(..., description="Unique ID of the document/statement")
    text: str = Field(..., description="Text content of the document")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional metadata (e.g., paper_id, statement_type)")

class TopicGenerationRequest(BaseModel):
    documents: List[TopicDocumentInput] = Field(..., description="List of documents to cluster into topics")
    nr_topics: Optional[str] = Field(default="auto", description="Number of topics. 'auto' or integer as string.")
    min_topic_size: int = Field(default=3, description="Minimum size of a topic")

class TopicRepresentation(BaseModel):
    word: str
    score: float

class TopicResult(BaseModel):
    topic_id: int
    name: str
    representation: List[TopicRepresentation]
    frequency: int
    representative_docs: List[str]

class TopicGenerationResponse(BaseModel):
    success: bool
    model_id: str
    topics: List[TopicResult]
    document_mapping: Dict[str, int] = Field(..., description="Mapping of input document ID -> topic_id (-1 for outliers)")
