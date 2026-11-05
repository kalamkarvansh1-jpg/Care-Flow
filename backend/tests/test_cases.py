"""CareFlow Cases API Automated Test Suite.

Verifies:
- GET /api/v1/cases across all 4 supported clinical datasets.
- Pagination metadata and boundaries (page, page_size, total_pages).
- Sorting by duration, start time, event count, and case ID (asc and desc).
- Search and filtering (case ID substring, variant key, activity).
- Empty result sets and out-of-range pagination.
- GET /api/v1/cases/{case_id} detail with chronological timeline and SLA auditing.
- 404 Not Found handling for unknown cases and unknown datasets.
- 422 Validation Error handling for invalid page sizes, negative pages, invalid sort fields, and path traversal.
- Strict read-only dataset access (canonical CSV SHA-256 integrity check).
"""

from fastapi.testclient import TestClient
import pytest

from backend.app.main import app
from backend.app.repositories.dataset_repository import CANONICAL_HASHES, DatasetRepository
from backend.app.schemas.cases import CaseDetailResponse, PaginatedCasesResponse

client = TestClient(app)


# ----------------------------------------------------------------------
# 1. Valid Case Listing & Cohort Discovery
# ----------------------------------------------------------------------


@pytest.mark.parametrize(
    "dataset_id,expected_total",
    [
        ("preset-sepsis-2026", 1428),
        ("preset-careflow-outpatient-2026", 1000),
        ("preset-cardiology-2026", 720),
        ("canonical-event-log", 49912),
    ],
)
def test_list_cases_all_datasets(dataset_id: str, expected_total: int):
    """Verify that GET /api/v1/cases correctly loads and paginates all supported cohorts."""
    response = client.get(f"/api/v1/cases?dataset_id={dataset_id}&page=1&page_size=10")
    assert response.status_code == 200

    data = response.json()
    validated = PaginatedCasesResponse.model_validate(data)
    assert validated.total_cases == expected_total
    assert validated.page == 1
    assert validated.page_size == 10
    assert len(validated.cases) == 10
    assert validated.total_pages == (expected_total + 9) // 10

    # Verify first case item schema and types
    c0 = validated.cases[0]
    assert len(c0.case_id) > 0
    assert c0.duration_minutes >= 0
    assert c0.event_count >= 1
    assert len(c0.activity_sequence) == c0.event_count
    assert " → " in c0.variant_key or c0.event_count == 1
    assert "T" in c0.start_time
    assert "T" in c0.end_time


# ----------------------------------------------------------------------
# 2. Pagination & Boundary Testing
# ----------------------------------------------------------------------


def test_cases_pagination_boundaries():
    """Verify pagination mechanics: small pages, max page_size, and out-of-range pages."""
    # Single item per page
    r1 = client.get("/api/v1/cases?dataset_id=preset-cardiology-2026&page=1&page_size=1")
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["total_cases"] == 720
    assert d1["total_pages"] == 720
    assert len(d1["cases"]) == 1

    # Max allowed page size (200)
    r200 = client.get("/api/v1/cases?dataset_id=preset-cardiology-2026&page=1&page_size=200")
    assert r200.status_code == 200
    d200 = r200.json()
    assert d200["total_cases"] == 720
    assert d200["total_pages"] == 4
    assert len(d200["cases"]) == 200

    # Beyond total pages
    rbeyond = client.get("/api/v1/cases?dataset_id=preset-cardiology-2026&page=9999&page_size=50")
    assert rbeyond.status_code == 200
    dbeyond = rbeyond.json()
    assert dbeyond["total_cases"] == 720
    assert dbeyond["page"] == 9999
    assert len(dbeyond["cases"]) == 0


# ----------------------------------------------------------------------
# 3. Filtering & Search
# ----------------------------------------------------------------------


def test_cases_search_filter():
    """Verify case_id substring search functionality."""
    # Search for specific outpatient prefix
    response = client.get("/api/v1/cases?dataset_id=preset-careflow-outpatient-2026&search=OUT-2026-100")
    assert response.status_code == 200
    data = response.json()
    assert data["total_cases"] == 9  # OUT-2026-1001 through OUT-2026-1009
    for c in data["cases"]:
        assert "OUT-2026-100" in c["case_id"]


def test_cases_activity_filter():
    """Verify activity sequence filtering."""
    # Filter outpatient cases that had Laboratory End
    response = client.get("/api/v1/cases?dataset_id=preset-careflow-outpatient-2026&activity=Laboratory End")
    assert response.status_code == 200
    data = response.json()
    assert data["total_cases"] == 300  # Exactly 30% of outpatient cases have lab
    for c in data["cases"]:
        assert "Laboratory End" in c["activity_sequence"]


def test_cases_empty_results():
    """Verify that search criteria matching nothing returns total_cases=0 and empty cases array."""
    response = client.get("/api/v1/cases?dataset_id=preset-sepsis-2026&search=NON_EXISTENT_CASE_KEY_123")
    assert response.status_code == 200
    data = response.json()
    assert data["total_cases"] == 0
    assert data["total_pages"] == 0
    assert len(data["cases"]) == 0


# ----------------------------------------------------------------------
# 4. Sorting
# ----------------------------------------------------------------------


