"""
test_api.py — integration tests for RailSaathi FastAPI backend.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"


def test_list_trains():
    response = client.get("/api/trains?page=1&page_size=5")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "results" in data
    assert len(data["results"]) <= 5


def test_get_train_detail():
    # Fetch first train to get its number
    r = client.get("/api/trains?page=1&page_size=1")
    trains = r.json().get("results", [])
    if not trains:
        pytest.skip("No trains in database")
    num = trains[0]["trainNumber"]

    # Test detail
    detail_res = client.get(f"/api/trains/{num}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["trainNumber"] == num
    assert "completeOrderedRoute" in detail

    # Test route
    route_res = client.get(f"/api/trains/{num}/route")
    assert route_res.status_code == 200
    assert "completeOrderedRoute" in route_res.json()

    # Test map
    map_res = client.get(f"/api/trains/{num}/map")
    assert map_res.status_code == 200
    assert "route" in map_res.json()


def test_search_trains():
    response = client.get("/api/trains/search?q=Express")
    assert response.status_code == 200
    data = response.json()
    assert "results" in data


def test_list_stations():
    response = client.get("/api/stations?page=1&page_size=5")
    assert response.status_code == 200
    data = response.json()
    assert "results" in data


def test_search_stations():
    response = client.get("/api/stations/search?q=New Delhi")
    assert response.status_code == 200
    data = response.json()
    assert "results" in data


def test_global_search():
    response = client.get("/api/search?q=Delhi")
    assert response.status_code == 200
    data = response.json()
    assert "trains" in data
    assert "stations" in data


def test_train_position():
    # Pick a train
    r = client.get("/api/trains?page=1&page_size=1")
    trains = r.json().get("results", [])
    if not trains:
        pytest.skip("No trains")
    num = trains[0]["trainNumber"]

    pos_res = client.get(f"/api/trains/{num}/position?date=2026-11-02&time=10:00:00")
    assert pos_res.status_code == 200
    pos = pos_res.json()
    assert "status" in pos
    assert "disclaimer" in pos
