"""
demo_tools.py — DEMO features. Everything returned here is SIMULATED.

Real PNR status, fares, seat availability, live running status and food ordering all need
approved access to IRCTC / Indian Railways systems or licensed data providers, which this
project does not have. So each of these is built as a clearly-labelled demonstration:

  * Train, station and timetable facts still come from the real MongoDB data.
  * Everything else (passengers, booking status, fares, seat counts, delays, menus,
    orders) is generated deterministically from the inputs, so the same input always
    gives the same demo output — and it is NEVER presented as real.
  * Every result carries isDemo=True and a demoNotice. The AI must say it is a demo.
  * Nothing is written to the database. Demo food orders are not stored server-side.
"""
from __future__ import annotations

import hashlib
import re
from datetime import datetime, timedelta
from typing import Any

from . import railway_tools as rt
from .railway_tools import (
    DAYS, IST, TRAIN_SUMMARY_PROJ, ToolInputError, _as_int, _as_str, _guard, _hhmm, _sorted_route,
    _station_brief, _summary, _to_minutes, _train_number, resolve_station,
)

DEMO_NOTICE = ("DEMO: simulated data for demonstration only. It is not real booking, fare, availability, "
               "running-status or order information.")
_PROJ_ROUTE = {**TRAIN_SUMMARY_PROJ, "completeOrderedRoute": 1}


def _seed(*parts: Any) -> int:
    """Stable integer from the inputs (Python's hash() changes between runs; sha256 does not)."""
    h = hashlib.sha256("|".join(str(p) for p in parts).encode("utf-8")).hexdigest()
    return int(h[:12], 16)


def _today(now: datetime | None) -> datetime:
    ref = now if now is not None else datetime.now(IST).replace(tzinfo=None)
    return ref.replace(hour=0, minute=0, second=0, microsecond=0)


def _demo(payload: dict) -> dict:
    payload["isDemo"] = True
    payload["demoNotice"] = DEMO_NOTICE
    return payload


# ───────────────────────── PNR finder (demo) ─────────────────────────

CLASSES = ["SL", "3A", "2A", "1A", "CC", "2S"]


@_guard
def demo_pnr_lookup(db, pnr: str, now: datetime | None = None) -> dict:
    """DEMO PNR finder. A real PNR lookup needs an approved IRCTC connection. Here the 10 digits
    are used as a seed to pick a real train from the database and invent the booking details."""
    p = _as_str(pnr, "pnr", 16)
    if not re.fullmatch(r"[0-9]{10}", p):
        raise ToolInputError("A PNR is exactly 10 digits.")
    total = db["trains"].count_documents({})
    if not total:
        return {"found": False, "message": "No trains are available in the database."}

    seed = _seed("pnr", p)
    doc = None
    for attempt in range(12):                       # find a train with enough stops
        idx = (seed + attempt * 7919) % total
        rows = list(db["trains"].find({}, _PROJ_ROUTE).skip(idx).limit(1))
        if rows and len(_sorted_route(rows[0])) >= 4:
            doc = rows[0]
            break
    if doc is None:
        return {"found": False, "message": "Could not build a demo booking from the available data."}

    route = _sorted_route(doc)
    n = len(route)
    i = _seed("from", p) % (n - 2)
    j = i + 2 + (_seed("to", p) % (n - i - 2))
    start, end = route[i], route[j]
    travel_date = _today(now) + timedelta(days=1 + _seed("date", p) % 20)
    klass = CLASSES[_seed("class", p) % len(CLASSES)]

    passengers = []
    for k in range(1 + _seed("pax", p) % 3):
        r = _seed("status", p, k) % 10
        if r < 6:
            coach = f"{'S' if klass == 'SL' else 'B' if klass == '3A' else 'A' if klass in ('2A', '1A') else 'C'}{1 + _seed('coach', p, k) % 9}"
            berth = 1 + _seed("berth", p, k) % 72
            current = f"CNF  {coach}/{berth}"
        elif r < 8:
            current = f"RAC  {1 + _seed('rac', p, k) % 30}"
        else:
            current = f"WL  {1 + _seed('wl', p, k) % 40}"
        passengers.append({"number": k + 1, "name": f"DEMO PASSENGER {k + 1}", "currentStatus": current})

    return _demo({
        "found": True,
        "pnr": p,
        "train": _summary(doc),
        "journey": {
            "boarding": {"code": start.get("stationCode"), "name": start.get("stationName"),
                         "departureTime": _hhmm(start.get("departureTime") or start.get("arrivalTime"))},
            "destination": {"code": end.get("stationCode"), "name": end.get("stationName"),
                            "arrivalTime": _hhmm(end.get("arrivalTime") or end.get("departureTime"))},
            "date": travel_date.strftime("%Y-%m-%d"),
            "class": klass,
        },
        "passengers": passengers,
        "chartStatus": "Chart not prepared (demo)",
        "howItWorks": ("The train and stations are real records picked from the database using the PNR digits as a seed; "
                       "the passenger and status details are invented. A real PNR lookup is not connected."),
    })


