"""Common reusable Pydantic v2 schemas and error envelopes."""

from datetime import datetime
from typing import Any, Dict, Literal
from pydantic import BaseModel, ConfigDict, Field


class ErrorDetail(BaseModel):
    """Standardized error envelope payload."""

    model_config = ConfigDict(extra="forbid")

    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error explanation")
    details: Dict[str, Any] = Field(default_factory=dict, description="Contextual error metadata")
    timestamp: datetime = Field(..., description="UTC ISO timestamp of error occurrence")


class ErrorResponse(BaseModel):
    """Wrapper for error responses."""

    model_config = ConfigDict(extra="forbid")

    error: ErrorDetail


class HealthResponse(BaseModel):
    """Health check status and system readiness response schema."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "example": {
                "status": "healthy",
                "application_name": "CareFlow Clinical Pathway API",
                "version": "1.0.0",
                "timestamp": "2026-11-03T10:00:00Z",
                "environment": "development",
            }
        },
    )

    status: Literal["healthy", "degraded", "unhealthy"] = Field(
        default="healthy", description="Current service health status"
    )
    application_name: str = Field(..., description="Name of the application service")
    version: str = Field(..., description="Semantic version of the running service")
    timestamp: datetime = Field(..., description="Current UTC server timestamp")
    environment: str = Field(..., description="Runtime environment identifier")


class MetricDelta(BaseModel):
    """Comparative metric delta between empirical baseline and simulated values."""

    model_config = ConfigDict(extra="forbid")

    baseline: float = Field(..., description="Empirical observed baseline metric")
    simulated: float = Field(..., description="Simulated hypothetical metric")
    absolute_delta: float = Field(..., description="Absolute difference (simulated - baseline)")
    percentage_delta: float = Field(..., description="Percentage relative change")
