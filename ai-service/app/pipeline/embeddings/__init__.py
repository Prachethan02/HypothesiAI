"""
HypothesiAI — Semantic Embeddings Package
=========================================
Stage 7 Sentence-Transformer MiniLM embedding generation and cosine similarity utilities.
"""
from app.pipeline.embeddings.embedding_service import (
    EmbeddingService,
    embedding_service,
    compute_content_hash,
    compute_embedding_id,
)
from app.pipeline.embeddings.cosine import (
    cosine_similarity,
    batch_cosine_similarity,
    pairwise_cosine_similarity,
    find_most_similar,
)

__all__ = [
    "EmbeddingService",
    "embedding_service",
    "compute_content_hash",
    "compute_embedding_id",
    "cosine_similarity",
    "batch_cosine_similarity",
    "pairwise_cosine_similarity",
    "find_most_similar",
]
