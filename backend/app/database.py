"""
database.py — establishes the MongoDB Atlas connection via PyMongo.
All index creation happens here on startup with safe exception handling for existing indexes.
"""
import logging
from pymongo import MongoClient, ASCENDING, TEXT
from pymongo.errors import ConnectionFailure, OperationFailure
from .config import settings

logger = logging.getLogger(__name__)

_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=10_000,
            connectTimeoutMS=10_000,
            socketTimeoutMS=30_000,
        )
    return _client


def get_db():
    return get_client()[settings.db_name]


def ping() -> bool:
    """Return True if Atlas is reachable."""
    try:
        get_client().admin.command("ping")
        return True
    except (ConnectionFailure, OperationFailure) as exc:
        logger.error("MongoDB ping failed: %s", exc)
        return False


def ensure_indexes() -> None:
    """Create indexes needed for the application's query patterns gracefully."""
    db = get_db()

    # Define indexes with collection reference and desired name/options
    indexes_to_ensure = [
        ("trains", [("trainNumber", ASCENDING)], {"unique": True, "name": "idx_train_number"}),
        ("trains", [("trainName", TEXT)], {"name": "idx_train_name_text"}),
        ("trains", [("completeOrderedRoute.stationCode", ASCENDING)], {"name": "idx_route_station_code"}),
        ("trains", [("source.code", ASCENDING)], {"name": "idx_source_code"}),
        ("trains", [("destination.code", ASCENDING)], {"name": "idx_dest_code"}),
        ("stations", [("code", ASCENDING)], {"unique": True, "name": "idx_station_code"}),
        ("stations", [("name", TEXT)], {"name": "idx_station_name_text"}),
        ("stations", [("state", ASCENDING)], {"name": "idx_station_state"}),
        ("stations", [("zone", ASCENDING)], {"name": "idx_station_zone"}),
        ("import_metadata", [("collection", ASCENDING)], {"unique": True, "name": "idx_meta_collection"}),
    ]

    for col_name, keys, options in indexes_to_ensure:
        col = db[col_name]
        try:
            col.create_index(keys, **options)
        except OperationFailure as exc:
            # Code 85 is IndexOptionsConflict (index exists with different name/options)
            logger.warning("Index creation note for %s (%s): %s", col_name, options.get("name"), exc)

    logger.info("MongoDB indexes checked/ensured.")


def close_connection() -> None:
    global _client
    if _client:
        _client.close()
        _client = None
        logger.info("MongoDB connection closed.")
