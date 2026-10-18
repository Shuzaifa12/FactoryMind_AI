import io
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
import pytest


def generate_deterministic_10k_csv() -> bytes:
    """Generates deterministic 10,000 row industrial telemetry CSV in memory.
    Includes:
    - 10,000 rows across 2 machines (CNC-01 and TURB-02)
    - 2 duplicate machine-timestamp rows
    - 4 missing values (blank temperature/vibration fields)
    - 3 invalid timestamp strings
    """
    lines = ["timestamp,machine_id,temperature,vibration,current"]
    base_time = datetime(2026, 10, 18, 0, 0, 0, tzinfo=timezone.utc)

    for i in range(1, 9996):
        # Alternate machines
        mach = "CNC-01" if i % 2 == 0 else "TURB-02"
        ts = (base_time + timedelta(seconds=i * 10)).isoformat()

        # Regular telemetry
        temp = 42.0 + (i % 15) * 0.2
        vib = 1.4 + (i % 8) * 0.1
        curr = 12.0 + (i % 5) * 0.5

        # Insert occasional intentional anomalies
        if i in [500, 1500, 4000]:
            vib = 6.8  # elevated spike
            temp = 78.5

        # Insert 4 intentional missing values
        if i in [100, 200]:
            lines.append(f"{ts},{mach},,{vib:.2f},{curr:.2f}")
        elif i in [300, 400]:
            lines.append(f"{ts},{mach},{temp:.2f},,{curr:.2f}")
        else:
            lines.append(f"{ts},{mach},{temp:.2f},{vib:.2f},{curr:.2f}")

    # Add 2 duplicate machine-timestamp rows
    dup_ts = (base_time + timedelta(seconds=500)).isoformat()
    lines.append(f"{dup_ts},CNC-01,43.00,1.50,12.50")
    lines.append(f"{dup_ts},CNC-01,43.00,1.50,12.50")

    # Add 3 invalid timestamps
    lines.append("invalid_timestamp_string,CNC-01,42.50,1.60,12.20")
    lines.append("corrupted_date_format,TURB-02,55.10,2.10,20.00")
    lines.append("not-a-datetime,CNC-01,41.90,1.55,12.10")

    return "\n".join(lines).encode("utf-8")


def test_upload_10k_rows_preview(client: TestClient):
    csv_bytes = generate_deterministic_10k_csv()
    files = {"file": ("turbines_10k_batch.csv", io.BytesIO(csv_bytes), "text/csv")}

    res = client.post("/api/v1/datasets/upload", files=files)
    assert res.status_code == 200, res.text

    data = res.json()
    assert data["filename"] == "turbines_10k_batch.csv"
    assert data["total_rows"] == 10000
    assert "timestamp" in data["headers"]
    assert "machine_id" in data["headers"]
    assert len(data["preview_rows"]) == 5
    assert data["suggested_mapping"]["timestamp_col"] == "timestamp"
    assert data["suggested_mapping"]["machine_id_col"] == "machine_id"


def test_column_mapping_10k_rows_data_quality(client: TestClient):
    csv_bytes = generate_deterministic_10k_csv()
    files = {"file": ("turbines_10k_batch.csv", io.BytesIO(csv_bytes), "text/csv")}

    upload_res = client.post("/api/v1/datasets/upload", files=files)
    dataset_id = upload_res.json()["dataset_id"]

    # Apply column mapping
    mapping_res = client.post(
        f"/api/v1/datasets/{dataset_id}/mapping",
        json={
            "timestamp_col": "timestamp",
            "machine_id_col": "machine_id",
            "temperature_col": "temperature",
            "vibration_col": "vibration",
            "current_col": "current",
        },
    )
    assert mapping_res.status_code == 200
    quality = mapping_res.json()

    # Verify deterministic quality audit
    assert quality["total_rows"] == 10000
    # 3 rows had invalid timestamps and are counted in valid_rows deduction
    assert quality["valid_rows"] == 9997
    # 2 duplicate machine-timestamp rows were injected
    assert quality["duplicate_rows_count"] >= 2
    # Missing values from the 4 injected blank fields
    assert quality["missing_values_count"] >= 4
    # Unique machines detected
    assert set(quality["detected_machines"]) == {"CNC-01", "TURB-02"}


def test_process_dataset_10k_rows_fast_anomaly_detection(client: TestClient):
    csv_bytes = generate_deterministic_10k_csv()
    files = {"file": ("turbines_10k_batch.csv", io.BytesIO(csv_bytes), "text/csv")}

    upload_res = client.post("/api/v1/datasets/upload", files=files)
    dataset_id = upload_res.json()["dataset_id"]

    client.post(
        f"/api/v1/datasets/{dataset_id}/mapping",
        json={
            "timestamp_col": "timestamp",
            "machine_id_col": "machine_id",
            "temperature_col": "temperature",
            "vibration_col": "vibration",
            "current_col": "current",
        },
    )

    # Process dataset (ingestion + Isolation Forest)
    proc_res = client.post(
        f"/api/v1/datasets/{dataset_id}/process",
        json={"contamination": 0.05, "use_fallback_if_small": True},
    )
    assert proc_res.status_code == 200
    res_data = proc_res.json()

    assert res_data["status"] == "ready"
    assert res_data["rows_ingested"] >= 9990
    assert res_data["machines_created"] == 2

    # Verify dataset recovery query
    get_res = client.get(f"/api/v1/datasets/{dataset_id}")
    assert get_res.status_code == 200
    ds = get_res.json()
    assert ds["status"] == "ready"
    assert ds["row_count"] >= 9990


def test_upload_rejects_unsupported_file_types(client: TestClient):
    # PDF files cannot be uploaded as sensor data
    fake_pdf = b"%PDF-1.4 simulated binary stream"
    files = {"file": ("sensor_readings.pdf", io.BytesIO(fake_pdf), "application/pdf")}

    res = client.post("/api/v1/datasets/upload", files=files)
    assert res.status_code == 400
    err = res.json()["error"]
    assert err["code"] == "UNSUPPORTED_FILE_TYPE"
