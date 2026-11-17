"""
journey_tools.py — journey-planning tools built on the same read-only, validated
pattern as railway_tools.py.

Everything here is computed from the stored timetable (arrival/departure times,
journey days, distances, running days). Nothing is live: results describe the
printed schedule only. Times use a "week minutes" model (Monday 00:00 = 0) so
overnight runs, multi-day runs and weekly running days are handled consistently.
"""
from __future__ import annotations

from bisect import bisect_left
from datetime import datetime
from typing import Any

from . import railway_tools as rt
from .railway_tools import (
    DAYS, IST, MAX_SCAN, TRAIN_SUMMARY_PROJ, ToolInputError, _abs_minutes, _as_int, _as_str,
    _day, _guard, _hhmm, _resolution_note, _running_days_text, _sorted_route, _station_brief,
    _summary, _to_minutes, _train_number, fmt_duration, resolve_station, valid_coordinates,
)

WEEK = 7 * 1440
MAX_SCAN_TRANSFER = 250   # trains read on each side when searching one-change journeys
_PROJ = {**TRAIN_SUMMARY_PROJ, "completeOrderedRoute": 1}


# ───────────────────────── helpers ─────────────────────────

def _runs(doc: dict) -> list[int]:
    """Weekday indexes (Mon=0) on which a run STARTS. Unknown running days = every day."""
    rd = doc.get("runningDays")
    if not isinstance(rd, dict):
        return list(range(7))
    return [i for i, d in enumerate(DAYS) if rd.get(d)]


def _day_index(day: Any, now: datetime | None) -> int:
    if day is not None:
        d = _as_str(day, "day", 3).upper()
        if d not in DAYS:
            raise ToolInputError("day must be one of MON, TUE, WED, THU, FRI, SAT, SUN.")
        return DAYS.index(d)
    ref = now if now is not None else datetime.now(IST).replace(tzinfo=None)
    return ref.weekday()


def _index_of(route: list[dict], code: str) -> int | None:
    for i, s in enumerate(route):
        if s.get("stationCode") == code:
            return i
    return None


def _dep(stop: dict) -> float | None:
    v = _abs_minutes(stop, "departureTime")
    return v if v is not None else _abs_minutes(stop, "arrivalTime")


def _arr(stop: dict) -> float | None:
    v = _abs_minutes(stop, "arrivalTime")
    return v if v is not None else _abs_minutes(stop, "departureTime")


def _list_arg(value: Any, field: str, lo: int, hi: int) -> list[str]:
    if not isinstance(value, list):
        raise ToolInputError(f"'{field}' must be a list.")
    if not (lo <= len(value) <= hi):
        raise ToolInputError(f"'{field}' needs between {lo} and {hi} items.")
    return [_as_str(v, field, 80) for v in value]


def _earliest(deps: list[float], t: float) -> float:
    """Wait (minutes) from week-time t until the next value in sorted `deps` (cyclic week)."""
    i = bisect_left(deps, t)
    return (deps[i] - t) if i < len(deps) else (deps[0] + WEEK - t)


def _tod(minutes: float) -> str:
    m = int(minutes) % 1440
    return f"{m // 60:02d}:{m % 60:02d}"


# ───────────────────────── one-change journeys ─────────────────────────

