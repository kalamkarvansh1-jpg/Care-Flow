"""CareFlow Health & Readiness Probe Controller."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from backend.app.api.deps import get_settings
from backend.app.core.config import CareFlowSettings
from backend.app.schemas.common import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="System Health & Readiness Probe",
    description="Returns service health status, application name, API version, UTC timestamp, and runtime environment without exposing sensitive paths.",
)
async def get_health(
    settings: CareFlowSettings = Depends(get_settings),
) -> HealthResponse:
    """Returns the operational health and readiness state of the CareFlow API."""
    return HealthResponse(
        status="healthy",
        application_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        timestamp=datetime.now(timezone.utc),
        environment=settings.ENVIRONMENT,
    )
