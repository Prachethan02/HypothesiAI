from __future__ import annotations
from fastapi import APIRouter, HTTPException, status
from app.pipeline.resolution.resolver import EntityResolver
from app.pipeline.resolution.config import ResolutionConfig
from app.schemas.resolution import (
    ResolveEntitiesRequest,
    ResolveEntitiesResponse,
    PairCompareRequest,
    PairCompareResponse,
    ResolutionConfigSchema,
)

router = APIRouter()
default_resolver = EntityResolver()


@router.post(
    "/resolve",
    response_model=ResolveEntitiesResponse,
    status_code=status.HTTP_200_OK,
    summary="Normalize and cluster research entities",
    description=(
        "Normalizes a batch of research entities by combining exact matching, "
        "RapidFuzz string/token similarity, scientific acronym expansion, and "
        "Sentence-Transformer semantic cosine similarity, with strict anti-merging guardrails "
        "and complete decision audit trail."
    ),
)
async def resolve_entities(request: ResolveEntitiesRequest) -> ResolveEntitiesResponse:
    try:
        cfg = ResolutionConfig.from_dict(request.config.model_dump() if request.config else None)
        resolver = EntityResolver(cfg)
        return resolver.resolve_batch(request.entities, cfg)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Entity resolution failed: {str(e)}",
        )


@router.post(
    "/compare",
    response_model=PairCompareResponse,
    status_code=status.HTTP_200_OK,
    summary="Compare a pair of candidate entities",
    description="Evaluates two entities and returns whether they should merge with confidence, method, and audit decision.",
)
async def compare_entity_pair(request: PairCompareRequest) -> PairCompareResponse:
    try:
        cfg = ResolutionConfig.from_dict(request.config.model_dump() if request.config else None)
        resolver = EntityResolver(cfg)
        should_merge, canonical, score, method, conf, decision = resolver.compare_pair(
            request.entity_a, request.entity_b, cfg
        )
        return PairCompareResponse(
            should_merge=should_merge,
            canonical_entity=canonical,
            similarity_score=score,
            resolution_method=method,
            confidence=conf,
            decision=decision,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Entity comparison failed: {str(e)}",
        )


@router.get(
    "/config",
    response_model=ResolutionConfigSchema,
    status_code=status.HTTP_200_OK,
    summary="Get default resolution thresholds and options",
)
async def get_resolution_config() -> ResolutionConfigSchema:
    cfg = default_resolver.config
    return ResolutionConfigSchema(
        exact_match_threshold=cfg.exact_match_threshold,
        rapidfuzz_token_sort_threshold=cfg.rapidfuzz_token_sort_threshold,
        rapidfuzz_ratio_threshold=cfg.rapidfuzz_ratio_threshold,
        semantic_cosine_threshold=cfg.semantic_cosine_threshold,
        hybrid_min_confidence=cfg.hybrid_min_confidence,
        rapidfuzz_weight=cfg.rapidfuzz_weight,
        semantic_weight=cfg.semantic_weight,
        require_type_match=cfg.require_type_match,
        enable_acronym_matching=cfg.enable_acronym_matching,
    )
