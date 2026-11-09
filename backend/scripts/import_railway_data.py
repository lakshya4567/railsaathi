"""
import_railway_data.py — imports stations.json and trains.json into MongoDB Atlas.

Usage:
    python -I scripts/import_railway_data.py [--test] [--batch-size 200]

Flags:
    --test          Import only the first 10 trains (validates pipeline without full upload).
    --batch-size N  Documents per bulk_write batch (default: 200).
    --skip-stations Don't re-import stations (useful when only trains changed).

Safe to rerun: uses upsert (no duplicates).
Preserves entire route — no geographic filtering applied.
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Resolve paths relative to THIS script location so it can be run from any CWD.
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent          # backend/
REPO_ROOT = PROJECT_ROOT.parent           # IndianRailway/
DATA_DIR = REPO_ROOT.parent / "Indian-Railway-Data-main"  # sibling of IndianRailway/

STATIONS_FILE = DATA_DIR / "stations.json"
TRAINS_FILE = DATA_DIR / "trains.json"

sys.path.insert(0, str(PROJECT_ROOT))

# Load .env from backend/
from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

from pymongo import MongoClient, UpdateOne
from pymongo.errors import BulkWriteError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("importer")


# ── MongoDB connection ──────────────────────────────────────────────────────

def get_db():
    uri = os.environ["MONGODB_URI"]
    db_name = os.getenv("DB_NAME", "indian_railway")
    client = MongoClient(uri, serverSelectionTimeoutMS=15_000)
    client.admin.command("ping")           # fail fast if unreachable
    log.info("Connected to MongoDB Atlas — database: %s", db_name)
    return client[db_name]


# ── Storage check ───────────────────────────────────────────────────────────

def check_storage(db) -> None:
    """Log current database size and warn if nearing Atlas free-tier limit."""
    try:
        stats = db.command("dbStats")
        size_mb = stats.get("dataSize", 0) / 1024 / 1024
        storage_mb = stats.get("storageSize", 0) / 1024 / 1024
        log.info("Current DB data: %.1f MB  |  storage: %.1f MB  (Atlas Free limit: 512 MB)", size_mb, storage_mb)
        if storage_mb > 450:
            log.warning("Storage is above 450 MB — approaching Atlas free-tier limit!")
    except Exception as exc:
        log.warning("Could not read dbStats: %s", exc)


# ── Stations importer ───────────────────────────────────────────────────────

def import_stations(db, batch_size: int) -> dict:
    log.info("Reading %s …", STATIONS_FILE)
    with open(STATIONS_FILE, "r", encoding="utf-8") as fh:
        stations = json.load(fh)

    log.info("Importing %d stations …", len(stations))
    col = db["stations"]
    col.create_index([("code", 1)], unique=True)

    total = len(stations)
    inserted = updated = skipped = failed = 0
    ops = []

    for i, station in enumerate(stations):
        code = (station.get("code") or "").strip()
        if not code:
            log.warning("Station #%d has no code — skipping", i)
            failed += 1
            continue

        doc = {
            "code": code,
            "name": (station.get("name") or "").strip(),
            "state": (station.get("state") or "").strip(),
            "zone": (station.get("zone") or "").strip(),
            "address": (station.get("address") or "").strip(),
            "coordinates": station.get("coordinates"),  # may be None or zero
        }
        ops.append(UpdateOne({"code": code}, {"$set": doc}, upsert=True))

        if len(ops) >= batch_size:
            ins, upd, fail = _flush(col, ops)
            inserted += ins; updated += upd; failed += fail
            ops = []

    if ops:
        ins, upd, fail = _flush(col, ops)
        inserted += ins; updated += upd; failed += fail

    log.info(
        "Stations done — total: %d | inserted: %d | updated: %d | failed: %d",
        total, inserted, updated, failed,
    )
    return {"total": total, "inserted": inserted, "updated": updated, "failed": failed}


# ── Trains importer ─────────────────────────────────────────────────────────

def import_trains(db, batch_size: int, limit: int | None = None) -> dict:
    log.info("Reading %s …", TRAINS_FILE)
    with open(TRAINS_FILE, "r", encoding="utf-8") as fh:
        trains = json.load(fh)

    if limit:
        trains = trains[:limit]
        log.info("Test mode — limiting to first %d trains.", limit)
    else:
        log.info("Importing %d trains …", len(trains))

    col = db["trains"]
    col.create_index([("trainNumber", 1)], unique=True)

    total = len(trains)
    inserted = updated = failed = 0
    invalid_records: list[str] = []
    ops = []

    for i, train in enumerate(trains):
        num = (train.get("trainNumber") or "").strip()
        name = (train.get("trainName") or "").strip()

        if not num:
            log.warning("Record #%d has no trainNumber — skipping", i)
            invalid_records.append(f"Record #{i}: missing trainNumber")
            failed += 1
            continue

        route = train.get("completeOrderedRoute") or []
        # Basic validation: route should have at least 2 stops
        if len(route) < 2:
            log.warning("Train %s (%s) has only %d route stop(s) — preserving but flagged", num, name, len(route))
            invalid_records.append(f"Train {num}: route has {len(route)} stop(s)")

        doc = {
            "trainNumber": num,
            "trainName": name,
            "type": (train.get("type") or "").strip(),
            "source": train.get("source"),
            "destination": train.get("destination"),
            "runningDays": train.get("runningDays"),
            "overallDistanceKm": train.get("overallDistanceKm"),
            "completeOrderedRoute": route,
        }
        ops.append(UpdateOne({"trainNumber": num}, {"$set": doc}, upsert=True))

        if len(ops) >= batch_size:
            ins, upd, fail = _flush(col, ops)
            inserted += ins; updated += upd; failed += fail
            ops = []
            log.info("  … %d / %d processed", i + 1, total)

    if ops:
        ins, upd, fail = _flush(col, ops)
        inserted += ins; updated += upd; failed += fail

    if invalid_records:
        log.warning("Invalid / flagged records (%d):", len(invalid_records))
        for r in invalid_records[:20]:
            log.warning("  %s", r)

    log.info(
        "Trains done — total: %d | inserted: %d | updated: %d | failed: %d",
        total, inserted, updated, failed,
    )
    return {"total": total, "inserted": inserted, "updated": updated, "failed": failed, "flagged": len(invalid_records)}


# ── Bulk write helper ────────────────────────────────────────────────────────

def _flush(col, ops: list) -> tuple[int, int, int]:
    """Execute buffered UpdateOne ops; return (inserted, updated, failed)."""
    try:
        result = col.bulk_write(ops, ordered=False)
        inserted = result.upserted_count
        updated = result.modified_count
        return inserted, updated, 0
    except BulkWriteError as bwe:
        errors = bwe.details.get("writeErrors", [])
        inserted = bwe.details.get("nUpserted", 0)
        updated = bwe.details.get("nModified", 0)
        log.warning("BulkWriteError — %d ops failed in this batch", len(errors))
        for e in errors[:5]:
            log.warning("  code=%s msg=%s", e.get("code"), e.get("errmsg", "")[:120])
        return inserted, updated, len(errors)


# ── Metadata record ──────────────────────────────────────────────────────────

def record_metadata(db, collection_name: str, stats: dict) -> None:
    db["import_metadata"].update_one(
        {"collection": collection_name},
        {
            "$set": {
                "collection": collection_name,
                "last_import_utc": datetime.now(timezone.utc).isoformat(),
                "stats": stats,
            }
        },
        upsert=True,
    )


# ── Entry point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Import Indian Railway data into MongoDB Atlas")
    parser.add_argument("--test", action="store_true", help="Import only first 10 trains (dry-run style)")
    parser.add_argument("--batch-size", type=int, default=200, metavar="N")
    parser.add_argument("--skip-stations", action="store_true", help="Skip station import")
    args = parser.parse_args()

    log.info("=== RailSaathi Data Importer ===")
    log.info("Data directory: %s", DATA_DIR)
    log.info("Batch size: %d", args.batch_size)
    if args.test:
        log.info("TEST MODE — only first 10 trains will be imported")

    if not STATIONS_FILE.exists():
        log.error("stations.json not found at %s", STATIONS_FILE)
        sys.exit(1)
    if not TRAINS_FILE.exists():
        log.error("trains.json not found at %s", TRAINS_FILE)
        sys.exit(1)

    db = get_db()
    check_storage(db)

    t_start = time.time()

    # Stations
    if not args.skip_stations:
        station_stats = import_stations(db, args.batch_size)
        record_metadata(db, "stations", station_stats)
    else:
        log.info("Skipping station import (--skip-stations)")

    # Trains
    limit = 10 if args.test else None
    train_stats = import_trains(db, args.batch_size, limit=limit)
    record_metadata(db, "trains", train_stats)

    elapsed = time.time() - t_start
    log.info("Import complete in %.1f seconds.", elapsed)
    check_storage(db)


if __name__ == "__main__":
    main()
