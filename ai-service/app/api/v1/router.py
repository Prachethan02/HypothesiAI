from fastapi import APIRouter
from app.api.v1.endpoints import health
from app.api.v1.endpoints import pipeline
from app.api.v1.endpoints import extraction
from app.api.v1.endpoints import embeddings
from app.api.v1.endpoints import resolution

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
api_router.include_router(extraction.router, prefix="/extraction", tags=["extraction"])
api_router.include_router(embeddings.router, prefix="/embeddings", tags=["embeddings"])
api_router.include_router(resolution.router, prefix="/resolution", tags=["resolution"])

