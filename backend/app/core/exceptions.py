"""CareFlow Domain Exception Definitions."""

from typing import Any, Dict, Optional


class CareFlowException(Exception):
    """Base domain exception for the CareFlow platform."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class ResourceNotFoundException(CareFlowException):
    """Raised when an encounter case, dataset, or model is not found."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="RESOURCE_NOT_FOUND",
            status_code=404,
            details=details,
        )


class ValidationException(CareFlowException):
    """Raised when clinical data or simulation parameters fail validation."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=422,
            details=details,
        )
