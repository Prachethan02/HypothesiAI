from datetime import datetime, timezone
import platform
import sys
from fastapi import APIRouter
from app.core.config import settings
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    """Returns AI service health status and hardware diagnostic information."""
    
    # Collect basic runtime hardware diagnostic info
    device_info = {
        "python_version": sys.version.split(" ")[0],
        "os": platform.system(),
        "architecture": platform.machine(),
        "gpu_available": False,  # Will be dynamically probed when PyTorch is introduced in Stage 2/3
        "pipeline_stages_registered": [
            "parsers",
            "extractors",
            "embeddings",
            "clustering",
            "patterns",
            "nli",
            "ranking",
            "llm",
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
