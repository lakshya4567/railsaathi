"""
main.py — FastAPI application entry point for RailSaathi backend.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import ping, ensure_indexes, close_connection
from .routes import trains_router, stations_router, search_router, assistant_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Connecting to MongoDB Atlas …")
    if not ping():
        logger.critical("Cannot reach MongoDB — check MONGODB_URI in .env")
    else:
        logger.info("MongoDB Atlas connected.")
        ensure_indexes()
    yield
    # Shutdown
    close_connection()
    logger.info("RailSaathi backend stopped.")


app = FastAPI(
    title="RailSaathi API",
    description="Indian Railway information platform — timetables, routes, and station data.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server and any configured origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST"],  # POST is needed by /api/assistant/chat
    allow_headers=["*"],
)

# Routers
app.include_router(trains_router)
app.include_router(stations_router)
app.include_router(search_router)
app.include_router(assistant_router)


# ── Health ─────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["health"])
def health_check():
    db_ok = ping()
    status = "ok" if db_ok else "degraded"
    return JSONResponse(
        status_code=200 if db_ok else 503,
        content={"status": status, "database": "connected" if db_ok else "unreachable"},
    )


# ── Train position estimate ─────────────────────────────────────────────────
from datetime import datetime
from fastapi import Query, HTTPException
from .database import get_db
from .services import estimate_position


@app.get("/api/trains/{train_number}/position", tags=["trains"])
def train_position(
    train_number: str,
    date: str = Query(..., description="Journey start date in YYYY-MM-DD format"),
    time: str | None = Query(None, description="Query time HH:MM:SS (UTC). Defaults to now."),
):
    """
    Estimates a train's current position based on its scheduled timetable.
    IMPORTANT: Returns a SCHEDULED ESTIMATE — not live GPS data.
    """
    try:
        journey_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD")

    query_time = None
    if time:
        try:
            query_time = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M:%S")
        except ValueError:
            raise HTTPException(status_code=422, detail="time must be HH:MM:SS")

    db = get_db()
    train = db["trains"].find_one(
        {"trainNumber": train_number},
        {"_id": 0, "completeOrderedRoute": 1, "trainName": 1},
    )
    if not train:
        raise HTTPException(status_code=404, detail=f"Train {train_number} not found")

    result = estimate_position(
        train.get("completeOrderedRoute", []), journey_date, query_time
    )
    result["trainNumber"] = train_number
    result["trainName"] = train.get("trainName")
    return result
