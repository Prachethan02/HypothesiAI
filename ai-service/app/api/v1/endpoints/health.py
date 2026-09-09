from datetime import datetime, timezone
import platform
import sys
from fastapi import APIRouter
from app.core.config import settings
from app.core.model_manager import model_manager
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    """Returns AI service health status and hardware diagnostic information."""
    resources = model_manager.get_system_resources()
    
    device_info = {
        "python_version": sys.version.split(" ")[0],
        "os": platform.system(),
        "architecture": platform.machine(),
        "device": resources["device"],
        "cpu_count": resources["cpu_count"],
        "cpu_percent": resources["cpu_percent"],
        "available_ram_mb": resources["available_ram_mb"],
        "total_ram_mb": resources["total_ram_mb"],
        "ram_used_percent": resources["ram_used_percent"],
        "gpu": resources["gpu"],
        "loaded_models": resources["loaded_models"],
        "pipeline_stages_registered": [
            "parsers",
            "extractors",
            "embeddings",
            "resolution",
            "topics",
            "evidence_clusters",
            "patterns",
            "contradictions",
            "evidence",
            "research_gaps",
            "hypotheses",
        ],
    }
    
    return HealthResponse(
        status="ok",
        service="hypothesiai-ai-service",
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        device_info=device_info,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/health/ready")
async def get_readiness():
    """Readiness probe for container orchestration."""
    resources = model_manager.get_system_resources()
    is_ready = resources["available_ram_mb"] > 100  # at least 100MB free
    return {
        "status": "ready" if is_ready else "degraded",
        "service": "hypothesiai-ai-service",
        "resources": resources,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