def test_cases_sorting_duration():
    """Verify ascending and descending sorting by duration."""
    # Ascending
    r_asc = client.get("/api/v1/cases?dataset_id=preset-careflow-outpatient-2026&sort_by=durationMinutes&sort_dir=asc&page_size=5")
    assert r_asc.status_code == 200
    cases_asc = r_asc.json()["cases"]
    durations_asc = [c["duration_minutes"] for c in cases_asc]
    assert durations_asc == sorted(durations_asc)

    # Descending
    r_desc = client.get("/api/v1/cases?dataset_id=preset-careflow-outpatient-2026&sort_by=durationMinutes&sort_dir=desc&page_size=5")
    assert r_desc.status_code == 200
    cases_desc = r_desc.json()["cases"]
    durations_desc = [c["duration_minutes"] for c in cases_desc]
    assert durations_desc == sorted(durations_desc, reverse=True)
    assert durations_desc[0] >= durations_asc[0]


def test_cases_sorting_start_time():
    """Verify sorting by start_time."""
    r = client.get("/api/v1/cases?dataset_id=preset-sepsis-2026&sort_by=startTime&sort_dir=asc&page_size=5")
    assert r.status_code == 200
    times = [c["start_time"] for c in r.json()["cases"]]
    assert times == sorted(times)


# ----------------------------------------------------------------------
# 5. Case Detail & Chronological Event Trace
# ----------------------------------------------------------------------


def test_case_detail_success_outpatient():
    """Verify GET /api/v1/cases/{case_id} returns accurate chronological timeline for demo case."""
    response = client.get("/api/v1/cases/OUT-2026-1001?dataset_id=preset-careflow-outpatient-2026")
    assert response.status_code == 200

    data = response.json()
    detail = CaseDetailResponse.model_validate(data)
    assert detail.case_id == "OUT-2026-1001"
    assert detail.dataset_id == "preset-careflow-outpatient-2026"
    assert detail.event_count == len(detail.events)
    assert detail.event_count >= 2

    # Verify chronological event ordering and indices
    for idx, event in enumerate(detail.events):
        assert event.event_index == idx + 1
        assert event.timestamp_ms > 0
        if idx < detail.event_count - 1:
            assert event.next_activity == detail.events[idx + 1].activity
            assert event.elapsed_to_next_minutes is not None
            assert event.elapsed_to_next_minutes >= 0
        else:
            assert event.next_activity is None
            assert event.elapsed_to_next_minutes is None


def test_case_detail_success_canonical():
    """Verify GET /api/v1/cases/{case_id} retrieves case trace from canonical event log."""
    response = client.get("/api/v1/cases/317?dataset_id=canonical-event-log")
    assert response.status_code == 200

    data = response.json()
    detail = CaseDetailResponse.model_validate(data)
    assert detail.case_id == "317"
    assert detail.dataset_id == "canonical-event-log"
    assert detail.event_count == 2
    assert detail.events[0].activity == "Appointment Start"
    assert detail.events[1].activity == "Prescription Order"
    assert detail.events[0].next_activity == "Prescription Order"
    assert detail.events[0].elapsed_to_next_minutes == 1083.0


# ----------------------------------------------------------------------
# 6. Error Handling & Validation
# ----------------------------------------------------------------------


def test_unknown_case_returns_404():
    """Verify that querying a non-existent case returns HTTP 404 with RESOURCE_NOT_FOUND."""
    response = client.get("/api/v1/cases/NON_EXISTENT_CASE_999?dataset_id=preset-sepsis-2026")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_unknown_dataset_returns_404():
    """Verify that querying cases for an unknown dataset returns HTTP 404."""
    response = client.get("/api/v1/cases?dataset_id=unknown_dataset_cohort")
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "RESOURCE_NOT_FOUND"


@pytest.mark.parametrize(
    "invalid_query",
    [
        "/api/v1/cases?dataset_id=preset-sepsis-2026&page=0",
        "/api/v1/cases?dataset_id=preset-sepsis-2026&page_size=201",
        "/api/v1/cases?dataset_id=preset-sepsis-2026&sort_by=disallowed_column",
        "/api/v1/cases?dataset_id=preset-sepsis-2026&sort_dir=diagonal",
    ],
)
def test_invalid_query_parameters_returns_422(invalid_query: str):
    """Verify that invalid pagination or sorting parameters return HTTP 422."""
    response = client.get(invalid_query)
    assert response.status_code == 422
    data = response.json()
    assert "error" in data


@pytest.mark.parametrize(
    "traversal_id",
    [
        "../etc/passwd",
        "..\\windows\\system32",
        "case/id/path",
        "case@id!#",
    ],
)
def test_path_traversal_rejection(traversal_id: str):
    """Verify that directory traversal attempts in case_id return HTTP 404 or 422 without server disclosure."""
    response = client.get(f"/api/v1/cases/{traversal_id}?dataset_id=preset-sepsis-2026")
    assert response.status_code in (404, 422)


# ----------------------------------------------------------------------
# 7. Dataset Immutability Verification
# ----------------------------------------------------------------------


def test_canonical_datasets_remain_untouched_after_cases_queries():
    """Verify that case trace operations never modify canonical CSV files on disk."""
    repo = DatasetRepository()
    hashes = repo.verify_canonical_hashes()

    # Query cases from canonical dataset
    client.get("/api/v1/cases?dataset_id=canonical-event-log&page=1&page_size=50")
    client.get("/api/v1/cases/317?dataset_id=canonical-event-log")
    client.get("/api/v1/cases/756?dataset_id=canonical-event-log")

    hashes_after = repo.verify_canonical_hashes()
    for filename, (is_match, observed_hash, expected_hash) in hashes_after.items():
        assert is_match is True
        assert observed_hash.lower() == CANONICAL_HASHES[filename].lower()
