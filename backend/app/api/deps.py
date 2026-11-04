"""CareFlow Dependency Injection Providers."""

from functools import lru_cache
from backend.app.core.config import CareFlowSettings, settings
from backend.app.repositories.dataset_repository import DatasetRepository


def get_settings() -> CareFlowSettings:
    """Provides application configuration settings dependency."""
    return settings


@lru_cache()
def get_dataset_repository() -> DatasetRepository:
    """Provides cached singleton DatasetRepository dependency."""
    return DatasetRepository()