# ───────────────────────── fares and seats (demo) ─────────────────────────

# Invented illustrative rates (INR per km), NOT railway tariffs.
_DEMO_RATE = {"2S": 0.40, "SL": 0.60, "3E": 1.30, "3A": 1.60, "CC": 1.55, "2A": 2.35, "1A": 3.90}
_DEMO_RESERVATION = {"2S": 15, "SL": 20, "3E": 40, "3A": 40, "CC": 40, "2A": 50, "1A": 60}
_AC = {"3E", "3A", "CC", "2A", "1A"}


def _class_arg(value: Any) -> str | None:
    if value is None:
        return None
    c = _as_str(value, "travel_class", 4).upper()
    if c not in _DEMO_RATE:
        raise ToolInputError("travel_class must be one of " + ", ".join(_DEMO_RATE) + ".")
    return c


def _segment(db, train_number: str, from_station: str, to_station: str):
    """(doc, stopA, stopB) if both stations are on the train's route in that order, else an error dict."""
    num = _train_number(train_number)
    doc = db["trains"].find_one({"trainNumber": num}, {"_id": 0, **{k: 1 for k in TRAIN_SUMMARY_PROJ if k != "_id"}, "completeOrderedRoute": 1})
    if not doc:
        return None, None, {"found": False, "message": f"Train {num} is not in the database."}
    route = _sorted_route(doc)
    found = []
    for q in (from_station, to_station):
        q = _as_str(q, "station", 80)
        best, _ = resolve_station(db, q)
        stop = next((s for s in route if best and s.get("stationCode") == best["code"]), None)
        if not best or stop is None:
            return None, None, {"found": False, "message": f"'{q}' is not a stop on train {num}'s stored route."}
        found.append(stop)
    if (found[0].get("sequence") or 0) >= (found[1].get("sequence") or 0):
        return None, None, {"found": False, "message": "The destination must come after the origin on this train's route."}
    return doc, found[0], found[1]


@_guard
def demo_fare_estimate(db, train_number: str, from_station: str, to_station: str,
                       travel_class: str | None = None) -> dict:
    """DEMO fare. Distance is real (from the stored route); the rates are invented, not IRCTC fares."""
    doc, a, b = _segment(db, train_number, from_station, to_station)
    if doc is None:
        return b
    klass = _class_arg(travel_class)
    da, dbb = a.get("distance"), b.get("distance")
    if not (isinstance(da, (int, float)) and isinstance(dbb, (int, float)) and dbb > da):
        return {"found": False, "message": "Stored distances for these stops are missing, so even a demo fare cannot be estimated."}
    km = round(dbb - da, 1)
    sf = 30 if re.search(r"SF|SUPERFAST|RAJ|SHATABDI|DURONTO|VANDE", f"{doc.get('type','')} {doc.get('trainName','')}", re.I) else 0
    rows = []
    for c in ([klass] if klass else list(_DEMO_RATE)):
        base = round(km * _DEMO_RATE[c])
        extra = _DEMO_RESERVATION[c] + sf
        gst = round((base + extra) * 0.05) if c in _AC else 0
        rows.append({"class": c, "baseFare": base, "reservationAndOther": extra, "tax": gst, "total": base + extra + gst})
    return _demo({"found": True, "train": _summary(doc), "from": {"code": a.get("stationCode"), "name": a.get("stationName")},
                  "to": {"code": b.get("stationCode"), "name": b.get("stationName")}, "distanceKm": km,
                  "currency": "INR", "fares": rows,
                  "howItWorks": "Distance is real; the per-km rates and fees are invented for the demo. This is not an IRCTC fare."})


