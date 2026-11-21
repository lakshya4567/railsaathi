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



@router.get("/route-search")
def search_trains_between_stations(
    from_station: str = Query(..., min_length=2, max_length=10),
    to_station: str = Query(..., min_length=2, max_length=10),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Find trains whose stored ordered route includes both stations in that order."""
    from_code = from_station.strip().upper()
    to_code = to_station.strip().upper()
    if from_code == to_code:
        raise HTTPException(status_code=400, detail="Choose two different stations")

    db = get_db()
    station_projection = {"_id": 0, "code": 1, "name": 1}
    from_doc = db["stations"].find_one({"code": from_code}, station_projection)
    to_doc = db["stations"].find_one({"code": to_code}, station_projection)
    if not from_doc:
        raise HTTPException(status_code=404, detail=f"Origin station {from_code} not found")
    if not to_doc:
        raise HTTPException(status_code=404, detail=f"Destination station {to_code} not found")

    # MongoDB's multikey index narrows the candidates to trains containing both stops.
    candidates = db["trains"].find(
        {"completeOrderedRoute.stationCode": {"$all": [from_code, to_code]}},
        {
            "_id": 0, "trainNumber": 1, "trainName": 1, "type": 1,
            "source": 1, "destination": 1, "overallDistanceKm": 1,
            "runningDays": 1, "completeOrderedRoute": 1,
        },
    ).sort("trainNumber", 1)

    start_index = (page - 1) * page_size
    total = 0
    results = []
    for train in candidates:
        route = train.get("completeOrderedRoute") or []
        origin_stops = [
            stop for stop in route
            if stop.get("stationCode", "").upper() == from_code
        ]
        destination_stops = [
            stop for stop in route
            if stop.get("stationCode", "").upper() == to_code
        ]
        matching_pair = None
        for origin in origin_stops:
            for destination in destination_stops:
                if destination.get("sequence", 0) > origin.get("sequence", 0):
                    matching_pair = (origin, destination)
                    break
            if matching_pair:
                break
        if not matching_pair:
            continue

        total += 1
        if start_index < total <= start_index + page_size:
            origin, destination = matching_pair
            results.append({
                "trainNumber": train.get("trainNumber"),
                "trainName": train.get("trainName"),
                "type": train.get("type"),
                "source": train.get("source"),
                "destination": train.get("destination"),
                "overallDistanceKm": train.get("overallDistanceKm"),
                "runningDays": train.get("runningDays"),
                "fromStop": origin,
                "toStop": destination,
            })

    return {
        "fromStation": from_doc,
        "toStation": to_doc,
        "total": total,
        "page": page,
        "page_size": page_size,
        "results": results,
    }


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
