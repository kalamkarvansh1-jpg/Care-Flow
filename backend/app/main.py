"""CareFlow FastAPI Backend Application Factory.

Initializes FastAPI with CORS middleware, lifespan events, OpenAPI metadata,
and standardized JSON error handling.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.v1.router import api_v1_router
from backend.app.core.config import settings
from backend.app.core.error_handlers import register_error_handlers
from backend.app.core.logging import setup_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager handling startup and shutdown events."""
    setup_logging(debug=settings.DEBUG)
    logger.info(
        "Initializing %s v%s in %s environment...",
        settings.APP_NAME,
        settings.APP_VERSION,
        settings.ENVIRONMENT,
    )
    yield
    logger.info("Gracefully shutting down %s...", settings.APP_NAME)


def create_app() -> FastAPI:
    """Factory function for instantiating the CareFlow FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "CareFlow Clinical Pathway Process Mining & What-If Simulation API. "
            "Delivers high-performance clinical process discovery, empirical SLA conformance auditing, "
            "and deterministic operational bottleneck simulation."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Configure CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Register standardized error handlers
    register_error_handlers(app)

    # Mount versioned API routes
    app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_app()
