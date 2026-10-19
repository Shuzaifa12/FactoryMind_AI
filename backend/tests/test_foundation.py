from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.main import create_app


def test_health_endpoint_ok(client: TestClient):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "ok"
    assert data["database_engine"] == "sqlite"
    assert "version" in data
    assert "environment" in data


def test_health_degraded_when_db_fails():
    app = create_app()

    def mock_broken_db():
        session = MagicMock()
        session.execute.side_effect = Exception("DB connection refused")
        yield session

    app.dependency_overrides[get_db] = mock_broken_db

    with TestClient(app) as client:
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"] == "unavailable"


def test_cors_headers_allowed_origin(client: TestClient):
    # Allowed origin: http://localhost:3000
    headers = {"Origin": "http://localhost:3000"}
    response = client.get("/api/v1/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_headers_disallowed_origin(client: TestClient):
    # Disallowed origin: https://untrusted-site.com
    headers = {"Origin": "https://untrusted-site.com"}
    response = client.get("/api/v1/health", headers=headers)
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_standard_404_error_shape(client: TestClient):
    response = client.get("/api/v1/nonexistent-endpoint")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "NOT_FOUND"


def test_all_11_models_registered_and_creatable(db_session: Session):
    from app.db.models import Base

    expected_tables = {
        "datasets",
        "machines",
        "sensor_readings",
        "processing_runs",
        "alerts",
        "impact_estimates",
        "documents",
        "maintenance_records",
        "investigations",
        "reports",
        "app_settings",
    }
    actual_tables = set(Base.metadata.tables.keys())
    assert expected_tables.issubset(actual_tables), f"Missing tables: {expected_tables - actual_tables}"


def test_lifespan_initializes_tables():
    from app.main import create_app

    app = create_app()
    with TestClient(app) as test_client:
        res = test_client.get("/api/v1/health")
        assert res.status_code == 200


