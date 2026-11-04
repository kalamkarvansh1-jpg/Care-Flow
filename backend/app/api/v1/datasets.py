"""CareFlow Dataset Discovery & Analytics API Controller.

Provides REST endpoints for discovering available clinical cohorts, inspecting
dataset metadata, and retrieving comprehensive process discovery summaries.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query

from backend.app.api.deps import get_dataset_repository
from backend.app.repositories.dataset_repository import DatasetRepository
from backend.app.schemas.datasets import DatasetListResponse, DatasetSummaryResponse

router = APIRouter(prefix="/datasets", tags=["Datasets"])


@router.get(
    "",
    response_model=DatasetListResponse,
    summary="List Available Datasets & Cohorts",
    description="Enumerates available clinical datasets (canonical event logs and demonstration cohorts) with metadata and file sizes.",
)
async def list_datasets(
    repo: DatasetRepository = Depends(get_dataset_repository),
) -> DatasetListResponse:
    """Returns a list of all supported clinical datasets and demo presets."""
    return repo.list_datasets()


@router.get(
    "/{dataset_id}/summary",
    response_model=DatasetSummaryResponse,
    summary="Dataset Summary Analytics & Process Discovery",
    description="Computes comprehensive exploratory process discovery metrics, Directly-Follows Graph transitions, variant stratifications, and bottleneck rankings for an active dataset.",
)
async def get_dataset_summary(
    dataset_id: str,
    activity: str = Query(default="all", description="Filter by clinical activity"),
    variant_key: str = Query(default="all", description="Filter by process variant key"),
    department: str = Query(default="all", description="Filter by clinical department"),
    start_date: Optional[str] = Query(default=None, description="Optional ISO start datetime constraint"),
    end_date: Optional[str] = Query(default=None, description="Optional ISO end datetime constraint"),
    case_id_search: Optional[str] = Query(default=None, description="Optional patient/case ID substring filter"),
    repo: DatasetRepository = Depends(get_dataset_repository),
) -> DatasetSummaryResponse:
    """Returns summary discovery metrics, DFG transitions, bottlenecks, and top variants."""
    return repo.get_dataset_summary(
        dataset_id=dataset_id,
        activity=activity,
        variant_key=variant_key,
        department=department,
        start_date=start_date,
        end_date=end_date,
        case_id_search=case_id_search,
    )
