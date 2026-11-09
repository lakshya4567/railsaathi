"""
railway_tools.py — the ONLY way the AI assistant touches MongoDB.

Design rules
------------
* Every function is read-only (find / find_one / count_documents). Nothing here
  inserts, updates, deletes or drops anything.
* The AI never writes queries. It picks a tool by name and supplies a few
  validated arguments; the query shapes below are fixed in code.
* Every user/AI-supplied string that reaches a regex is passed through
  re.escape() and is type-checked first, so it can never become a Mongo operator.
* Results contain only what the database holds. Missing data stays missing
  (None) — nothing is estimated or invented here. Durations / halts are plain
  arithmetic on the stored timetable and are labelled "scheduled".

All tool functions take `db` as the first argument (a PyMongo Database). The
registry at the bottom binds it lazily so tests can pass their own handle.
"""
from __future__ import annotations

import functools
import re
from datetime import date as _date, datetime, timedelta, timezone
from typing import Any, Callable

# India has no daylight saving time, so a fixed +05:30 offset is exact. (Avoids
# needing the optional `tzdata` package on Windows.)
IST = timezone(timedelta(hours=5, minutes=30))
DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]  # matches datetime.weekday()

MAX_SCAN = 400          # max trains read when matching routes in Python
MAX_RESULTS = 25        # hard cap on list sizes returned by any tool

TRAIN_SUMMARY_PROJ = {
    "_id": 0, "trainNumber": 1, "trainName": 1, "type": 1,
    "source": 1, "destination": 1, "overallDistanceKm": 1, "runningDays": 1,
}
STATION_PROJ = {"_id": 0}


class DatabaseUnavailable(Exception):
    """Raised when MongoDB cannot be reached. The assistant shows a clear error
    instead of falling back to made-up data."""


class ToolInputError(Exception):
    """Raised for invalid arguments; reported back to the model as a tool error."""


# ───────────────────────── small helpers ─────────────────────────

def _as_str(value: Any, field: str, max_len: int = 80) -> str:
    if not isinstance(value, str):
        raise ToolInputError(f"'{field}' must be text.")
    value = value.strip()
    if not value:
        raise ToolInputError(f"'{field}' must not be empty.")
    if len(value) > max_len:
        raise ToolInputError(f"'{field}' is too long (max {max_len} characters).")
    return value


def _as_int(value: Any, field: str, default: int, lo: int, hi: int) -> int:
    if value is None:
        return default
    if isinstance(value, bool):
        raise ToolInputError(f"'{field}' must be a number.")
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise ToolInputError(f"'{field}' must be a number.")
    return max(lo, min(hi, n))


def _train_number(value: Any) -> str:
    s = _as_str(value, "train_number", 12)
    if not re.fullmatch(r"\d{3,6}", s):
        raise ToolInputError("A train number is 3–6 digits (for example 12810).")
    return s


def _to_minutes(t: Any) -> float | None:
    """'HH:MM[:SS]' -> minutes since midnight, or None if absent/unparseable."""
    if not t or not isinstance(t, str):
        return None
    try:
        parts = [int(x) for x in t.split(":")]
        h, m = parts[0], parts[1]
        s = parts[2] if len(parts) > 2 else 0
        if not (0 <= h < 24 and 0 <= m < 60 and 0 <= s < 60):
            return None
        return h * 60 + m + s / 60
    except (ValueError, IndexError):
        return None


def _day(stop: dict) -> int:
    try:
        d = int(stop.get("journeyDay") or 1)
        return d if d >= 1 else 1
    except (TypeError, ValueError):
        return 1


def _abs_minutes(stop: dict, field: str) -> float | None:
    m = _to_minutes(stop.get(field))
    return None if m is None else (_day(stop) - 1) * 1440 + m


def fmt_duration(minutes: int | None) -> str | None:
    if minutes is None:
        return None
    h, m = divmod(int(minutes), 60)
    return f"{h}h {m:02d}m"


def _hhmm(t: Any) -> str | None:
    return t[:5] if isinstance(t, str) and len(t) >= 5 else None


