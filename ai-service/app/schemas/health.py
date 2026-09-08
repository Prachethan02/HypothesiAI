from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema for AI service health check responses."""
    status: str = Field(default="ok", description="Service health status")
    service: str = Field(default="hypothesiai-ai-service", description="Service identifier")
    version: str = Field(..., description="API version")
    environment: str = Field(..., description="Runtime environment")
    device_info: Dict[str, Any] = Field(default_factory=dict, description="Hardware diagnostic details")
    timestamp: str = Field(..., description="ISO 8601 timestamp")