@_guard
def demo_seat_availability(db, train_number: str, date: str, travel_class: str | None = None,
                           now: datetime | None = None) -> dict:
    """DEMO seats. Whether the train runs that weekday is real data; the seat counts are invented."""
    num = _train_number(train_number)
    try:
        d = datetime.strptime(_as_str(date, "date", 10), "%Y-%m-%d")
    except ValueError:
        raise ToolInputError("date must look like 2026-11-20.")
    today = _today(now)
    if d < today or d > today + timedelta(days=120):
        raise ToolInputError("date must be between today and 120 days ahead.")
    klass = _class_arg(travel_class)
    doc = db["trains"].find_one({"trainNumber": num}, {"_id": 0, **{k: 1 for k in TRAIN_SUMMARY_PROJ if k != "_id"}})
    if not doc:
        return {"found": False, "message": f"Train {num} is not in the database."}
    rd = doc.get("runningDays")
    runs = bool(rd.get(DAYS[d.weekday()])) if isinstance(rd, dict) else None
    out = {"found": True, "train": _summary(doc), "date": d.strftime("%Y-%m-%d"), "weekday": DAYS[d.weekday()],
           "runsOnThisWeekday": runs}
    if runs is False:
        out["classes"] = []
        out["message"] = f"According to the stored running days, train {num} does not start a run on {DAYS[d.weekday()]}."
        return _demo(out)
    rows = []
    for c in ([klass] if klass else list(_DEMO_RATE)):
        r = _seed("seat", num, d.strftime("%Y-%m-%d"), c) % 10
        if r < 5:
            status = f"AVAILABLE {1 + _seed('av', num, d, c) % 120}"
        elif r < 8:
            status = f"RAC {1 + _seed('rac', num, d, c) % 25}"
        elif r < 9:
            status = f"WL {1 + _seed('wl', num, d, c) % 60}"
        else:
            status = "REGRET (demo)"
        rows.append({"class": c, "status": status})
    out["classes"] = rows
    out["howItWorks"] = "Whether the train runs that weekday is from the stored running days; the seat counts are invented."
    return _demo(out)


# ───────────────────────── simulated live status (demo) ─────────────────────────

@_guard
def demo_live_status(db, train_number: str, now: datetime | None = None) -> dict:
    """DEMO running status. Position comes from the real timetable estimator; the delay is SIMULATED."""
    base = rt.get_scheduled_position(db, train_number, now=now)
    if not base.get("found"):
        return base
    when = base["estimatedForIST"]
    delay = _seed("delay", base["train"]["trainNumber"], when[:10]) % 46          # 0-45 simulated minutes
    inst = (base.get("instances") or [None])[0]
    out = {"found": True, "train": base["train"], "estimatedForIST": when, "simulatedDelayMinutes": delay,
           "status": base["status"], "message": base["message"]}
    if base["status"] == "in_progress_per_schedule" and inst and inst.get("estimatedBetween"):
        eb = inst["estimatedBetween"]
        nxt = eb["nextScheduledStop"]
        m = _to_minutes(nxt.get("scheduledArrival"))
        shifted = None
        if m is not None:
            t = int(m + delay) % 1440
            shifted = f"{t // 60:02d}:{t % 60:02d}"
        out["position"] = {"lastScheduledStop": eb["lastScheduledStop"], "nextScheduledStop": nxt,
                           "demoExpectedArrivalAtNext": shifted}
    out["howItWorks"] = ("The route position uses the real timetable estimator; the delay is a made-up number. "
                         "Real running status needs an approved live-data provider.")
    return _demo(out)


