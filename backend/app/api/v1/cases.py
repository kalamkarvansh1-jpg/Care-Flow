"""CareFlow Cases API Controller.

Provides REST endpoints for retrieving paginated clinical encounter cohorts,
filtering by activity or variant, and inspecting individual patient chronological event traces.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query

from backend.app.api.deps import get_dataset_repository
from backend.app.repositories.dataset_repository import DatasetRepository
from backend.app.schemas.cases import CaseDetailResponse, PaginatedCasesResponse

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.get(
    "",
    response_model=PaginatedCasesResponse,
    summary="Paginated Case Traces & Filtered Cohorts",
    description="Retrieves paginated, sorted patient case records with durations, variant paths, and timestamp bounds.",
)
async def list_cases(
    dataset_id: str = Query(..., description="Unique dataset or preset identifier (required)"),
    page: int = Query(default=1, ge=1, description="1-based page number"),
    page_size: int = Query(default=25, ge=1, le=200, description="Number of cases per page (1 to 200)"),
    sort_by: str = Query(default="durationMinutes", description="Sort column (durationMinutes, startTime, eventCount, case_id)"),
    sort_dir: str = Query(default="desc", description="Sort order direction ('asc' or 'desc')"),
    search: Optional[str] = Query(default=None, description="Patient case ID substring search"),
    variant_key: Optional[str] = Query(default=None, description="Filter by process variant key"),
    activity: Optional[str] = Query(default=None, description="Filter cases traversing a specific activity"),
    repo: DatasetRepository = Depends(get_dataset_repository),
) -> PaginatedCasesResponse:
    """Returns paginated case summaries matching filter and sorting parameters."""
    return repo.get_cases(
        dataset_id=dataset_id,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_dir=sort_dir,
        search=search,
        variant_key=variant_key,
        activity=activity,
    )


@router.get(
    "/{case_id}",
    response_model=CaseDetailResponse,
    summary="Individual Case Trace Details",
    description="Returns the complete chronological event trace for a specific patient encounter, including interval elapsed durations and empirical SLA classification.",
)
async def get_case_detail(
    case_id: str,
    dataset_id: str = Query(..., description="Unique dataset or preset identifier (required)"),
    repo: DatasetRepository = Depends(get_dataset_repository),
) -> CaseDetailResponse:
    """Returns chronological event trace and empirical SLA audit for a specific case."""
    return repo.get_case_detail(dataset_id=dataset_id, case_id=case_id)
