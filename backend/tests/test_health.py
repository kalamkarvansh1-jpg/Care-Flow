"""CareFlow Health Endpoint & Application Integration Tests."""

from fastapi.testclient import TestClient
import pytest
from backend.app.main import app
from backend.app.core.config import settings

client = TestClient(app)


def test_health_endpoint_success():
    """Verify that GET /api/v1/health returns HTTP 200 with the required schema."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["application_name"] == settings.APP_NAME
    assert data["version"] == settings.APP_VERSION
    assert data["environment"] == settings.ENVIRONMENT
    assert "timestamp" in data

    # Ensure no sensitive paths or secrets are leaked
    for key, val in data.items():
        assert "password" not in str(key).lower()
        assert "secret" not in str(key).lower()
        assert "c:\\" not in str(val).lower()
        assert "d:\\" not in str(val).lower()


def test_openapi_schema_accessible():
    """Verify that GET /openapi.json returns HTTP 200 and valid OpenAPI 3.x metadata."""
    response = client.get("/openapi.json")
    assert response.status_code == 200

    schema = response.json()
    assert "openapi" in schema
    assert schema["info"]["title"] == settings.APP_NAME
    assert schema["info"]["version"] == settings.APP_VERSION
    assert "/api/v1/health" in schema["paths"]


def test_docs_ui_accessible():
    """Verify that GET /docs Swagger UI loads successfully."""
    response = client.get("/docs")
    assert response.status_code == 200
    assert "swagger" in response.text.lower() or "html" in response.text.lower()


def test_not_found_returns_standard_error_envelope():
    """Verify that non-existent routes return HTTP 404 with standardized JSON error envelope."""
    response = client.get("/api/v1/non-existent-endpoint")
    assert response.status_code == 404

    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert "timestamp" in data["error"]
    assert "not found" in data["error"]["message"].lower()


def test_cors_headers_authorized_origin():
    """Verify that CORS preflight and actual requests from authorized origins receive correct headers."""
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    }
    # Preflight OPTIONS request
    preflight = client.options("/api/v1/health", headers=headers)
    assert preflight.status_code == 200
    assert preflight.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "GET" in preflight.headers.get("access-control-allow-methods", "")

    # Actual GET request with Origin
    actual = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    assert actual.status_code == 200
    assert actual.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_consistent_error_structure():
    """Verify that error responses contain required envelope fields."""
    response = client.get("/invalid-root-route")
    assert response.status_code == 404

    data = response.json()
    assert "error" in data
    assert "code" in data["error"]
    assert "message" in data["error"]
    assert "timestamp" in data["error"]
    assert "details" in data["error"]