# ───────────────────────── food (demo) ─────────────────────────

_CATALOG = [
    ("D01", "Veg Thali", True, 140, "Meals"), ("D02", "Egg Curry Rice", False, 150, "Meals"),
    ("D03", "Chicken Biryani", False, 190, "Meals"), ("D04", "Paneer Roll", True, 90, "Snacks"),
    ("D05", "Veg Sandwich", True, 60, "Snacks"), ("D06", "Samosa (2 pc)", True, 30, "Snacks"),
    ("D07", "Masala Dosa", True, 80, "South Indian"), ("D08", "Idli Sambar", True, 60, "South Indian"),
    ("D09", "Poha", True, 45, "Breakfast"), ("D10", "Omelette Bread", False, 55, "Breakfast"),
    ("D11", "Masala Chai", True, 15, "Drinks"), ("D12", "Filter Coffee", True, 25, "Drinks"),
    ("D13", "Packaged Water 1L", True, 20, "Drinks"), ("D14", "Fruit Cup", True, 50, "Snacks"),
    ("D15", "Dal Khichdi", True, 90, "Meals"), ("D16", "Chole Bhature", True, 100, "Meals"),
]
_BY_ID = {c[0]: c for c in _CATALOG}
MAX_ORDER_ITEMS = 10
MAX_QTY = 5


def _menu_for(code: str) -> list[dict]:
    order = sorted(_CATALOG, key=lambda c: _seed("menu", code, c[0]))
    chosen = order[:10]
    always = [c for c in _CATALOG if c[0] in ("D11", "D13")]
    items = {c[0]: c for c in chosen + always}
    return [{"id": c[0], "name": c[1], "veg": c[2], "price": c[3], "category": c[4]}
            for c in sorted(items.values(), key=lambda c: c[0])]


@_guard
def demo_food_menu(db, station: str) -> dict:
    """DEMO food menu for a station. The station is real; vendors, items and prices are invented."""
    q = _as_str(station, "station", 80)
    best, others = resolve_station(db, q)
    if not best:
        return {"found": False, "message": f"No station matching '{q}' in the database."}
    code = best["code"]
    return _demo({"found": True, "station": _station_brief(best), "currency": "INR",
                  "vendor": {"name": f"Demo Kitchen ({best.get('name')})", "ratingDemo": round(3.6 + (_seed('rate', code) % 13) / 10, 1)},
                  "items": _menu_for(code),
                  "otherMatches": [_station_brief(o) for o in others[:3]],
                  "howItWorks": "The station is real; the vendor, menu and prices are invented. No order is placed with anyone."})


