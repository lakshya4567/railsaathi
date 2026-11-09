"""
search.py — unified /api/search endpoint that returns both trains and stations.
"""
import re
from fastapi import APIRouter, Query
from ..database import get_db
from ..utils import paginate

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def global_search(
    q: str = Query(..., min_length=1, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    db = get_db()
    escaped = re.escape(q)

    # Trains: number prefix OR name regex
    if q.strip().isdigit():
        train_query = {"trainNumber": {"$regex": f"^{escaped}"}}
    else:
        train_query = {"trainName": {"$regex": escaped, "$options": "i"}}

    train_proj = {
        "_id": 0, "trainNumber": 1, "trainName": 1, "type": 1,
        "source": 1, "destination": 1, "overallDistanceKm": 1,
    }
    total_t, trains = paginate(db["trains"], train_query, page, page_size, train_proj)

    # Stations: code prefix OR name regex
    station_query = {
        "$or": [
            {"code": {"$regex": f"^{escaped.upper()}"}},
            {"name": {"$regex": escaped, "$options": "i"}},
        ]
    }
    station_proj = {"_id": 0, "code": 1, "name": 1, "state": 1, "zone": 1}
    total_s, stations = paginate(db["stations"], station_query, page, page_size, station_proj)

    return {
        "query": q,
        "trains": {"total": total_t, "results": trains},
        "stations": {"total": total_s, "results": stations},
    }
