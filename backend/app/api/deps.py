"""CareFlow Dependency Injection Providers."""

from backend.app.core.config import CareFlowSettings, settings


def get_settings() -> CareFlowSettings:
    """Provides application configuration settings dependency."""
    return settings
