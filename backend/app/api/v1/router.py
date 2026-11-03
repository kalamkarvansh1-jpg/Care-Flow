"""CareFlow API v1 Central Router Aggregator."""

from fastapi import APIRouter
from backend.app.api.v1.health import router as health_router

api_v1_router = APIRouter()

# Mount health & readiness controller
api_v1_router.include_router(health_router)
