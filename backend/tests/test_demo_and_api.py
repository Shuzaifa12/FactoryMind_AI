import io
from fastapi.testclient import TestClient


def test_demo_load_creates_four_machines_and_alerts(client: TestClient):
    # Load demo dataset
    res = client.post("/api/v1/demo/load")
    assert res.status_code == 200
    dataset_data = res.json()
    assert dataset_data["is_simulated"] is True
    assert dataset_data["source"] == "demo"
    dataset_id = dataset_data["id"]

    # Verify summary
    sum_res = client.get(f"/api/v1/datasets/{dataset_id}/summary")
    assert sum_res.status_code == 200
    summary = sum_res.json()
    assert summary["total_machines"] == 4
    assert summary["active_alerts_count"] >= 1
    assert summary["total_estimated_impact"] > 0

    # Verify machines list
    mach_res = client.get(f"/api/v1/datasets/{dataset_id}/machines")
    assert mach_res.status_code == 200
    machines = mach_res.json()
    assert len(machines) == 4
    ext_ids = {m["external_id"] for m in machines}
    assert ext_ids == {"CNC-01", "PRESS-04", "PUMP-12", "CONV-02"}

    # Verify readings with anomaly flags
    cnc = next(m for m in machines if m["external_id"] == "CNC-01")
    readings_res = client.get(f"/api/v1/machines/{cnc['id']}/readings?limit=100")
    assert readings_res.status_code == 200
    readings = readings_res.json()
    assert len(readings) > 0
    assert any(r["is_anomalous"] for r in readings)

    # Verify alerts list and status updates
    alerts_res = client.get(f"/api/v1/datasets/{dataset_id}/alerts")
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert len(alerts) >= 1

    first_alert = alerts[0]
    assert first_alert["anomaly_score"] is not None
    assert len(first_alert["evidence"]) > 0

    # Patch status to reviewed
    patch_res = client.patch(
        f"/api/v1/alerts/{first_alert['id']}", json={"status": "reviewed"}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "reviewed"


def test_demo_load_repeatability(client: TestClient):
    # Loading demo repeatedly resets without duplicating or corrupting state
    res1 = client.post("/api/v1/demo/load")
    assert res1.status_code == 200
    id1 = res1.json()["id"]

    res2 = client.post("/api/v1/demo/load")
    assert res2.status_code == 200
    id2 = res2.json()["id"]

    # Only 4 machines should exist in the current active dataset
    mach_res = client.get(f"/api/v1/datasets/{id2}/machines")
    assert mach_res.status_code == 200
    assert len(mach_res.json()) == 4


def test_update_machine_assumptions_recalculates_impact(client: TestClient):
    # Load demo data
    res = client.post("/api/v1/demo/load")
    dataset_id = res.json()["id"]

    mach_res = client.get(f"/api/v1/datasets/{dataset_id}/machines")
    cnc = next(m for m in mach_res.json() if m["external_id"] == "CNC-01")

    # Update loss_per_hour from 1200 to 2000
    update_res = client.put(
        f"/api/v1/machines/{cnc['id']}/assumptions",
        json={
            "loss_per_hour": 2000.0,
            "maintenance_cost_estimate": 4000.0,
            "criticality": 5,
            "production_priority": 5,
        },
    )
    assert update_res.status_code == 200
    updated_mach = update_res.json()
    assert updated_mach["loss_per_hour"] == 2000.0
    assert updated_mach["assumption_source"] == "user"

    # Verify impact on CNC-01 alert reflects the updated rate
    alerts_res = client.get(f"/api/v1/datasets/{dataset_id}/alerts?machine_id=CNC-01")
    cnc_alert = alerts_res.json()[0]
    assert cnc_alert["impact"]["inputs_used"]["loss_per_hour"] == 2000.0
    assert cnc_alert["impact"]["maintenance_cost"] == 4000.0


def test_upload_csv_preview_and_mapping(client: TestClient):
    csv_content = b"""timestamp,machine,temperature,vibration,current
2026-10-18T00:00:00Z,MILL-01,42.5,1.8,12.0
2026-10-18T00:15:00Z,MILL-01,42.7,1.9,12.1
2026-10-18T00:30:00Z,MILL-01,43.0,1.8,12.2
2026-10-18T00:45:00Z,MILL-01,58.0,4.9,16.5
2026-10-18T01:00:00Z,MILL-01,61.2,5.2,17.1
"""
    files = {"file": ("test_feed.csv", io.BytesIO(csv_content), "text/csv")}
    upload_res = client.post("/api/v1/datasets/upload", files=files)
    assert upload_res.status_code == 200
    data = upload_res.json()
    assert data["filename"] == "test_feed.csv"
    assert data["total_rows"] == 5
    dataset_id = data["dataset_id"]

    # Apply mapping
    mapping_res = client.post(
        f"/api/v1/datasets/{dataset_id}/mapping",
        json={
            "timestamp_col": "timestamp",
            "machine_id_col": "machine",
            "temperature_col": "temperature",
            "vibration_col": "vibration",
            "current_col": "current",
        },
    )
    assert mapping_res.status_code == 200
    quality = mapping_res.json()
    assert quality["valid_rows"] == 5
    assert "MILL-01" in quality["detected_machines"]

    # Process dataset
    proc_res = client.post(
        f"/api/v1/datasets/{dataset_id}/process",
        json={"contamination": 0.2, "use_fallback_if_small": True},
    )
    assert proc_res.status_code == 200
    assert proc_res.json()["status"] == "ready"


def test_get_machine_maintenance_history(client: TestClient):
    # Load demo data which seeds maintenance records
    res = client.post("/api/v1/demo/load")
    assert res.status_code == 200
    dataset_id = res.json()["id"]

    mach_res = client.get(f"/api/v1/datasets/{dataset_id}/machines")
    assert mach_res.status_code == 200
    machines = mach_res.json()
    cnc = next(m for m in machines if m["external_id"] == "CNC-01")

    # Fetch maintenance records for CNC-01
    maint_res = client.get(f"/api/v1/machines/{cnc['id']}/maintenance")
    assert maint_res.status_code == 200
    records = maint_res.json()
    assert isinstance(records, list)
    assert len(records) >= 1

    first_record = records[0]
    assert first_record["machine_id"] == "CNC-01"
    assert "date" in first_record
    assert "description" in first_record
    assert first_record["source"] in ["csv", "pdf"]
    assert first_record["match_confidence"] in ["exact_id", "user_confirmed", "unmatched"]

    # Non-existent machine returns standard 404
    missing_res = client.get("/api/v1/machines/999999/maintenance")
    assert missing_res.status_code == 404
    assert missing_res.json()["error"]["code"] == "MACHINE_NOT_FOUND"

