"""
models — Pydantic schemas for API request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional


# ---------- station ----------

class Coordinates(BaseModel):
    latitude: float
    longitude: float


class StationBase(BaseModel):
    code: str
    name: str
    state: Optional[str] = None
    zone: Optional[str] = None
    address: Optional[str] = None
    coordinates: Optional[Coordinates] = None


class StationSummary(BaseModel):
    """Light version used inside route stops."""
    code: str
    name: str


# ---------- route stop ----------

class RouteStop(BaseModel):
    sequence: int
    stationCode: str
    stationName: str
    arrivalTime: Optional[str] = None
    departureTime: Optional[str] = None
    journeyDay: int = 1
    distance: Optional[float] = None


# ---------- train ----------

class RunningDays(BaseModel):
    SUN: bool = False
    MON: bool = False
    TUE: bool = False
    WED: bool = False
    THU: bool = False
    FRI: bool = False
    SAT: bool = False


class TrainSummary(BaseModel):
    """Light card shown in search results."""
    trainNumber: str
    trainName: str
    type: Optional[str] = None
    source: StationSummary
    destination: StationSummary
    overallDistanceKm: Optional[float] = None
    runningDays: Optional[RunningDays] = None


class TrainDetail(TrainSummary):
    """Full record including the ordered route list."""
    completeOrderedRoute: list[RouteStop] = Field(default_factory=list)


# ---------- pagination ----------

class Page(BaseModel):
    total: int
    page: int
    page_size: int
    results: list
