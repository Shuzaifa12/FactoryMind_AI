from fastapi.testclient import TestClient


def test_assistant_chat_endpoint_reachable(client: TestClient):
    # Load demo dataset first
    demo_res = client.post("/api/v1/demo/load")
    assert demo_res.status_code == 200
    dataset_id = demo_res.json()["id"]

    # Test POST /api/v1/assistant/chat
    res = client.post(
        "/api/v1/assistant/chat",
        json={
            "prompt": "Investigate alert #1 on CNC-01",
            "dataset_id": dataset_id,
            "language": "en"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert "content" in data
    assert "toolCalls" in data
    assert "evidenceCited" in data
    assert data["metadata"]["dataset_id"] == dataset_id


def test_assistant_dataset_scoping_and_nonexistent_alert(client: TestClient):
    # Load demo dataset (Dataset A)
    demo_res = client.post("/api/v1/demo/load")
    assert demo_res.status_code == 200
    dataset_a_id = demo_res.json()["id"]

    # Query nonexistent alert #25 on Dataset A
    res = client.post(
        "/api/v1/assistant/chat",
        json={
            "prompt": "Investigate alert #25 on Extruder-03",
            "dataset_id": dataset_a_id,
            "language": "en"
        }
    )
    assert res.status_code == 200
    data = res.json()
    # Must report alert not found in dataset A without falling back or fabricating demo data
    assert "could not be found in the active dataset" in data["content"] or "Error" in data["content"]
    assert data["metadata"]["dataset_id"] == dataset_a_id
