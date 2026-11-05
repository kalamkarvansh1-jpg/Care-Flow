"""CareFlow API v1 Central Router Aggregator."""

from fastapi import APIRouter
from backend.app.api.v1.cases import router as cases_router
from backend.app.api.v1.datasets import router as datasets_router
from backend.app.api.v1.health import router as health_router

api_v1_router = APIRouter()

# Mount health & readiness controller
api_v1_router.include_router(health_router)

# Mount dataset discovery & summary controller
api_v1_router.include_router(datasets_router)

# Mount case trace & exploration controller
api_v1_router.include_router(cases_router)
