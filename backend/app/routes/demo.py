"""
demo.py — DEMO endpoints used by the Services page.

Everything returned here is simulated (see services/demo_tools.py) and carries isDemo=true.
Real PNR status, fares, seats, live status and food ordering need approvals this project does not
have. Nothing is stored on the server and the database is only read.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..database import get_db
from ..services import demo_tools
from ..services.railway_tools import DatabaseUnavailable, ToolInputError

router = APIRouter(prefix="/api/demo", tags=["demo"])


class OrderItem(BaseModel):
    id: str = Field(..., max_length=8)
    qty: int = Field(..., ge=1, le=5)


class FoodOrder(BaseModel):
    train_number: str = Field(..., max_length=12)
    station: str = Field(..., max_length=80)
    items: list[OrderItem] = Field(..., min_length=1, max_length=10)


def _run(fn, *args, **kwargs):
    try:
        result = fn(get_db(), *args, **kwargs)
    except ToolInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except DatabaseUnavailable:
        raise HTTPException(status_code=503, detail="The railway database is unreachable right now.")
    if not result.get("found"):
        raise HTTPException(status_code=404, detail=result.get("message", "Not found."))
    return result


@router.get("/pnr/{pnr}")
def pnr(pnr: str):
    return _run(demo_tools.demo_pnr_lookup, pnr)


@router.get("/food/menu")
def food_menu(station: str):
    return _run(demo_tools.demo_food_menu, station)


@router.post("/food/order")
def food_order(order: FoodOrder):
    return _run(demo_tools.demo_place_order, order.train_number, order.station, [i.model_dump() for i in order.items])


@router.get("/fare")
def fare(train: str, from_station: str, to_station: str, travel_class: str | None = None):
    return _run(demo_tools.demo_fare_estimate, train, from_station, to_station, travel_class)


@router.get("/seats")
def seats(train: str, date: str, travel_class: str | None = None):
    return _run(demo_tools.demo_seat_availability, train, date, travel_class)


@router.get("/live/{train}")
def live(train: str):
    return _run(demo_tools.demo_live_status, train)