def valid_coordinates(c: Any) -> dict | None:
    """Same rule the existing map uses: both values present and non-zero."""
    if isinstance(c, dict) and c.get("latitude") and c.get("longitude"):
        return {"latitude": c["latitude"], "longitude": c["longitude"]}
    return None


def _guard(fn: Callable) -> Callable:
    """Turn any PyMongo failure into DatabaseUnavailable (no silent fallbacks)."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except (ToolInputError, DatabaseUnavailable):
            raise
        except Exception as exc:  # noqa: BLE001
            # Local import so this module stays importable without pymongo in tests.
            try:
                from pymongo.errors import PyMongoError
            except ImportError:  # pragma: no cover
                PyMongoError = ()  # type: ignore
            if PyMongoError and isinstance(exc, PyMongoError):
                raise DatabaseUnavailable(str(exc)) from exc
            raise
    return wrapper


# Words people add around station names that are not part of the stored name.
_FILLER = {"railway", "station", "stn", "rly", "the", "junction", "jn", "jcn"}


def _name_tokens(text: str) -> list[str]:
    raw = re.findall(r"[A-Za-z0-9]+", text.lower())[:6]
    return [t for t in raw if t not in _FILLER] or raw


def _token_regex(token: str) -> str:
    return re.escape(token)


def _station_name_query(text: str) -> dict:
    tokens = _name_tokens(text)
    if not tokens:
        raise ToolInputError("Please give a station name or code.")
    return {"$and": [{"name": {"$regex": _token_regex(t), "$options": "i"}} for t in tokens]}


def _summary(train: dict) -> dict:
    return {
        "trainNumber": train.get("trainNumber"),
        "trainName": train.get("trainName"),
        "type": train.get("type") or None,
        "source": train.get("source"),
        "destination": train.get("destination"),
        "overallDistanceKm": train.get("overallDistanceKm"),
        "runningDays": train.get("runningDays"),
    }


def _running_days_text(rd: Any) -> str | None:
    if not isinstance(rd, dict):
        return None
    on = [d for d in ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] if rd.get(d)]
    if len(on) == 7:
        return "Daily"
    return ", ".join(on) if on else None


def _sorted_route(train: dict) -> list[dict]:
    route = train.get("completeOrderedRoute") or []
    return sorted(route, key=lambda s: (s.get("sequence") is None, s.get("sequence") or 0))


# ───────────────────────── station resolution ─────────────────────────

def _station_train_count(db, code: str) -> int:
    return db["trains"].count_documents({"completeOrderedRoute.stationCode": code})


def _rank_stations(db, text: str, limit: int) -> list[dict]:
    """Find stations by code or name and rank them.

    Ranking tiers: exact code, exact name, name starts with the query, then
    any name containing all words. Within a tier, stations with more trains
    stopping first (so 'Raipur' prefers the main junction over a tiny halt).
    """
    text = _as_str(text, "query", 80)
    q_lower = text.lower()
    found: dict[str, tuple[int, dict]] = {}

    if re.fullmatch(r"[A-Za-z0-9\-]{1,8}", text):
        doc = db["stations"].find_one({"code": text.upper()}, STATION_PROJ)
        if doc:
            found[doc["code"]] = (0, doc)

    cursor = db["stations"].find(_station_name_query(text), STATION_PROJ).limit(60)
    tokens = _name_tokens(text)
    for doc in cursor:
        code = doc.get("code")
        if not code or code in found:
            continue
        name = (doc.get("name") or "").lower()
        name_words = re.findall(r"[a-z0-9]+", name)
        if name == q_lower:
            tier = 1
        elif name_words[: len(tokens)] == tokens or name.startswith(q_lower):
            tier = 2
        else:
            tier = 3
        found[code] = (tier, doc)

    ranked = sorted(found.values(), key=lambda x: (x[0], x[1].get("name") or ""))
    # Count trains only for the leading candidates (cheap, uses the route index).
    head = ranked[:20]
    scored = []
    for tier, doc in head:
        scored.append((tier, -_station_train_count(db, doc["code"]), doc.get("name") or "", doc))
    scored.sort(key=lambda x: x[:3])
    out = []
    for tier, neg_count, _, doc in scored[:limit]:
        item = dict(doc)
        item["trainCount"] = -neg_count
        out.append(item)
    return out


def _station_brief(doc: dict) -> dict:
    return {"code": doc.get("code"), "name": doc.get("name"),
            "state": doc.get("state") or None, "zone": doc.get("zone") or None}


def resolve_station(db, text: str) -> tuple[dict | None, list[dict]]:
    """Return (best_match, other_candidates) for a station name or code."""
    ranked = _rank_stations(db, text, limit=5)
    if not ranked:
        return None, []
    return ranked[0], ranked[1:]


def _resolution_note(query: str, best: dict, others: list[dict]) -> dict:
    return {
        "query": query,
        "chosen": _station_brief(best),
        "otherMatches": [_station_brief(o) for o in others[:4]],
        "ambiguous": bool(others),
    }


# ───────────────────────── tools ─────────────────────────

@_guard
def search_trains(db, query: str, limit: int | None = None) -> dict:
    """Find trains by number (exact or prefix) or by words in the train name."""
    q = _as_str(query, "query", 100)
    limit = _as_int(limit, "limit", 8, 1, MAX_RESULTS)
    col = db["trains"]

    if re.fullmatch(r"\d{1,6}", q):
        exact = col.find_one({"trainNumber": q}, TRAIN_SUMMARY_PROJ)
        if exact:
            return {"found": True, "total": 1, "trains": [_summary(exact)], "matchedBy": "exact train number"}
        flt: dict = {"trainNumber": {"$regex": "^" + re.escape(q)}}
        how = "train number prefix"
        qn = q.lower()
    else:
        tokens = re.findall(r"[A-Za-z0-9]+", q.lower())[:6]
        if not tokens:
            raise ToolInputError("Please give a train number or part of a train name.")
        flt = {"$and": [{"trainName": {"$regex": re.escape(t), "$options": "i"}} for t in tokens]}
        how = "train name"
        qn = " ".join(tokens)  # rank on the normalised words, not the raw text

    total = col.count_documents(flt)
    docs = list(col.find(flt, TRAIN_SUMMARY_PROJ).limit(60))
    docs.sort(key=lambda d: (
        (d.get("trainName") or "").lower() != qn,
        not (d.get("trainName") or "").lower().startswith(qn),
        d.get("trainNumber") or "",
    ))
    trains = [_summary(d) for d in docs[:limit]]
    if not trains:
        return {"found": False, "total": 0, "trains": [], "message": f"No train matching '{q}' in the database."}
    return {"found": True, "total": total, "returned": len(trains), "trains": trains, "matchedBy": how}


@_guard
def get_train_details(db, train_number: str) -> dict:
    """Full stored record for one train (without the long stop list)."""
    num = _train_number(train_number)
    doc = db["trains"].find_one({"trainNumber": num}, {"_id": 0})
    if not doc:
        return {"found": False, "message": f"Train {num} is not in the database."}
    route = _sorted_route(doc)
    train = _summary(doc)
    train["runningDaysText"] = _running_days_text(doc.get("runningDays"))
    train["stopCount"] = len(route)
    if route:
        first, last = route[0], route[-1]
        train["departsSource"] = _hhmm(first.get("departureTime"))
        train["arrivesDestination"] = _hhmm(last.get("arrivalTime"))
        a, b = _abs_minutes(first, "departureTime"), _abs_minutes(last, "arrivalTime")
        if a is not None and b is not None and b >= a:
            train["scheduledDuration"] = fmt_duration(round(b - a))
            train["scheduledDurationMinutes"] = round(b - a)
    extra = {k: v for k, v in doc.items()
             if k not in train and k not in ("completeOrderedRoute", "source", "destination")}
    return {"found": True, "train": train, "otherStoredFields": extra or None}


@_guard
def get_train_route(db, train_number: str, show_map: bool = False) -> dict:
    """Complete ordered route with arrival / departure / halt for each stop."""
    num = _train_number(train_number)
    doc = db["trains"].find_one({"trainNumber": num}, {"_id": 0, **{k: 1 for k in
                                TRAIN_SUMMARY_PROJ if k != "_id"}, "completeOrderedRoute": 1})
    if not doc:
        return {"found": False, "message": f"Train {num} is not in the database."}
    route = _sorted_route(doc)
    if not route:
        return {"found": False, "message": f"Train {num} has no stored route."}

    codes = [s.get("stationCode") for s in route if s.get("stationCode")]
    coords = {}
    for st in db["stations"].find({"code": {"$in": codes}}, {"_id": 0, "code": 1, "coordinates": 1}):
        coords[st["code"]] = valid_coordinates(st.get("coordinates"))

    stops = []
    for s in route:
        arr, dep = s.get("arrivalTime"), s.get("departureTime")
        halt = None
        ma, md = _to_minutes(arr), _to_minutes(dep)
        if ma is not None and md is not None:
            halt = round(md - ma if md >= ma else md + 1440 - ma)
        stops.append({
            "sequence": s.get("sequence"),
            "stationCode": s.get("stationCode"),
            "stationName": s.get("stationName"),
            "arrivalTime": arr or None,
            "departureTime": dep or None,
            "haltMinutes": halt,
            "journeyDay": _day(s),
            "distance": s.get("distance"),
            "hasCoordinates": coords.get(s.get("stationCode")) is not None,
        })
    mapped = sum(1 for s in stops if s["hasCoordinates"])
    return {
        "found": True,
        "train": _summary(doc),
        "stops": stops,
        "stopCount": len(stops),
        "coordinates": {"mapped": mapped, "total": len(stops)},
        "showMap": bool(show_map),
    }


@_guard
def search_stations(db, query: str, limit: int | None = None) -> dict:
    """Find stations by code or name."""
    q = _as_str(query, "query", 80)
    limit = _as_int(limit, "limit", 8, 1, MAX_RESULTS)
    ranked = _rank_stations(db, q, limit)
    if not ranked:
        return {"found": False, "total": 0, "stations": [], "message": f"No station matching '{q}' in the database."}
    return {"found": True, "total": len(ranked), "stations": ranked}


@_guard
def get_station_details(db, station: str) -> dict:
    """Stored record for one station (code or name)."""
    q = _as_str(station, "station", 80)
    best, others = resolve_station(db, q)
    if not best:
        return {"found": False, "message": f"No station matching '{q}' in the database."}
    st = dict(best)
    st["coordinates"] = valid_coordinates(st.get("coordinates"))
    return {"found": True, "station": st, "resolution": _resolution_note(q, best, others)}


@_guard
def get_station_trains(db, station: str, limit: int | None = None) -> dict:
    """List the trains that stop at a station (no times)."""
    q = _as_str(station, "station", 80)
    limit = _as_int(limit, "limit", 15, 1, MAX_RESULTS)
    best, others = resolve_station(db, q)
    if not best:
        return {"found": False, "message": f"No station matching '{q}' in the database."}
    flt = {"completeOrderedRoute.stationCode": best["code"]}
    total = db["trains"].count_documents(flt)
    docs = list(db["trains"].find(flt, TRAIN_SUMMARY_PROJ).limit(200))
    docs.sort(key=lambda d: d.get("trainNumber") or "")
    return {
        "found": True,
        "station": _station_brief(best),
        "total": total,
        "returned": min(limit, len(docs)),
        "trains": [_summary(d) for d in docs[:limit]],
        "resolution": _resolution_note(q, best, others),
    }


@_guard
def get_trains_at_station(db, station: str, after_time: str | None = None,
                          limit: int | None = None) -> dict:
    """Trains at a station WITH their scheduled arrival/departure there,
    ordered by time of day. Optional after_time ('HH:MM') keeps later ones."""
    q = _as_str(station, "station", 80)
    limit = _as_int(limit, "limit", 12, 1, MAX_RESULTS)
    after_min = None
    if after_time is not None:
        after_min = _to_minutes(_as_str(after_time, "after_time", 8))
        if after_min is None:
            raise ToolInputError("after_time must look like 14:30.")
    best, others = resolve_station(db, q)
    if not best:
        return {"found": False, "message": f"No station matching '{q}' in the database."}
    code = best["code"]
    flt = {"completeOrderedRoute.stationCode": code}
    total = db["trains"].count_documents(flt)
    proj = {**TRAIN_SUMMARY_PROJ, "completeOrderedRoute": 1}
    rows = []
    for d in db["trains"].find(flt, proj).limit(MAX_SCAN):
        stop = next((s for s in _sorted_route(d) if s.get("stationCode") == code), None)
        if not stop:
            continue
        tod = _to_minutes(stop.get("departureTime"))
        if tod is None:
            tod = _to_minutes(stop.get("arrivalTime"))
        if after_min is not None and (tod is None or tod < after_min):
            continue
        row = _summary(d)
        row["atStation"] = {
            "arrivalTime": stop.get("arrivalTime") or None,
            "departureTime": stop.get("departureTime") or None,
            "journeyDay": _day(stop),
        }
        rows.append((tod if tod is not None else 1e9, row))
    rows.sort(key=lambda r: r[0])
    return {
        "found": True,
        "station": _station_brief(best),
        "total": total,
        "matchingFilter": len(rows),
        "returned": min(limit, len(rows)),
        "scanTruncated": total > MAX_SCAN,
        "afterTime": after_time,
        "trains": [r[1] for r in rows[:limit]],
        "resolution": _resolution_note(q, best, others),
    }


@_guard
def find_trains_between_stations(db, from_station: str, to_station: str,
                                 day: str | None = None, sort_by: str | None = None,
                                 limit: int | None = None) -> dict:
    """Direct trains that stop at both stations, in that order of travel."""
    a_q = _as_str(from_station, "from_station", 80)
    b_q = _as_str(to_station, "to_station", 80)
    limit = _as_int(limit, "limit", 10, 1, MAX_RESULTS)
    sort_by = (sort_by or "departure").lower()
    if sort_by not in ("departure", "duration"):
        raise ToolInputError("sort_by must be 'departure' or 'duration'.")
    if day is not None:
        day = _as_str(day, "day", 3).upper()
        if day not in DAYS:
            raise ToolInputError("day must be one of MON, TUE, WED, THU, FRI, SAT, SUN.")

    a, a_others = resolve_station(db, a_q)
    b, b_others = resolve_station(db, b_q)
    if not a or not b:
        missing = a_q if not a else b_q
        return {"found": False, "reason": "station_not_found",
                "message": f"No station matching '{missing}' in the database."}
    if a["code"] == b["code"]:
        return {"found": False, "reason": "same_station",
                "message": "The origin and destination resolve to the same station."}

    flt = {"completeOrderedRoute.stationCode": {"$all": [a["code"], b["code"]]}}
    total_both = db["trains"].count_documents(flt)
    proj = {**TRAIN_SUMMARY_PROJ, "completeOrderedRoute": 1}
    rows = []
    for d in db["trains"].find(flt, proj).limit(MAX_SCAN):
        route = _sorted_route(d)
        sa = next((s for s in route if s.get("stationCode") == a["code"]), None)
        sb = next((s for s in route if s.get("stationCode") == b["code"]), None)
        if not sa or not sb or (sa.get("sequence") or 0) >= (sb.get("sequence") or 0):
            continue  # wrong direction (stops at B before A)

        if day is not None and isinstance(d.get("runningDays"), dict):
            dep_wd = DAYS.index(day)
            start_wd = (dep_wd - (_day(sa) - 1)) % 7
            if not d["runningDays"].get(DAYS[start_wd]):
                continue

        dep_abs = _abs_minutes(sa, "departureTime")
        if dep_abs is None:
            dep_abs = _abs_minutes(sa, "arrivalTime")
        arr_abs = _abs_minutes(sb, "arrivalTime")
        if arr_abs is None:
            arr_abs = _abs_minutes(sb, "departureTime")
        duration = None
        if dep_abs is not None and arr_abs is not None and arr_abs >= dep_abs:
            duration = round(arr_abs - dep_abs)
        dist = None
        da, db_ = sa.get("distance"), sb.get("distance")
        if isinstance(da, (int, float)) and isinstance(db_, (int, float)) and db_ >= da:
            dist = round(db_ - da, 1)

        row = _summary(d)
        row["journey"] = {
            "departureTime": _hhmm(sa.get("departureTime") or sa.get("arrivalTime")),
            "departureDay": _day(sa),
            "arrivalTime": _hhmm(sb.get("arrivalTime") or sb.get("departureTime")),
            "arrivalDay": _day(sb),
            "scheduledDurationMinutes": duration,
            "scheduledDuration": fmt_duration(duration),
            "distanceKm": dist,
            "intermediateStops": (sb.get("sequence") or 0) - (sa.get("sequence") or 0) - 1,
        }
        rows.append((dep_abs, duration, row))

    if not rows:
        return {"found": False, "reason": "no_direct_train",
                "from": _station_brief(a), "to": _station_brief(b),
                "resolution": [_resolution_note(a_q, a, a_others), _resolution_note(b_q, b, b_others)],
                "message": (f"No direct train in the database runs from {a['name']} ({a['code']}) "
                            f"to {b['name']} ({b['code']})."
                            + (f" (Filtered to trains starting a run so they depart on {day}.)" if day else "")
                            + " Connecting journeys are not searched.")}

    timed = [r for r in rows if r[1] is not None]
    fastest = min(timed, key=lambda r: r[1])[2] if timed else None
    key = (lambda r: (r[1] is None, r[1] or 0)) if sort_by == "duration" \
        else (lambda r: (r[0] is None, r[0] or 0))
    rows.sort(key=key)
    return {
        "found": True,
        "from": _station_brief(a),
        "to": _station_brief(b),
        "directTrainsFound": len(rows),
        "trainsStoppingAtBoth": total_both,
        "scanTruncated": total_both > MAX_SCAN,
        "returned": min(limit, len(rows)),
        "sortedBy": sort_by,
        "dayFilter": day,
        "shortestScheduled": {
            "trainNumber": fastest["trainNumber"], "trainName": fastest["trainName"],
            "scheduledDuration": fastest["journey"]["scheduledDuration"],
            "scheduledDurationMinutes": fastest["journey"]["scheduledDurationMinutes"],
        } if fastest else None,
        "trains": [r[2] for r in rows[:limit]],
        "resolution": [_resolution_note(a_q, a, a_others), _resolution_note(b_q, b, b_others)],
        "note": "Direct trains only; times are the printed timetable, not live running status.",
    }


POSITION_DISCLAIMER = (
    "ESTIMATE from the scheduled timetable only. This is NOT live tracking: "
    "delays, diversions and cancellations are not known."
)


@_guard
def get_scheduled_position(db, train_number: str, date: str | None = None,
                           time: str | None = None, now: datetime | None = None) -> dict:
    """Timetable-based expected position (India time). Uses journey_estimator.

    `date` (YYYY-MM-DD) and `time` (HH:MM) give the moment to estimate for;
    both default to the current India time. Because a long-distance train can
    be on its second or third day, the run START dates that could be in
    progress at that moment are each checked against the train's running days.
    """
    from .journey_estimator import estimate_position  # existing service, unchanged

    num = _train_number(train_number)
    doc = db["trains"].find_one({"trainNumber": num}, {"_id": 0, "trainNumber": 1,
                                "trainName": 1, "runningDays": 1, "completeOrderedRoute": 1})
    if not doc:
        return {"found": False, "message": f"Train {num} is not in the database."}
    route = _sorted_route(doc)
    if len(route) < 2:
        return {"found": False, "message": f"Train {num} has no usable stored route."}

    if now is None:
        now_ist = datetime.now(IST).replace(tzinfo=None)
    elif now.tzinfo is None:
        now_ist = now  # tests: naive value is treated as India time
    else:
        now_ist = now.astimezone(IST).replace(tzinfo=None)
    try:
        d = datetime.strptime(date, "%Y-%m-%d") if date else now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    except ValueError:
        raise ToolInputError("date must look like 2026-11-09.")
    if time:
        tm = _to_minutes(time)
        if tm is None:
            raise ToolInputError("time must look like 21:30.")
        query = d + timedelta(minutes=int(tm))
    elif date:
        query = d + timedelta(hours=12)  # a date alone: report as of noon, and say so
    else:
        query = now_ist

    max_day = max((_day(s) for s in route), default=1)
    rd = doc.get("runningDays")
    instances, in_progress = [], []
    for k in range(max_day):
        start = (query.replace(hour=0, minute=0, second=0, microsecond=0)) - timedelta(days=k)
        if isinstance(rd, dict) and not rd.get(DAYS[start.weekday()]):
            continue
        est = estimate_position(route, start, query)
        inst = {
            "journeyStartDate": start.strftime("%Y-%m-%d"),
            "status": est.get("status"),
            "message": est.get("message"),
        }
        seg = est.get("estimated_segment")
        if seg:
            fs, ts = seg["from_stop"], seg["to_stop"]
            inst["estimatedBetween"] = {
                "lastScheduledStop": {"code": fs.get("stationCode"), "name": fs.get("stationName"),
                                      "scheduledDeparture": seg.get("departed_at")},
                "nextScheduledStop": {"code": ts.get("stationCode"), "name": ts.get("stationName"),
                                      "scheduledArrival": seg.get("arrives_at")},
            }
            in_progress.append(inst)
        instances.append(inst)

    result = {
        "found": True,
        "isEstimate": True,
        "isLiveTracking": False,
        "disclaimer": POSITION_DISCLAIMER,
        "timetableTimezone": "Indian Standard Time (IST, UTC+05:30)",
        "estimatedForIST": query.strftime("%Y-%m-%d %H:%M"),
        "assumedNoon": bool(date and not time),
        "runningDaysKnown": isinstance(rd, dict),
        "train": {"trainNumber": doc.get("trainNumber"), "trainName": doc.get("trainName")},
    }
    if in_progress:
        result["status"] = "in_progress_per_schedule"
        result["instances"] = in_progress[:3]
        result["message"] = ("According to the timetable, "
                             f"{len(in_progress)} run(s) of this train would be between stops at that time.")
    else:
        result["status"] = "no_scheduled_run_in_progress" if instances else "not_running_that_day"
        result["instances"] = instances[:3]
        first = route[0]
        result["message"] = (
            "The timetable shows no run in progress at that time (it may not have started, may have finished, "
            "may not run on those days, or may be halted at a station, which the estimator cannot place). "
            f"Scheduled start: {_hhmm(first.get('departureTime'))} from {first.get('stationName')}."
        )
    return result


# ───────────────────────── registry (used by the AI layer) ─────────────────────────
#
# Each entry: python function + JSON schema shown to the model. The model can
# only call what is listed here, with the arguments declared here.

TOOL_SPECS: dict[str, dict] = {
    "search_trains": {
        "fn": search_trains,
        "description": "Find trains by number (exact or starting digits) or by words in the train name.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Train number such as 12810, or name words such as 'Mumbai Mail'."},
                "limit": {"type": "integer", "description": "Max results (default 8)."},
            },
            "required": ["query"],
        },
    },
    "get_train_details": {
        "fn": get_train_details,
        "description": "Get the stored record of ONE train: name, type, source, destination, distance, running days, scheduled departure/arrival. Does not list stops.",
        "parameters": {
            "type": "object",
            "properties": {"train_number": {"type": "string", "description": "Train number, 3-6 digits."}},
            "required": ["train_number"],
        },
    },
    "get_train_route": {
        "fn": get_train_route,
        "description": "Get a train's COMPLETE ordered route with arrival, departure and halt time at each stop. Set show_map=true when the user wants to SEE the route / view it on the map.",
        "parameters": {
            "type": "object",
            "properties": {
                "train_number": {"type": "string", "description": "Train number, 3-6 digits."},
                "show_map": {"type": "boolean", "description": "Also display the route on the map."},
            },
            "required": ["train_number"],
        },
    },
    "search_stations": {
        "fn": search_stations,
        "description": "Find stations by code or name. Use when the user's station name may match several stations.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Station code or name words, e.g. 'Raipur' or 'NGP'."},
                "limit": {"type": "integer"},
            },
            "required": ["query"],
        },
    },
    "get_station_details": {
        "fn": get_station_details,
        "description": "Get the stored record of ONE station: name, code, state, zone, address, coordinates and how many trains stop there. Accepts a code or a name.",
        "parameters": {
            "type": "object",
            "properties": {"station": {"type": "string", "description": "Station code or name."}},
            "required": ["station"],
        },
    },
    "get_station_trains": {
        "fn": get_station_trains,
        "description": "List which trains stop at a station (no times). Use for 'which trains stop at X'.",
        "parameters": {
            "type": "object",
            "properties": {
                "station": {"type": "string", "description": "Station code or name."},
                "limit": {"type": "integer"},
            },
            "required": ["station"],
        },
    },
    "get_trains_at_station": {
        "fn": get_trains_at_station,
        "description": "Trains at a station WITH their scheduled arrival/departure there, in time order. Use for 'what trains leave X in the evening' (after_time='17:00').",
        "parameters": {
            "type": "object",
            "properties": {
                "station": {"type": "string", "description": "Station code or name."},
                "after_time": {"type": "string", "description": "Only trains at/after this time, HH:MM 24-hour."},
                "limit": {"type": "integer"},
            },
            "required": ["station"],
        },
    },
    "find_trains_between_stations": {
        "fn": find_trains_between_stations,
        "description": "Find DIRECT trains from one station to another (origin must come before destination on the train's route). Returns scheduled departure, arrival and duration at those two stations. Use sort_by='duration' for 'shortest/fastest'.",
        "parameters": {
            "type": "object",
            "properties": {
                "from_station": {"type": "string", "description": "Origin station name or code."},
                "to_station": {"type": "string", "description": "Destination station name or code."},
                "day": {"type": "string", "description": "Optional weekday of departure from the origin: MON..SUN."},
                "sort_by": {"type": "string", "description": "'departure' (default) or 'duration'."},
                "limit": {"type": "integer"},
            },
            "required": ["from_station", "to_station"],
        },
    },
    "get_scheduled_position": {
        "fn": get_scheduled_position,
        "description": "Timetable-based EXPECTED position of a train (not live tracking). Use for 'where is it now / what is its next station'. Defaults to the current India time.",
        "parameters": {
            "type": "object",
            "properties": {
                "train_number": {"type": "string", "description": "Train number, 3-6 digits."},
                "date": {"type": "string", "description": "Optional calendar date YYYY-MM-DD (India time)."},
                "time": {"type": "string", "description": "Optional time HH:MM, 24-hour, India time."},
            },
            "required": ["train_number"],
        },
    },
}

_ALLOWED_ARGS = {name: set(spec["parameters"]["properties"]) for name, spec in TOOL_SPECS.items()}


def run_tool(name: str, args: Any, db=None) -> dict:
    """Validate the tool name/arguments and run it. Raises ToolInputError for
    bad input and DatabaseUnavailable if MongoDB is down."""
    spec = TOOL_SPECS.get(name)
    if spec is None:
        raise ToolInputError(f"Unknown tool '{name}'.")
    if not isinstance(args, dict):
        raise ToolInputError("Tool arguments must be an object.")
    unknown = set(args) - _ALLOWED_ARGS[name]
    if unknown:
        raise ToolInputError(f"Unexpected argument(s): {', '.join(sorted(unknown))}.")
    required = spec["parameters"].get("required", [])
    missing = [r for r in required if r not in args]
    if missing:
        raise ToolInputError(f"Missing required argument(s): {', '.join(missing)}.")
    if db is None:
        from ..database import get_db  # lazy: keeps this module importable in tests
        db = get_db()
    return spec["fn"](db, **args)


def declarations() -> list[dict]:
    """Function declarations in the neutral JSON-schema form providers translate."""
    return [{"name": n, "description": s["description"], "parameters": s["parameters"]}
            for n, s in TOOL_SPECS.items()]
