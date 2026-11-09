"""
utils.py — small helper functions shared across services and routes.
"""
from bson import ObjectId


def strip_id(doc: dict) -> dict:
    """Remove MongoDB's _id field (or convert to string) before returning to client."""
    if doc is None:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


def paginate(collection, query: dict, page: int, page_size: int, projection: dict | None = None):
    """
    Return (total, items) with pagination applied.
    page is 1-indexed.
    """
    total = collection.count_documents(query)
    skip = (page - 1) * page_size
    cursor = collection.find(query, projection).skip(skip).limit(page_size)
    items = [strip_id(doc) for doc in cursor]
    return total, items
