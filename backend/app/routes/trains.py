"""
trains.py — API routes for train queries.
"""
import re
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from ..database import get_db
from ..utils import strip_id, paginate

router = APIRouter(prefix="/api/trains", tags=["trains"])

_TRAIN_SUMMARY_PROJ = {
    "_id": 0,
    "trainNumber": 1,
    "trainName": 1,
    "type": 1,
    "source": 1,
    "destination": 1,
    "overallDistanceKm": 1,
    "runningDays": 1,
}


@router.get("")
def list_trains(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    db = get_db()
    total, items = paginate(db["trains"], {}, page, page_size, _TRAIN_SUMMARY_PROJ)
    return {"total": total, "page": page, "page_size": page_size, "results": items}


@router.get("/search")
def search_trains(
    q: str = Query(..., min_length=1, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    db = get_db()
    # Numeric → search by train number prefix; text → name regex + text index
    if q.isdigit():
        query = {"trainNumber": {"$regex": f"^{re.escape(q)}"}}
    else:
        query = {"trainName": {"$regex": re.escape(q), "$options": "i"}}
    total, items = paginate(db["trains"], query, page, page_size, _TRAIN_SUMMARY_PROJ)
    return {"total": total, "page": page, "page_size": page_size, "results": items}


@router.get("/{train_number}")
def get_train(train_number: str):
    db = get_db()
    doc = db["trains"].find_one({"trainNumber": train_number}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Train {train_number} not found")
    return doc


@router.get("/{train_number}/route")
def get_train_route(train_number: str):
    db = get_db()
    doc = db["trains"].find_one(
        {"trainNumber": train_number},
        {"_id": 0, "trainNumber": 1, "trainName": 1, "type": 1,
         "source": 1, "destination": 1, "runningDays": 1,
         "overallDistanceKm": 1, "completeOrderedRoute": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail=f"Train {train_number} not found")
    return doc


@router.get("/{train_number}/map")
def get_train_map_data(train_number: str):
    """
    Returns the ordered route with station coordinates looked up from the
    stations collection — used by the Leaflet map component.
    """
    db = get_db()
    train = db["trains"].find_one(
        {"trainNumber": train_number},
        {"_id": 0, "trainNumber": 1, "trainName": 1, "source": 1,
         "destination": 1, "completeOrderedRoute": 1},
    )
    if not train:
        raise HTTPException(status_code=404, detail=f"Train {train_number} not found")

    route = train.get("completeOrderedRoute", [])
    codes = [stop["stationCode"] for stop in route]

    # Fetch all station coords in one query
    station_docs = db["stations"].find(
        {"code": {"$in": codes}},
        {"_id": 0, "code": 1, "coordinates": 1},
    )
    coords_map = {s["code"]: s.get("coordinates") for s in station_docs}

    # Enrich route stops with coordinates
    enriched = []
    for stop in route:
        coords = coords_map.get(stop["stationCode"])
        enriched.append({**stop, "coordinates": coords})

    return {
        "trainNumber": train["trainNumber"],
        "trainName": train["trainName"],
        "source": train["source"],
        "destination": train["destination"],
        "route": enriched,
    }