@_guard
def demo_place_order(db, train_number: str, station: str, items: list, now: datetime | None = None) -> dict:
    """DEMO order. Validates against the real route and the demo menu, then returns an invented order.
    Nothing is stored or sent anywhere. (Used by the Services page, not by the AI.)"""
    num = _train_number(train_number)
    q = _as_str(station, "station", 80)
    doc = db["trains"].find_one({"trainNumber": num}, {"_id": 0, **{k: 1 for k in TRAIN_SUMMARY_PROJ if k != "_id"}, "completeOrderedRoute": 1})
    if not doc:
        return {"found": False, "message": f"Train {num} is not in the database."}
    best, _ = resolve_station(db, q)
    if not best:
        return {"found": False, "message": f"No station matching '{q}' in the database."}
    stop = next((s for s in _sorted_route(doc) if s.get("stationCode") == best["code"]), None)
    if stop is None:
        return {"found": False, "message": f"Train {num} does not stop at {best['name']} in the stored route."}
    if not isinstance(items, list) or not (1 <= len(items) <= MAX_ORDER_ITEMS):
        raise ToolInputError(f"An order needs 1 to {MAX_ORDER_ITEMS} items.")
    menu = {m["id"]: m for m in _menu_for(best["code"])}
    lines, total, seen = [], 0, set()
    for it in items:
        if not isinstance(it, dict) or set(it) - {"id", "qty"}:
            raise ToolInputError("Each item must be {id, qty}.")
        iid, qty = it.get("id"), it.get("qty")
        if iid not in menu or iid in seen:
            raise ToolInputError("Unknown or repeated menu item.")
        if isinstance(qty, bool) or not isinstance(qty, int) or not (1 <= qty <= MAX_QTY):
            raise ToolInputError(f"Quantity must be 1 to {MAX_QTY}.")
        seen.add(iid)
        m = menu[iid]
        lines.append({"id": iid, "name": m["name"], "qty": qty, "price": m["price"], "lineTotal": m["price"] * qty})
        total += m["price"] * qty
    placed = _today(now)
    oid = "DEMO-" + format(_seed("order", num, best["code"], sorted(seen), placed.strftime("%Y%m%d")) % 10**8, "08d")
    return _demo({"found": True, "orderId": oid, "train": _summary(doc), "station": _station_brief(best),
                  "scheduledArrivalAtStation": _hhmm(stop.get("arrivalTime") or stop.get("departureTime")),
                  "items": lines, "total": total, "currency": "INR",
                  "paymentNote": "DEMO: no payment is taken and no vendor receives this order.",
                  "stages": ["Order received (demo)", "Being prepared (demo)", "Out for delivery (demo)", "Delivered at your seat (demo)"]})


# ───────────────────────── registry entries ─────────────────────────

_STR = {"type": "string"}
TOOL_SPECS: dict[str, dict] = {
    "demo_pnr_lookup": {
        "fn": demo_pnr_lookup,
        "description": "DEMO ONLY. Simulated PNR finder: given a 10-digit PNR, returns an invented booking tied to a real train from the database. Real PNR status is NOT connected. Always tell the user it is a demo.",
        "parameters": {"type": "object", "properties": {"pnr": {**_STR, "description": "10-digit PNR."}}, "required": ["pnr"]},
    },
    "demo_fare_estimate": {
        "fn": demo_fare_estimate,
        "description": "DEMO ONLY. Illustrative fare between two stops of a train (real distance, invented rates). Not an IRCTC fare. Always say it is a demo.",
        "parameters": {"type": "object", "properties": {
            "train_number": {**_STR, "description": "Train number."},
            "from_station": {**_STR, "description": "Boarding station name or code (must be on the route)."},
            "to_station": {**_STR, "description": "Destination station name or code (must be on the route, later than boarding)."},
            "travel_class": {**_STR, "description": "Optional: 2S, SL, 3E, 3A, CC, 2A, 1A."}},
            "required": ["train_number", "from_station", "to_station"]},
    },
    "demo_seat_availability": {
        "fn": demo_seat_availability,
        "description": "DEMO ONLY. Simulated seat availability for a train on a date (running-day check is real, seat counts are invented). Always say it is a demo.",
        "parameters": {"type": "object", "properties": {
            "train_number": {**_STR, "description": "Train number."},
            "date": {**_STR, "description": "Travel date YYYY-MM-DD (today to 120 days ahead)."},
            "travel_class": {**_STR, "description": "Optional class code."}}, "required": ["train_number", "date"]},
    },
    "demo_live_status": {
        "fn": demo_live_status,
        "description": "DEMO ONLY. Simulated running status: timetable position plus a made-up delay. Real live status is NOT connected. Always say it is a demo simulation.",
        "parameters": {"type": "object", "properties": {"train_number": {**_STR, "description": "Train number."}}, "required": ["train_number"]},
    },
    "demo_food_menu": {
        "fn": demo_food_menu,
        "description": "DEMO ONLY. Demo food menu for a station (invented vendor, items, prices). Ordering happens on the Services page. Always say it is a demo.",
        "parameters": {"type": "object", "properties": {"station": {**_STR, "description": "Station name or code."}}, "required": ["station"]},
    },
}
