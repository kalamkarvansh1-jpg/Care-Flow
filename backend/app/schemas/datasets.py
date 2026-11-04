"""CareFlow Dataset Pydantic v2 Schemas & OpenAPI DTO Models.

Defines schemas for dataset discovery, cohort metadata headers, summary metrics,
Directly-Follows Graph transitions, and ranked clinical bottlenecks.
"""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class DatasetHeader(BaseModel):
    """Metadata header for a discovered clinical dataset or demonstration cohort."""

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "example": {
                "id": "preset-sepsis-2026",
                "name": "Emergency Department Sepsis Pathway (Synthetic Demo)",
                "filename": "ED_Sepsis_Pathway_2026_Q3.csv",
                "file_size_bytes": 2458900,
                "is_synthetic": True,
                "description": "Synthetic acute sepsis resuscitation cohort modeling door-to-antibiotic intervals.",
                "total_cases": 1428,
                "total_events": 9855,
                "empirical_sla_minutes": 332.0,
            }
        },
    )

    id: str = Field(..., description="Unique dataset or preset identifier")
    name: str = Field(..., description="Human-readable dataset display name")
    filename: str = Field(..., description="Physical or virtual filename")
    file_size_bytes: int = Field(..., description="Size of the dataset in bytes")
    is_synthetic: bool = Field(..., description="Indicates if the cohort is synthetic demonstration data")
    description: str = Field(..., description="Detailed clinical pathway description")
    total_cases: int = Field(..., description="Total unique patient cases / encounters")
    total_events: int = Field(..., description="Total clinical event observations")
    empirical_sla_minutes: Optional[float] = Field(
        default=None, description="Empirical P90 benchmark SLA threshold in minutes"
    )


class DatasetListResponse(BaseModel):
    """Response payload for listing all available datasets and cohorts."""

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "example": {
                "datasets": [
                    {
                        "id": "preset-sepsis-2026",
                        "name": "Emergency Department Sepsis Pathway (Synthetic Demo)",
                        "filename": "ED_Sepsis_Pathway_2026_Q3.csv",
                        "file_size_bytes": 2458900,
                        "is_synthetic": True,
                        "description": "Synthetic acute sepsis resuscitation cohort.",
                        "total_cases": 1428,
                        "total_events": 9855,
                        "empirical_sla_minutes": 332.0,
                    }
                ],
                "active_dataset_id": "preset-sepsis-2026",
            }
        },
    )

    datasets: List[DatasetHeader] = Field(..., description="List of available datasets")
    active_dataset_id: str = Field(..., description="Default / currently active dataset ID")


class SummaryMetrics(BaseModel):
    """Aggregate process discovery metrics for an encounter cohort."""

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "example": {
                "total_cases": 1000,
                "total_events": 3100,
                "median_case_duration_minutes": 90.0,
                "mean_case_duration_minutes": 118.2,
                "p90_case_duration_minutes": 196.0,
                "min_case_duration_minutes": 20.0,
                "max_case_duration_minutes": 450.0,
                "distinct_variants_count": 4,
                "unique_activities_count": 7,
                "average_events_per_case": 3.1,
                "zero_duration_cases_count": 0,
            }
        },
    )

    total_cases: int = Field(..., description="Count of unique cases evaluated")
    total_events: int = Field(..., description="Count of event rows evaluated")
    median_case_duration_minutes: float = Field(..., description="Median case duration in minutes")
    mean_case_duration_minutes: float = Field(..., description="Mean case duration in minutes")
    p90_case_duration_minutes: float = Field(..., description="90th percentile case duration in minutes")
    min_case_duration_minutes: float = Field(..., description="Minimum case duration in minutes")
    max_case_duration_minutes: float = Field(..., description="Maximum case duration in minutes")
    distinct_variants_count: int = Field(..., description="Number of distinct activity sequence variants")
    unique_activities_count: int = Field(..., description="Number of distinct clinical activities")
    average_events_per_case: float = Field(..., description="Mean number of events per case")
    zero_duration_cases_count: int = Field(..., description="Count of cases with zero elapsed duration")


class ActivityTransition(BaseModel):
    """Directly-Follows Graph (DFG) edge transition between consecutive activities."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., description="Unique transition identifier")
    from_activity: str = Field(..., description="Source activity name")
    to_activity: str = Field(..., description="Destination activity name")
    observation_count: int = Field(..., description="Total observed transition handoffs")
    case_count: int = Field(..., description="Distinct cases traversing this transition")
    median_elapsed_minutes: float = Field(..., description="Median elapsed duration in minutes")
    mean_elapsed_minutes: float = Field(..., description="Mean elapsed duration in minutes")
    p90_elapsed_minutes: float = Field(..., description="90th percentile elapsed duration in minutes")
    percentage_of_departures: float = Field(..., description="Percentage of departures from source activity")


class BottleneckItem(BaseModel):
    """Ranked clinical workflow bottleneck identified across transitions or activities."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., description="Unique bottleneck identifier")
    type: Literal["activity", "transition"] = Field(..., description="Bottleneck entity type")
    label: str = Field(..., description="Human-readable bottleneck label")
    from_activity: Optional[str] = Field(default=None, description="Source activity for transition bottlenecks")
    to_activity: Optional[str] = Field(default=None, description="Destination activity for transition bottlenecks")
    valid_observations: int = Field(..., description="Count of valid observations evaluated")
    case_count: int = Field(..., description="Distinct cases affected")
    median_elapsed_minutes: float = Field(..., description="Median elapsed duration in minutes")
    p90_elapsed_minutes: float = Field(..., description="90th percentile elapsed duration in minutes")
    severity: Literal["high", "moderate", "nominal"] = Field(..., description="Bottleneck operational severity tier")
    explanation: str = Field(..., description="Clinical and operational root cause explanation")


class DatasetSummaryResponse(BaseModel):
    """Comprehensive dataset summary and process discovery analytics response."""

    model_config = ConfigDict(extra="ignore")

    dataset_id: str = Field(..., description="Identifier of the evaluated dataset")
    metrics: SummaryMetrics = Field(..., description="Cohort summary metrics")
    transitions: List[ActivityTransition] = Field(default_factory=list, description="DFG transitions")
    bottlenecks: List[BottleneckItem] = Field(default_factory=list, description="Ranked clinical bottlenecks")
    distinct_variants_count: int = Field(..., description="Total distinct process variants")
    top_variants_summary: List[Dict[str, Any]] = Field(
        default_factory=list, description="Top process variants with case counts and coverage"
    )
