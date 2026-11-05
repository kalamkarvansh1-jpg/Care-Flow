"""CareFlow Cases Pydantic v2 Schemas & OpenAPI DTO Models.

Defines schemas for paginated patient encounter traces, chronological event timelines,
interval elapsed durations, and empirical SLA compliance statuses.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CaseItem(BaseModel):
    """Summary record for a single patient case / encounter in a paginated cohort."""

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "example": {
                "case_id": "OUT-2026-1001",
                "start_time": "2026-10-01T08:00:00Z",
                "end_time": "2026-10-01T09:30:00Z",
                "duration_minutes": 90.0,
                "event_count": 3,
                "activity_sequence": [
                    "Appointment Start",
                    "Prescription Order",
                    "Laboratory Start",
                ],
                "variant_key": "Appointment Start → Prescription Order → Laboratory Start",
                "department": "Outpatient Consultation",
                "status": "Completed",
            }
        },
    )

    case_id: str = Field(..., description="Unique patient encounter / case identifier")
    start_time: str = Field(..., description="ISO 8601 timestamp of first clinical activity")
    end_time: str = Field(..., description="ISO 8601 timestamp of final clinical activity")
    duration_minutes: float = Field(..., description="Total elapsed case duration in minutes")
    event_count: int = Field(..., description="Total number of events observed in this case")
    activity_sequence: List[str] = Field(..., description="Chronological sequence of clinical activities")
    variant_key: str = Field(..., description="Directly-follows process variant representation")
    department: Optional[str] = Field(default=None, description="Primary clinical department or initial stage")
    status: Optional[str] = Field(default=None, description="Encounter completion status")


class PaginatedCasesResponse(BaseModel):
    """Paginated list of patient encounter traces with navigation metadata."""

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "example": {
                "total_cases": 1000,
                "page": 1,
                "page_size": 25,
                "total_pages": 40,
                "cases": [],
            }
        },
    )

    total_cases: int = Field(..., description="Total cases matching filter criteria")
    page: int = Field(..., description="Current 1-based page number")
    page_size: int = Field(..., description="Number of cases per page")
    total_pages: int = Field(..., description="Total available pages")
    cases: List[CaseItem] = Field(..., description="List of case records for the requested page")


class CaseEvent(BaseModel):
    """Detailed observation of an individual clinical event in a case timeline."""

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "example": {
                "id": "OUT-2026-1001-1",
                "activity": "Appointment Start",
                "timestamp": "2026-10-01T08:00:00Z",
                "timestamp_ms": 1790841600000,
                "event_index": 1,
                "next_activity": "Prescription Order",
                "elapsed_to_next_minutes": 25.0,
                "resource": "Dr. Maya Lin, MD",
                "department": "Outpatient Consultation",
                "status": "In Consultation",
                "raw_attributes": {},
            }
        },
    )

    id: str = Field(..., description="Unique event identifier")
    activity: str = Field(..., description="Observed clinical activity name")
    timestamp: str = Field(..., description="ISO 8601 formatted event timestamp")
    timestamp_ms: int = Field(..., description="Unix epoch timestamp in milliseconds")
    event_index: int = Field(..., description="1-based chronological index within the case trace")
    next_activity: Optional[str] = Field(default=None, description="Activity immediately following this event")
    elapsed_to_next_minutes: Optional[float] = Field(
        default=None, description="Elapsed interval in minutes to the next event"
    )
    resource: Optional[str] = Field(default=None, description="Performer, physician, nurse, or machine resource")
    department: Optional[str] = Field(default=None, description="Clinical department or service area")
    status: Optional[str] = Field(default=None, description="Event lifecycle or clinical status")
    raw_attributes: Dict[str, Any] = Field(default_factory=dict, description="Dataset-specific raw attributes")


class CaseDetailResponse(BaseModel):
    """Complete chronological event trace and empirical SLA audit for a specific case."""

    model_config = ConfigDict(
        extra="ignore",
        json_schema_extra={
            "example": {
                "case_id": "OUT-2026-1001",
                "dataset_id": "preset-careflow-outpatient-2026",
                "start_time": "2026-10-01T08:00:00Z",
                "end_time": "2026-10-01T09:30:00Z",
                "duration_minutes": 90.0,
                "event_count": 3,
                "variant_key": "Appointment Start → Prescription Order → Laboratory Start",
                "events": [],
                "compliance_status": "Compliant",
                "sla_breached": False,
            }
        },
    )

    case_id: str = Field(..., description="Unique patient encounter / case identifier")
    dataset_id: str = Field(..., description="Cohort or dataset identifier")
    start_time: str = Field(..., description="ISO 8601 timestamp of first clinical activity")
    end_time: str = Field(..., description="ISO 8601 timestamp of final clinical activity")
    duration_minutes: float = Field(..., description="Total elapsed case duration in minutes")
    event_count: int = Field(..., description="Total number of events in this case trace")
    variant_key: str = Field(..., description="Directly-follows process variant representation")
    events: List[CaseEvent] = Field(..., description="Chronological list of clinical events")
    compliance_status: Optional[str] = Field(default=None, description="Empirical SLA compliance classification")
    sla_breached: bool = Field(..., description="Indicates whether case duration exceeded empirical SLA threshold")
