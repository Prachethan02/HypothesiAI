from fastapi import APIRouter
from app.api.v1.endpoints import health
from app.api.v1.endpoints import pipeline
from app.api.v1.endpoints import extraction
from app.api.v1.endpoints import embeddings
from app.api.v1.endpoints import resolution
from app.api.v1.endpoints import topics
from app.api.v1.endpoints import evidence_clusters
from app.api.v1.endpoints import patterns
from app.api.v1.endpoints import contradictions
from app.api.v1.endpoints import evidence
from app.api.v1.endpoints import research_gaps
from app.api.v1.endpoints import hypotheses

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
api_router.include_router(extraction.router, prefix="/extraction", tags=["extraction"])
api_router.include_router(embeddings.router, prefix="/embeddings", tags=["embeddings"])
api_router.include_router(resolution.router, prefix="/resolution", tags=["resolution"])
api_router.include_router(topics.router, prefix="/topics", tags=["topics"])
api_router.include_router(
    evidence_clusters.router,
    prefix="/evidence-clusters",
    tags=["evidence-clusters"],
)
api_router.include_router(patterns.router, prefix="/patterns", tags=["patterns"])
api_router.include_router(contradictions.router, prefix="/contradictions", tags=["contradictions"])
api_router.include_router(evidence.router, prefix="/evidence", tags=["evidence"])
api_router.include_router(research_gaps.router, prefix="/research-gaps", tags=["research-gaps"])
api_router.include_router(hypotheses.router, prefix="/hypotheses", tags=["hypotheses"])


