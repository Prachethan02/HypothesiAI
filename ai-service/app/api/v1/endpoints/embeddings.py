"""
HypothesiAI — Stage 7: Embeddings API Endpoints
===============================================
Endpoints for batch semantic embedding generation, cosine similarity scoring,
and cache management using the MiniLM Sentence-Transformer service.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, status
from app.schemas.embeddings import (
    BatchEmbeddingRequest,
    BatchEmbeddingResponse,
    SimilarityRequest,
    SimilarityResponse,
    SimilarityMatch,
    CacheStatsResponse,
)
from app.pipeline.embeddings.embedding_service import embedding_service
from app.pipeline.embeddings.cosine import batch_cosine_similarity

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/generate",
    response_model=BatchEmbeddingResponse,
    summary="Generate semantic embeddings for a batch of texts",
    description=(
        "Processes a batch of texts or research items, computes 384-dimensional "
        "MiniLM embeddings, utilizes hash-based caching to avoid recomputing unchanged strings, "
        "and returns unit-normalized vectors ready for PostgreSQL/pgvector storage."
    ),
    status_code=status.HTTP_200_OK,
)
async def generate_embeddings(request: BatchEmbeddingRequest) -> BatchEmbeddingResponse:
    if not request.texts and not request.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "empty_input", "message": "Either 'texts' or 'items' must be provided"},
        )

    try:
        response = embedding_service.process_batch_request(
            texts=request.texts,
            items=request.items,
            batch_size=request.batch_size,
            normalize=request.normalize,
        )
        return response
    except Exception as exc:
        logger.exception("Error in batch embedding generation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "embedding_generation_failed", "message": str(exc)},
        ) from exc


@router.post(
    "/similarity",
    response_model=SimilarityResponse,
    summary="Compute cosine similarity between query and candidate texts/vectors",
    description=(
        "Computes cosine similarity ranking. Supports text-to-text, vector-to-vector, "
        "or mixed query and candidate evaluations."
    ),
    status_code=status.HTTP_200_OK,
)
async def evaluate_similarity(request: SimilarityRequest) -> SimilarityResponse:
    # 1. Resolve query vector
    if request.query_vector is not None:
        query_vec = request.query_vector
    elif request.query_text:
        query_vec = embedding_service.embed_text(request.query_text, normalize=True)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "missing_query", "message": "Either 'query_text' or 'query_vector' must be supplied"},
        )

    # 2. Resolve candidate vectors
    candidate_texts = request.candidate_texts or []
    if request.candidate_vectors is not None:
        cand_vectors = request.candidate_vectors
    elif candidate_texts:
        cand_vectors = embedding_service.embed_batch(candidate_texts, normalize=True)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "missing_candidates", "message": "Either 'candidate_texts' or 'candidate_vectors' must be supplied"},
        )

    if len(cand_vectors) == 0:
        return SimilarityResponse(matches=[], top_k=request.top_k)

    # 3. Compute cosine similarity
    try:
        scores = batch_cosine_similarity(query_vec, cand_vectors, is_normalized=True)
    except Exception as e:
        logger.exception("Error computing cosine similarity: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "similarity_calculation_error", "message": str(e)},
        ) from e

    # 4. Rank and build matches
    matches: list[SimilarityMatch] = []
    for idx, score in enumerate(scores):
        text_val = candidate_texts[idx] if idx < len(candidate_texts) else None
        matches.append(SimilarityMatch(
            index=idx,
            text=text_val,
            score=round(float(score), 4),
        ))

    matches.sort(key=lambda m: m.score, reverse=True)
    top_matches = matches[: request.top_k]

    return SimilarityResponse(matches=top_matches, top_k=request.top_k)


@router.get(
    "/stats",
    response_model=CacheStatsResponse,
    summary="Get embedding service cache statistics and active model metadata",
    status_code=status.HTTP_200_OK,
)
async def get_embedding_stats() -> CacheStatsResponse:
    stats = embedding_service.get_cache_stats()
    return CacheStatsResponse(**stats)


@router.post(
    "/clear-cache",
    summary="Clear the in-memory embedding hash cache",
    status_code=status.HTTP_200_OK,
)
async def clear_cache() -> dict[str, str]:
    embedding_service.clear_cache()
    return {"status": "cache_cleared"}