@_guard
def find_journeys_with_transfer(db, from_station: str, to_station: str, day: str | None = None,
                                min_layover_minutes: int | None = None,
                                max_layover_minutes: int | None = None,
                                limit: int | None = None, now: datetime | None = None) -> dict:
    """Journeys with exactly ONE change at a station both trains stop at. Only used when
    no direct train is wanted/available. `day` = weekday you leave the origin (default today, India)."""
    a_q, b_q = _as_str(from_station, "from_station", 80), _as_str(to_station, "to_station", 80)
    min_l = _as_int(min_layover_minutes, "min_layover_minutes", 30, 5, 240)
    max_l = _as_int(max_layover_minutes, "max_layover_minutes", 480, 30, 1440)
    if max_l < min_l:
        raise ToolInputError("max_layover_minutes must be at least min_layover_minutes.")
    limit = _as_int(limit, "limit", 5, 1, 10)
    day_idx = _day_index(day, now)

    a, a_others = resolve_station(db, a_q)
    b, b_others = resolve_station(db, b_q)
    if not a or not b:
        return {"found": False, "reason": "station_not_found",
                "message": f"No station matching '{a_q if not a else b_q}' in the database."}
    if a["code"] == b["code"]:
        return {"found": False, "reason": "same_station", "message": "Origin and destination are the same station."}
    A, B = a["code"], b["code"]

    # Trains boarding at B-side index: station C -> options to continue to B
    y_docs = list(db["trains"].find({"completeOrderedRoute.stationCode": B}, _PROJ).limit(MAX_SCAN_TRANSFER))
    index: dict[str, list[dict]] = {}
    for y in y_docs:
        route = _sorted_route(y)
        ib = _index_of(route, B)
        if not ib:                                    # B is the first stop or missing
            continue
        ia_y = _index_of(route, A)
        if ia_y is not None and ia_y < ib:            # runs A -> B directly; not a transfer
            continue
        arr_b = _arr(route[ib])
        runs = _runs(y)
        if arr_b is None or not runs:
            continue
        for j in range(ib):
            stop = route[j]
            dep_c = _dep(stop) if stop.get("departureTime") else None
            code = stop.get("stationCode")
            if dep_c is None or not code or arr_b - dep_c <= 0:
                continue
            deps = sorted({(sy * 1440 + dep_c) % WEEK for sy in runs})
            index.setdefault(code, []).append({
                "doc": y, "stopC": stop, "stopB": route[ib], "deps": deps, "ride": arr_b - dep_c})

    x_docs = list(db["trains"].find({"completeOrderedRoute.stationCode": A}, _PROJ).limit(MAX_SCAN_TRANSFER))
    best: dict[tuple, dict] = {}
    considered = 0
    for x in x_docs:
        route = _sorted_route(x)
        ia = _index_of(route, A)
        if ia is None or ia == len(route) - 1:
            continue
        if _index_of(route[ia + 1:], B) is not None:  # reaches B itself -> direct train covers it
            continue
        dep_a = _dep(route[ia])
        if dep_a is None:
            continue
        start_wd = (day_idx - (_day(route[ia]) - 1)) % 7
        if start_wd not in _runs(x):
            continue
        dep_a_w = day_idx * 1440 + dep_a % 1440
        for k in range(ia + 1, len(route)):
            stop_c = route[k]
            code = stop_c.get("stationCode")
            cands = index.get(code)
            arr_c = _arr(stop_c)
            if not cands or arr_c is None or arr_c <= dep_a:
                continue
            arr_c_w = dep_a_w + (arr_c - dep_a)
            for cand in cands:
                y = cand["doc"]
                if y.get("trainNumber") == x.get("trainNumber"):
                    continue
                considered += 1
                target = arr_c_w + min_l
                wait = _earliest(cand["deps"], target % WEEK)
                layover = min_l + wait
                if layover > max_l:
                    continue
                total = (arr_c_w + layover + cand["ride"]) - dep_a_w
                key = (x["trainNumber"], y["trainNumber"])
                prev = best.get(key)
                if prev is None or total < prev["total"] or (total == prev["total"] and layover > prev["layover"]):
                    best[key] = {"x": x, "y": y, "stop_a": route[ia], "stop_c_x": stop_c, "cand": cand,
                                 "dep_a": dep_a, "arr_c": arr_c, "layover": layover, "total": total,
                                 "dep_a_w": dep_a_w}

    if not best:
        return {"found": False, "reason": "no_transfer_journey",
                "from": _station_brief(a), "to": _station_brief(b), "dayUsed": DAYS[day_idx],
                "message": (f"No one-change journey from {a['name']} to {b['name']} was found in the timetable "
                            f"for a {DAYS[day_idx]} departure with a {min_l}-{max_l} minute layover.")}

    options = []
    for rec in sorted(best.values(), key=lambda r: (r["total"], -r["layover"]))[:limit]:
        x, y, cand = rec["x"], rec["y"], rec["cand"]
        c = rec["stop_c_x"]
        leg1_min = round(rec["arr_c"] - rec["dep_a"])
        leg2_min = round(cand["ride"])
        total = round(rec["total"])
        dep_tod = rec["dep_a"] % 1440
        options.append({
            "totalDurationMinutes": total,
            "totalDuration": fmt_duration(total),
            "departureTime": _tod(dep_tod),
            "arrivalTime": _tod(dep_tod + total),
            "arrivalDayOffset": int((dep_tod + total) // 1440),
            "transfer": {"station": {"code": c.get("stationCode"), "name": c.get("stationName")},
                         "layoverMinutes": round(rec["layover"]), "layover": fmt_duration(round(rec["layover"]))},
            "legs": [
                {"train": {**_summary(x), "runningDaysText": _running_days_text(x.get("runningDays"))},
                 "from": _station_brief(a), "to": {"code": c.get("stationCode"), "name": c.get("stationName")},
                 "departureTime": _hhmm(rec["stop_a"].get("departureTime") or rec["stop_a"].get("arrivalTime")),
                 "arrivalTime": _hhmm(c.get("arrivalTime") or c.get("departureTime")),
                 "durationMinutes": leg1_min, "duration": fmt_duration(leg1_min)},
                {"train": {**_summary(y), "runningDaysText": _running_days_text(y.get("runningDays"))},
                 "from": {"code": c.get("stationCode"), "name": c.get("stationName")}, "to": _station_brief(b),
                 "departureTime": _hhmm(cand["stopC"].get("departureTime")),
                 "arrivalTime": _hhmm(cand["stopB"].get("arrivalTime") or cand["stopB"].get("departureTime")),
                 "durationMinutes": leg2_min, "duration": fmt_duration(leg2_min)},
            ],
        })
    return {
        "found": True, "from": _station_brief(a), "to": _station_brief(b), "dayUsed": DAYS[day_idx],
        "layoverRangeMinutes": [min_l, max_l], "optionsFound": len(best), "returned": len(options),
        "candidatesConsidered": considered,
        "scanTruncated": len(x_docs) >= MAX_SCAN_TRANSFER or len(y_docs) >= MAX_SCAN_TRANSFER,
        "options": options,
        "resolution": [_resolution_note(a_q, a, a_others), _resolution_note(b_q, b, b_others)],
        "note": ("One change at the same station only. Times are the printed timetable; connections can be missed "
                 "if the first train runs late, and running days are respected for the day shown."),
    }


# ───────────────────────── reachability / discovery ─────────────────────────

@_guard
def find_reachable_stations(db, from_station: str, max_hours: int | None = None, min_hours: int | None = None,
                            day: str | None = None, limit: int | None = None) -> dict:
    """Stations reachable by a DIRECT train from a station within a time window (scheduled)."""
    q = _as_str(from_station, "from_station", 80)
    max_h = _as_int(max_hours, "max_hours", 6, 1, 48)
    min_h = _as_int(min_hours, "min_hours", 0, 0, 47)
    if min_h >= max_h:
        raise ToolInputError("min_hours must be smaller than max_hours.")
    limit = _as_int(limit, "limit", 40, 1, 80)
    day_idx = None
    if day is not None:
        day_idx = _day_index(day, None)

    origin, others = resolve_station(db, q)
    if not origin:
        return {"found": False, "message": f"No station matching '{q}' in the database."}
    A = origin["code"]
    best: dict[str, dict] = {}
    scanned = list(db["trains"].find({"completeOrderedRoute.stationCode": A}, _PROJ).limit(MAX_SCAN))
    for x in scanned:
        route = _sorted_route(x)
        ia = _index_of(route, A)
        if ia is None:
            continue
        dep_a = _dep(route[ia])
        if dep_a is None:
            continue
        if day_idx is not None and isinstance(x.get("runningDays"), dict):
            if (day_idx - (_day(route[ia]) - 1)) % 7 not in _runs(x):
                continue
        for stop in route[ia + 1:]:
            code, arr = stop.get("stationCode"), _arr(stop)
            if not code or code == A or arr is None:
                continue
            dur = arr - dep_a
            if dur <= 0 or dur > max_h * 60 or dur < min_h * 60:
                continue
            cur = best.get(code)
            if cur is None or dur < cur["durationMinutes"]:
                da, db_ = route[ia].get("distance"), stop.get("distance")
                km = round(db_ - da, 1) if isinstance(da, (int, float)) and isinstance(db_, (int, float)) and db_ >= da else None
                best[code] = {"code": code, "name": stop.get("stationName"), "durationMinutes": round(dur),
                              "duration": fmt_duration(round(dur)), "distanceKm": km,
                              "viaTrain": {"trainNumber": x.get("trainNumber"), "trainName": x.get("trainName")}}
    if not best:
        return {"found": False, "from": _station_brief(origin),
                "message": f"No station is reachable from {origin['name']} by a direct train in {min_h}-{max_h} hours."}

    ranked = sorted(best.values(), key=lambda s: s["durationMinutes"])[:limit]
    docs = {d["code"]: d for d in db["stations"].find(
        {"code": {"$in": [s["code"] for s in ranked] + [A]}}, {"_id": 0, "code": 1, "state": 1, "zone": 1, "coordinates": 1})}
    for s in ranked:
        d = docs.get(s["code"]) or {}
        s["state"] = d.get("state") or None
        s["coordinates"] = valid_coordinates(d.get("coordinates"))
    o = _station_brief(origin)
    o["coordinates"] = valid_coordinates((docs.get(A) or {}).get("coordinates"))
    return {
        "found": True, "origin": o, "minHours": min_h, "maxHours": max_h, "dayFilter": DAYS[day_idx] if day_idx is not None else None,
        "reachableCount": len(best), "returned": len(ranked), "scanTruncated": len(scanned) >= MAX_SCAN,
        "withoutCoordinates": sum(1 for s in ranked if s["coordinates"] is None),
        "stations": ranked,
        "resolution": _resolution_note(q, origin, others),
        "note": "Direct trains only, scheduled times; the shortest scheduled time to each station is shown.",
    }


# ───────────────────────── compare trains / halts ─────────────────────────

def _train_stats(doc: dict) -> dict:
    route = _sorted_route(doc)
    s = _summary(doc)
    s["runningDaysText"] = _running_days_text(doc.get("runningDays"))
    s["stopCount"] = len(route)
    if route:
        first, last = route[0], route[-1]
        a, b = _dep(first), _arr(last)
        s["departsSource"], s["arrivesDestination"] = _hhmm(first.get("departureTime")), _hhmm(last.get("arrivalTime"))
        if a is not None and b is not None and b > a:
            mins = round(b - a)
            s["scheduledDurationMinutes"], s["scheduledDuration"] = mins, fmt_duration(mins)
            km = doc.get("overallDistanceKm")
            if isinstance(km, (int, float)) and km > 0:
                s["averageSpeedKmph"] = round(km / (mins / 60), 1)
    halts = []
    for st in route[1:-1]:
        ma, md = _to_minutes(st.get("arrivalTime")), _to_minutes(st.get("departureTime"))
        if ma is not None and md is not None:
            halts.append((round(md - ma if md >= ma else md + 1440 - ma), st))
    if halts:
        h, st = max(halts, key=lambda t: t[0])
        s["longestHalt"] = {"minutes": h, "stationCode": st.get("stationCode"), "stationName": st.get("stationName")}
    return s


@_guard
def compare_trains(db, train_numbers: list) -> dict:
    """Side-by-side facts for 2-4 trains: duration, stops, distance, speed, longest halt, running days."""
    nums = []
    for n in _list_arg(train_numbers, "train_numbers", 2, 4):
        n = _train_number(n)
        if n not in nums:
            nums.append(n)
    if len(nums) < 2:
        raise ToolInputError("Give at least two different train numbers.")
    found, missing = [], []
    for n in nums:
        doc = db["trains"].find_one({"trainNumber": n}, {"_id": 0, **{k: 1 for k in TRAIN_SUMMARY_PROJ if k != "_id"}, "completeOrderedRoute": 1})
        (found if doc else missing).append(_train_stats(doc) if doc else n)
    if len(found) < 2:
        return {"found": False, "notFound": missing,
                "message": "Need at least two of the trains to exist in the database to compare them."}
    timed = [t for t in found if t.get("scheduledDurationMinutes")]
    out = {"found": True, "trains": found, "notFound": missing}
    if timed:
        out["shortestScheduled"] = min(timed, key=lambda t: t["scheduledDurationMinutes"])["trainNumber"]
    speeds = [t for t in found if t.get("averageSpeedKmph")]
    if speeds:
        out["highestAverageSpeed"] = max(speeds, key=lambda t: t["averageSpeedKmph"])["trainNumber"]
    out["fewestStops"] = min(found, key=lambda t: t["stopCount"])["trainNumber"]
    out["note"] = "Average speed is stored distance divided by scheduled time (halts included); it is not a measured speed."
    return out


@_guard
def get_train_halts(db, train_number: str, min_minutes: int | None = None) -> dict:
    """Longest scheduled halts of a train (stops where arrival and departure both exist)."""
    num = _train_number(train_number)
    min_m = _as_int(min_minutes, "min_minutes", 10, 1, 240)
    doc = db["trains"].find_one({"trainNumber": num}, {"_id": 0, **{k: 1 for k in TRAIN_SUMMARY_PROJ if k != "_id"}, "completeOrderedRoute": 1})
    if not doc:
        return {"found": False, "message": f"Train {num} is not in the database."}
    rows = []
    for st in _sorted_route(doc)[1:-1]:
        ma, md = _to_minutes(st.get("arrivalTime")), _to_minutes(st.get("departureTime"))
        if ma is None or md is None:
            continue
        halt = round(md - ma if md >= ma else md + 1440 - ma)
        if halt >= min_m:
            rows.append({"sequence": st.get("sequence"), "stationCode": st.get("stationCode"),
                         "stationName": st.get("stationName"), "arrivalTime": _hhmm(st.get("arrivalTime")),
                         "departureTime": _hhmm(st.get("departureTime")), "haltMinutes": halt})
    rows.sort(key=lambda r: -r["haltMinutes"])
    if not rows:
        return {"found": False, "train": _summary(doc), "message": f"Train {num} has no stored halt of {min_m} minutes or more."}
    return {"found": True, "train": _summary(doc), "minMinutes": min_m, "totalLongHalts": len(rows),
            "halts": rows[:15], "longestHalt": rows[0]}


# ───────────────────────── multi-stop trip planner ─────────────────────────

def _direct_candidates(db, a_code: str, b_code: str) -> list[dict]:
    out = []
    flt = {"completeOrderedRoute.stationCode": {"$all": [a_code, b_code]}}
    for d in db["trains"].find(flt, _PROJ).limit(MAX_SCAN):
        route = _sorted_route(d)
        ia, ib = _index_of(route, a_code), _index_of(route, b_code)
        if ia is None or ib is None or ia >= ib:
            continue
        dep_a, arr_b = _dep(route[ia]), _arr(route[ib])
        runs = _runs(d)
        if dep_a is None or arr_b is None or arr_b <= dep_a or not runs:
            continue
        out.append({"doc": d, "stopA": route[ia], "stopB": route[ib], "dep_a": dep_a, "ride": arr_b - dep_a,
                    "deps": sorted({(sy * 1440 + dep_a) % WEEK for sy in runs})})
    return out


@_guard
def plan_trip(db, stops: list, day: str | None = None, start_time: str | None = None,
              min_stay_hours: int | None = None, now: datetime | None = None) -> dict:
    """Chain DIRECT trains through 2-5 stations in order, leaving each place after a minimum stay.
    Greedy: each leg takes the train that arrives earliest after you are ready to leave."""
    names = _list_arg(stops, "stops", 2, 5)
    stay = _as_int(min_stay_hours, "min_stay_hours", 3, 0, 72)
    day_idx = _day_index(day, now)
    st = 0.0 if start_time is None else _to_minutes(_as_str(start_time, "start_time", 8))
    if st is None:
        raise ToolInputError("start_time must look like 08:00.")

    resolved = []
    for q in names:
        best, others = resolve_station(db, q)
        if not best:
            return {"found": False, "reason": "station_not_found", "message": f"No station matching '{q}' in the database."}
        resolved.append((best, others, q))
    for (x, _, _), (y, _, _) in zip(resolved, resolved[1:]):
        if x["code"] == y["code"]:
            raise ToolInputError("Consecutive stops must be different stations.")

    base_w = day_idx * 1440
    ready_w = base_w + st
    legs = []
    for (a, _, _), (b, _, _) in zip(resolved, resolved[1:]):
        cands = _direct_candidates(db, a["code"], b["code"])
        choice = None
        for c in cands:
            wait = _earliest(c["deps"], ready_w % WEEK)
            dep_w = ready_w + wait
            arr_w = dep_w + c["ride"]
            if choice is None or arr_w < choice[0]:
                choice = (arr_w, dep_w, c)
        if choice is None:
            return {"found": False, "reason": "no_direct_leg", "legsPlanned": legs,
                    "failedLeg": {"from": _station_brief(a), "to": _station_brief(b)},
                    "message": (f"No direct train from {a['name']} to {b['name']} was found, so the trip cannot be chained. "
                                "Ask for a one-change journey for that leg.")}
        arr_w, dep_w, c = choice
        legs.append({
            "from": _station_brief(a), "to": _station_brief(b),
            "train": {"trainNumber": c["doc"].get("trainNumber"), "trainName": c["doc"].get("trainName"),
                      "runningDaysText": _running_days_text(c["doc"].get("runningDays"))},
            "tripDay": int((dep_w - base_w) // 1440) + 1,
            "departureTime": _tod(dep_w), "arrivalTime": _tod(arr_w),
            "arrivalTripDay": int((arr_w - base_w) // 1440) + 1,
            "rideMinutes": round(c["ride"]), "ride": fmt_duration(round(c["ride"])),
            "waitBeforeMinutes": round(dep_w - ready_w), "wait": fmt_duration(round(dep_w - ready_w)),
        })
        ready_w = arr_w + stay * 60

    first_dep = legs[0]["waitBeforeMinutes"]
    total = round((ready_w - stay * 60) - (base_w + st) - first_dep)
    return {"found": True, "stops": [_station_brief(r[0]) for r in resolved], "startDay": DAYS[day_idx],
            "minStayHours": stay, "legs": legs, "totalTravelSpanMinutes": total, "totalTravelSpan": fmt_duration(total),
            "resolution": [_resolution_note(q, b, o) for b, o, q in resolved],
            "note": ("Direct trains only; each leg takes the train arriving earliest after your minimum stay. "
                     "Scheduled times, not live status. Check running days before you travel.")}


# ───────────────────────── registry entries (merged by railway_tools) ─────────────────────────

_STR = {"type": "string"}
TOOL_SPECS: dict[str, dict] = {
    "find_journeys_with_transfer": {
        "fn": find_journeys_with_transfer,
        "description": "Journeys with exactly ONE change between two stations (no direct train needed). Use when the user asks for connecting options, or when find_trains_between_stations found no direct train. day = weekday of leaving the origin.",
        "parameters": {"type": "object", "properties": {
            "from_station": {**_STR, "description": "Origin station name or code."},
            "to_station": {**_STR, "description": "Destination station name or code."},
            "day": {**_STR, "description": "Weekday of departure MON..SUN (default today)."},
            "min_layover_minutes": {"type": "integer", "description": "Minimum change time (default 30)."},
            "max_layover_minutes": {"type": "integer", "description": "Maximum wait at the change station (default 480)."},
            "limit": {"type": "integer"}}, "required": ["from_station", "to_station"]},
    },
    "find_reachable_stations": {
        "fn": find_reachable_stations,
        "description": "Stations reachable from a station by a direct train within a time window (scheduled). Use for 'where can I go in 6 hours', weekend-trip ideas, discovery. Results also appear on the map.",
        "parameters": {"type": "object", "properties": {
            "from_station": {**_STR, "description": "Starting station name or code."},
            "max_hours": {"type": "integer", "description": "Longest scheduled travel time in hours (default 6)."},
            "min_hours": {"type": "integer", "description": "Shortest travel time in hours (default 0); use e.g. 3 to skip very near places."},
            "day": {**_STR, "description": "Optional weekday of departure MON..SUN."},
            "limit": {"type": "integer"}}, "required": ["from_station"]},
    },
    "compare_trains": {
        "fn": compare_trains,
        "description": "Compare 2-4 trains side by side: scheduled duration, stops, distance, average speed, longest halt, running days.",
        "parameters": {"type": "object", "properties": {
            "train_numbers": {"type": "array", "items": {"type": "string"}, "description": "2 to 4 train numbers."}},
            "required": ["train_numbers"]},
    },
    "get_train_halts": {
        "fn": get_train_halts,
        "description": "A train's longest scheduled halts (stops with arrival and departure times), e.g. for 'where does it stop longest'.",
        "parameters": {"type": "object", "properties": {
            "train_number": {**_STR, "description": "Train number, 3-6 digits."},
            "min_minutes": {"type": "integer", "description": "Only halts of at least this many minutes (default 10)."}},
            "required": ["train_number"]},
    },
    "plan_trip": {
        "fn": plan_trip,
        "description": "Plan a multi-stop trip (2-5 stations in order) by chaining DIRECT trains, waiting at least min_stay_hours at each place. Use for 'Raipur to Nagpur then Mumbai, one day in Nagpur'.",
        "parameters": {"type": "object", "properties": {
            "stops": {"type": "array", "items": {"type": "string"}, "description": "Station names or codes in travel order."},
            "day": {**_STR, "description": "Weekday the trip starts MON..SUN (default today)."},
            "start_time": {**_STR, "description": "Earliest time to leave the first station, HH:MM (default 00:00)."},
            "min_stay_hours": {"type": "integer", "description": "Minimum hours at each intermediate place (default 3)."}},
            "required": ["stops"]},
    },
}
