"""
HypothesiAI — Stage 7: Embedding Schemas
========================================
Pydantic schemas for semantic embedding generation and cosine similarity utilities.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class EmbeddingItem(BaseModel):
    """A single embedded item with vector and metadata."""
    id: Optional[str] = Field(None, description="Optional entity or segment ID")
    text: str = Field(..., description="Original input text")
    embedding: list[float] = Field(..., description="Dense embedding vector")
    embedding_id: str = Field(..., description="Deterministic content-derived embedding identifier")
    dimension: int = Field(default=384, description="Vector dimensionality")
    normalized: bool = Field(default=True, description="Whether the vector is unit-normalized")


class BatchEmbeddingRequest(BaseModel):
    """Request payload for batch semantic embedding generation."""
    texts: list[str] = Field(..., min_length=1, description="List of strings to embed")
    items: Optional[list[dict]] = Field(None, description="Optional list of items with ID/text/metadata")
    model_name: Optional[str] = Field(None, description="Optional override of embedding model name")
    normalize: bool = Field(default=True, description="Whether to L2-normalize vectors for cosine similarity")
    batch_size: int = Field(default=32, ge=1, le=256, description="Batch processing chunk size")


class BatchEmbeddingResponse(BaseModel):
    """Response payload for batch embedding generation."""
    model_name: str
    dimension: int
    embeddings: list[EmbeddingItem]
    total_items: int
    cache_hits: int
    computed: int


class SimilarityRequest(BaseModel):
    """Request payload for cosine similarity evaluation."""
    query_text: Optional[str] = Field(None, description="Query text to embed and compare")
    query_vector: Optional[list[float]] = Field(None, description="Precomputed query embedding vector")
    candidate_texts: Optional[list[str]] = Field(None, description="Candidate strings to compare against query")
    candidate_vectors: Optional[list[list[float]]] = Field(None, description="Candidate embedding vectors")
    top_k: int = Field(default=5, ge=1, description="Number of top similar items to return")


class SimilarityMatch(BaseModel):
    """Ranked similarity result."""
    index: int = Field(..., description="Original index in candidates list")
    text: Optional[str] = Field(None, description="Text of the candidate item if provided")
    score: float = Field(..., description="Cosine similarity score between -1.0 and 1.0")


class SimilarityResponse(BaseModel):
    """Ranked list of similarity matches."""
    matches: list[SimilarityMatch]
    top_k: int


class CacheStatsResponse(BaseModel):
    """Embedding service cache and model statistics."""
    model_name: str
    dimension: int
    is_neural: bool
    cache_size: int
    hits: int
    misses: int
