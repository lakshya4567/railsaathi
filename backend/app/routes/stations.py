"""
stations.py — API routes for station queries.
"""
import re
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..utils import strip_id, paginate

router = APIRouter(prefix="/api/stations", tags=["stations"])

_STATION_PROJ = {"_id": 0}
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
def list_stations(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    state: str | None = Query(None),
    zone: str | None = Query(None),
):
    db = get_db()
    query: dict = {}
    if state:
        query["state"] = {"$regex": re.escape(state), "$options": "i"}
    if zone:
        query["zone"] = zone.upper()
    total, items = paginate(db["stations"], query, page, page_size, _STATION_PROJ)
    return {"total": total, "page": page, "page_size": page_size, "results": items}


@router.get("/search")
def search_stations(
    q: str = Query(..., min_length=1, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    db = get_db()
    # Code match first (exact prefix), then name regex
    if re.match(r"^[A-Za-z0-9\-]{2,8}$", q):
        code_query = {"code": {"$regex": f"^{re.escape(q.upper())}"}}
        total_code, items = paginate(db["stations"], code_query, 1, page_size, _STATION_PROJ)
        if items:
            return {"total": total_code, "page": 1, "page_size": page_size, "results": items}

    name_query = {"name": {"$regex": re.escape(q), "$options": "i"}}
    total, items = paginate(db["stations"], name_query, page, page_size, _STATION_PROJ)
    return {"total": total, "page": page, "page_size": page_size, "results": items}


@router.get("/{station_code}")
def get_station(station_code: str):
    db = get_db()
    doc = db["stations"].find_one({"code": station_code.upper()}, _STATION_PROJ)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Station {station_code} not found")
    return doc


@router.get("/{station_code}/trains")
def get_trains_at_station(
    station_code: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    db = get_db()
    code = station_code.upper()
    # Verify station exists
    if not db["stations"].find_one({"code": code}, {"_id": 1}):
        raise HTTPException(status_code=404, detail=f"Station {code} not found")

    query = {"completeOrderedRoute.stationCode": code}
    total, items = paginate(db["trains"], query, page, page_size, _TRAIN_SUMMARY_PROJ)
    return {"total": total, "page": page, "page_size": page_size, "results": items}
