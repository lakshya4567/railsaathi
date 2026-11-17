"""
data_quality.py — read-only checks that find suspicious records in the railway data.

Pure functions: they take plain dicts (already fetched) and return issue lists, so they can be
tested offline and never touch the database themselves. Issues are hints for a human to review
(for example a train with 294 stops and no times), not automatic fixes.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Iterable

from .railway_tools import _abs_minutes, _day, _sorted_route, valid_coordinates

LONG_ROUTE_STOPS = 150
NO_COORD_RATIO = 0.25

SEVERITY = {
    "no_route": "error", "single_stop_route": "error", "endpoint_mismatch": "error", "all_times_missing": "error",
    "time_goes_backwards": "error", "distance_goes_backwards": "error",
    "sequence_not_contiguous": "warn", "duplicate_station_in_route": "warn", "many_stops_without_times": "warn",
    "all_distances_zero": "warn", "very_long_route": "warn", "running_days_missing": "warn",
    "running_days_never": "warn", "many_stops_without_coordinates": "info", "missing_distances": "info",
}


def analyze_train(doc: dict, coords: dict[str, bool] | None = None) -> list[dict]:
    """Issues for one train. `coords` maps station code -> has usable coordinates (optional)."""
    issues: list[dict] = []

    def add(kind: str, detail: str):
        issues.append({"kind": kind, "severity": SEVERITY[kind], "detail": detail})

    route = _sorted_route(doc)
    if not route:
        add("no_route", "completeOrderedRoute is empty")
        return issues
    if len(route) == 1:
        add("single_stop_route", "only one stop stored")
    n = len(route)

    seqs = [s.get("sequence") for s in route]
    if any(not isinstance(q, int) for q in seqs) or seqs != list(range(seqs[0], seqs[0] + n)):
        add("sequence_not_contiguous", "stop sequence numbers have gaps, repeats or are missing")

    codes = [s.get("stationCode") for s in route]
    dup = [c for c, k in Counter(codes).items() if c and k > 1]
    if dup:
        add("duplicate_station_in_route", "stations repeated: " + ", ".join(dup[:5]))

    src, dst = (doc.get("source") or {}).get("code"), (doc.get("destination") or {}).get("code")
    if (src and codes[0] != src) or (dst and codes[-1] != dst):
        add("endpoint_mismatch", f"route runs {codes[0]} to {codes[-1]} but record says {src} to {dst}")

    timeless = sum(1 for s in route if not s.get("arrivalTime") and not s.get("departureTime"))
    if n > 2 and timeless == n:
        add("all_times_missing", f"none of the {n} stops has an arrival or departure time")
    elif n > 2 and timeless / n > 0.3:
        add("many_stops_without_times", f"{timeless} of {n} stops have no times")

    prev, backwards = None, 0
    for s in route:
        for field in ("arrivalTime", "departureTime"):
            v = _abs_minutes(s, field)
            if v is None:
                continue
            if prev is not None and v < prev - 1e-9:
                backwards += 1
            prev = v if prev is None or v > prev else prev
    if backwards:
        add("time_goes_backwards", f"{backwards} time value(s) are earlier than a previous stop (check journeyDay)")

    dists = [s.get("distance") for s in route]
    nums = [d for d in dists if isinstance(d, (int, float))]
    if n > 2 and nums and all(d == 0 for d in nums):
        add("all_distances_zero", "every stored distance is 0")
    elif n > 2 and len(nums) < n * 0.7:
        add("missing_distances", f"{n - len(nums)} of {n} stops have no distance")
    if any(b < a for a, b in zip(nums, nums[1:])):
        add("distance_goes_backwards", "cumulative distance decreases along the route")

    if n > LONG_ROUTE_STOPS:
        add("very_long_route", f"{n} stops (more than {LONG_ROUTE_STOPS}); possibly merged or duplicated routes")

    rd = doc.get("runningDays")
    if not isinstance(rd, dict):
        add("running_days_missing", "runningDays is not stored")
    elif not any(rd.values()):
        add("running_days_never", "runningDays has no day set, so the train never runs")

    if coords is not None:
        missing = sum(1 for c in codes if c and not coords.get(c))
        if n > 2 and missing / n > NO_COORD_RATIO:
            add("many_stops_without_coordinates", f"{missing} of {n} stops have no usable map coordinates")
    return issues


def analyze_stations(stations: Iterable[dict]) -> dict:
    rows, no_coords, no_state, no_zone, dups = 0, [], 0, 0, Counter()
    for st in stations:
        rows += 1
        dups[st.get("code")] += 1
        if valid_coordinates(st.get("coordinates")) is None:
            no_coords.append(st.get("code"))
        no_state += 0 if st.get("state") else 1
        no_zone += 0 if st.get("zone") else 1
    return {"stations": rows, "withoutCoordinates": len(no_coords), "withoutState": no_state, "withoutZone": no_zone,
            "duplicateCodes": [c for c, k in dups.items() if k > 1][:20], "exampleWithoutCoordinates": no_coords[:15]}


def build_report(trains: Iterable[dict], stations: Iterable[dict] = (), top: int = 25) -> dict:
    """Run every check over all trains and summarise."""
    stations = list(stations)
    coords = {s.get("code"): valid_coordinates(s.get("coordinates")) is not None for s in stations}
    kinds: Counter = Counter()
    by_train: dict[str, list[dict]] = defaultdict(list)
    total = 0
    for doc in trains:
        total += 1
        for issue in analyze_train(doc, coords if stations else None):
            kinds[issue["kind"]] += 1
            by_train[str(doc.get("trainNumber"))].append(issue)
    weight = {"error": 5, "warn": 2, "info": 1}
    worst = sorted(by_train.items(), key=lambda kv: (-sum(weight[i["severity"]] for i in kv[1]), kv[0]))[:top]
    sev = Counter()
    for k, v in kinds.items():
        sev[SEVERITY[k]] += v
    return {
        "trainsChecked": total,
        "trainsWithIssues": len(by_train),
        "issuesBySeverity": dict(sev),
        "issuesByKind": dict(kinds.most_common()),
        "worstTrains": [{"trainNumber": n, "issues": iss} for n, iss in worst],
        "stations": analyze_stations(stations) if stations else None,
    }


def to_markdown(report: dict) -> str:
    out = ["# Railway data quality report", "",
           f"- Trains checked: **{report['trainsChecked']}**",
           f"- Trains with at least one issue: **{report['trainsWithIssues']}**",
           f"- Issues: {report['issuesBySeverity']}", "", "## Issues by kind", "", "| Kind | Count |", "|---|---|"]
    out += [f"| {k} | {v} |" for k, v in report["issuesByKind"].items()]
    out += ["", "## Worst trains (review these first)", ""]
    for t in report["worstTrains"]:
        out.append(f"- **{t['trainNumber']}**: " + "; ".join(f"[{i['severity']}] {i['kind']} ({i['detail']})" for i in t["issues"]))
    st = report.get("stations")
    if st:
        out += ["", "## Stations", "", f"- {st['stations']} stations; {st['withoutCoordinates']} without usable coordinates; "
                f"{st['withoutState']} without state; {st['withoutZone']} without zone; duplicate codes: {st['duplicateCodes'] or 'none'}"]
    return "\n".join(out) + "\n"
