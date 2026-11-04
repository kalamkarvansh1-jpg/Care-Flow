"""CareFlow Dataset Repository & Dataset API Automated Test Suite.

Verifies:
- GET /api/v1/datasets listing and header metadata.
- GET /api/v1/datasets/{dataset_id}/summary for all 4 supported datasets.
- Accurate case and event counts across cohorts.
- 404 Not Found error handling for unknown dataset IDs.
- 422 Validation Error handling for invalid IDs and path traversal attempts.
- Safe handling of missing dataset files using temporary fixtures.
- Strict immutability of canonical CSV files (SHA-256 integrity check).
"""

from pathlib import Path
from fastapi.testclient import TestClient
import pytest

from backend.app.api.deps import get_dataset_repository
from backend.app.core.exceptions import ResourceNotFoundException
from backend.app.main import app
from backend.app.repositories.dataset_repository import CANONICAL_HASHES, DatasetRepository
from backend.app.schemas.datasets import DatasetListResponse, DatasetSummaryResponse

client = TestClient(app)


def test_list_datasets_success():
    """Verify that GET /api/v1/datasets returns HTTP 200 with all 4 supported datasets."""
    response = client.get("/api/v1/datasets")
    assert response.status_code == 200

    data = response.json()
    validated = DatasetListResponse.model_validate(data)
    assert len(validated.datasets) == 4
    assert validated.active_dataset_id == "preset-sepsis-2026"

    dataset_ids = [d.id for d in validated.datasets]
    assert "preset-sepsis-2026" in dataset_ids
    assert "preset-careflow-outpatient-2026" in dataset_ids
    assert "preset-cardiology-2026" in dataset_ids
    assert "canonical-event-log" in dataset_ids

    # Validate header fields
    for d in validated.datasets:
        assert d.total_cases > 0
        assert d.total_events > 0
        assert d.file_size_bytes > 0
        assert len(d.name) > 0
        assert len(d.description) > 0


def test_dataset_case_and_event_counts():
    """Verify exact case and event counts across all supported cohorts."""
    response = client.get("/api/v1/datasets")
    assert response.status_code == 200
    headers = {d["id"]: d for d in response.json()["datasets"]}

    # 1. Sepsis
    assert headers["preset-sepsis-2026"]["total_cases"] == 1428
    assert headers["preset-sepsis-2026"]["total_events"] == 9855
    assert headers["preset-sepsis-2026"]["empirical_sla_minutes"] == 332.0
    assert headers["preset-sepsis-2026"]["is_synthetic"] is True

    # 2. Outpatient
    assert headers["preset-careflow-outpatient-2026"]["total_cases"] == 1000
    assert headers["preset-careflow-outpatient-2026"]["total_events"] == 3100
    assert headers["preset-careflow-outpatient-2026"]["empirical_sla_minutes"] == 196.0
    assert headers["preset-careflow-outpatient-2026"]["is_synthetic"] is True

    # 3. Cardiology
    assert headers["preset-cardiology-2026"]["total_cases"] == 720
    assert headers["preset-cardiology-2026"]["total_events"] == 4320
    assert headers["preset-cardiology-2026"]["empirical_sla_minutes"] == 180.0
    assert headers["preset-cardiology-2026"]["is_synthetic"] is True

    # 4. Canonical
    assert headers["canonical-event-log"]["total_cases"] == 49912
    assert headers["canonical-event-log"]["total_events"] == 142876
    assert headers["canonical-event-log"]["empirical_sla_minutes"] == 196.0
    assert headers["canonical-event-log"]["is_synthetic"] is False


@pytest.mark.parametrize(
    "dataset_id,expected_cases,expected_events",
    [
        ("preset-sepsis-2026", 1428, 9855),
        ("preset-careflow-outpatient-2026", 1000, 3100),
        ("preset-cardiology-2026", 720, 4320),
        ("canonical-event-log", 49912, 142876),
    ],
)
def test_get_dataset_summary_success(dataset_id: str, expected_cases: int, expected_events: int):
    """Verify that GET /api/v1/datasets/{dataset_id}/summary succeeds with valid Pydantic schema."""
    response = client.get(f"/api/v1/datasets/{dataset_id}/summary")
    assert response.status_code == 200

    data = response.json()
    summary = DatasetSummaryResponse.model_validate(data)
    assert summary.dataset_id == dataset_id
    assert summary.metrics.total_cases == expected_cases
    assert summary.metrics.total_events == expected_events
    assert summary.metrics.median_case_duration_minutes > 0
    assert summary.metrics.p90_case_duration_minutes >= summary.metrics.median_case_duration_minutes
    assert len(summary.transitions) > 0
    assert len(summary.bottlenecks) > 0


def test_unknown_dataset_returns_404():
    """Verify that querying an unknown dataset returns 404 with RESOURCE_NOT_FOUND error envelope."""
    response = client.get("/api/v1/datasets/unknown-cohort-id-999/summary")
    assert response.status_code == 404

    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert "not found" in data["error"]["message"].lower()


@pytest.mark.parametrize(
    "invalid_id",
    [
        "invalid@name",
        "cohort/subpath",
        "cohort\\subpath",
        "cohort name with spaces",
        "test;drop table",
        "../traversal",
    ],
)
def test_invalid_dataset_id_handling(invalid_id: str):
    """Verify that path traversal patterns and special characters are rejected with 422 or 404."""
    response = client.get(f"/api/v1/datasets/{invalid_id}/summary")
    assert response.status_code in (404, 422)
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] in ("VALIDATION_ERROR", "RESOURCE_NOT_FOUND")


def test_missing_dataset_file_handling(tmp_path: Path):
    """Verify that if a canonical dataset file is missing, the repository raises ResourceNotFoundException."""
    empty_data_dir = tmp_path / "data"
    empty_data_dir.mkdir(parents=True)
    (empty_data_dir / "processed").mkdir()

    repo = DatasetRepository(data_dir=empty_data_dir)
    with pytest.raises(ResourceNotFoundException) as exc_info:
        repo.get_dataset_summary("canonical-event-log")

    assert "not found on disk" in exc_info.value.message


def test_canonical_datasets_remain_unchanged():
    """Verify that reading and summarizing datasets never mutates canonical CSV files."""
    repo = DatasetRepository()
    hashes_before = repo.verify_canonical_hashes()

    # Exercise list and summary APIs
    client.get("/api/v1/datasets")
    client.get("/api/v1/datasets/canonical-event-log/summary")
    client.get("/api/v1/datasets/preset-careflow-outpatient-2026/summary")
    client.get("/api/v1/datasets/preset-sepsis-2026/summary")
    client.get("/api/v1/datasets/preset-cardiology-2026/summary")

    hashes_after = repo.verify_canonical_hashes()

    for filename, (is_match, observed_hash, expected_hash) in hashes_after.items():
        assert is_match is True, f"Hash mismatch for {filename} after API execution!"
        assert observed_hash == hashes_before[filename][1]
        assert observed_hash.lower() == CANONICAL_HASHES[filename].lower()
