"""CareFlow Standardized Error Handlers.

Ensures all exceptions emit a uniform, typed JSON error envelope.
"""

from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.app.core.exceptions import CareFlowException


def register_error_handlers(app: FastAPI) -> None:
    """Registers standard, consistent JSON error responses across the application."""

    @app.exception_handler(CareFlowException)
    async def careflow_exception_handler(_request: Request, exc: CareFlowException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "RESOURCE_NOT_FOUND" if exc.status_code == 404 else f"HTTP_{exc.status_code}"
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": code,
                    "message": str(exc.detail),
                    "details": {},
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "REQUEST_VALIDATION_ERROR",
                    "message": "The request payload failed validation.",
                    "details": {"errors": exc.errors()},
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected server error occurred.",
                    "details": {"type": exc.__class__.__name__},
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
