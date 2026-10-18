import io
from fastapi.testclient import TestClient
import pytest


def test_numeric_sensor_parsing_with_whitespace_and_strings(client: TestClient):
    # CSV with leading/trailing whitespace around numbers, string numbers, and some missing cells
    csv_content = b"""time,asset_id,thermal_deg,oscillation_rate,power_draw
2026-10-18T00:00:00Z,PUMP-01, 42.5 , 1.65 , 14.1
2026-10-18T00:15:00Z,PUMP-01,43.0, 1.70\\r, 14.3
2026-10-18T00:30:00Z,PUMP-01,, 1.68,
2026-10-18T00:45:00Z,PUMP-01, 58.4 , , 16.5
2026-10-18T01:00:00Z,PUMP-01,61.2, 5.20 , 17.2
2026-10-18T01:15:00Z,PUMP-01,65.0, 5.55 , 17.8
"""
    files = {"file": ("whitespace_sensors.csv", io.BytesIO(csv_content), "text/csv")}
    upload_res = client.post("/api/v1/datasets/upload", files=files)
    assert upload_res.status_code == 200
    data = upload_res.json()
    dataset_id = data["dataset_id"]

    # Custom column mapping with different source column names
    mapping_res = client.post(
        f"/api/v1/datasets/{dataset_id}/mapping",
        json={
            "timestamp_col": "time",
            "machine_id_col": "asset_id",
            "temperature_col": "thermal_deg",
            "vibration_col": "oscillation_rate",
            "current_col": "power_draw",
        },
    )
    assert mapping_res.status_code == 200
    quality = mapping_res.json()
    assert quality["valid_rows"] == 6
    assert "PUMP-01" in quality["detected_machines"]

    # Process dataset (regression test proving valid mapped readings reach anomaly detection)
    proc_res = client.post(
        f"/api/v1/datasets/{dataset_id}/process",
        json={"contamination": 0.2, "use_fallback_if_small": True},
    )
    assert proc_res.status_code == 200
    res_data = proc_res.json()
    assert res_data["status"] == "ready"
    assert res_data["rows_ingested"] == 6
    assert "run_id" in res_data["detection"]
    assert "method" in res_data["detection"]
    assert "features" in res_data["detection"]
    assert len(res_data["detection"]["features"]) >= 1


def test_csv_with_no_usable_numerical_columns_fails_gracefully(client: TestClient):
    # CSV where all sensor columns contain only non-numeric text or are unmapped
    csv_content = b"""timestamp,machine_id,status_text,operator_notes
2026-10-18T00:00:00Z,CNC-01,normal,running smoothly
2026-10-18T00:15:00Z,CNC-01,warning,vibration noticed
2026-10-18T00:30:00Z,CNC-01,normal,all clear
"""
    files = {"file": ("non_numeric_text.csv", io.BytesIO(csv_content), "text/csv")}
    upload_res = client.post("/api/v1/datasets/upload", files=files)
    assert upload_res.status_code == 200
    dataset_id = upload_res.json()["dataset_id"]

    # Map timestamp and machine_id, but map no numeric sensor columns (or map text columns)
    mapping_res = client.post(
        f"/api/v1/datasets/{dataset_id}/mapping",
        json={
            "timestamp_col": "timestamp",
            "machine_id_col": "machine_id",
            "temperature_col": None,
            "vibration_col": None,
            "current_col": None,
        },
    )
    assert mapping_res.status_code == 200

    # Attempting to process should return a clean 400 AppError instead of HTTP 500
    proc_res = client.post(
        f"/api/v1/datasets/{dataset_id}/process",
        json={"contamination": 0.1, "use_fallback_if_small": True},
    )
    assert proc_res.status_code == 400
    err_body = proc_res.json()
    assert "error" in err_body
    assert err_body["error"]["code"] == "NO_NUMERICAL_CHANNELS"
