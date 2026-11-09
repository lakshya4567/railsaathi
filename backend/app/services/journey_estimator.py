"""
journey_estimator.py — estimates a train's position from its timetable.

IMPORTANT DISCLAIMER: This uses scheduled timetable data only.
All positions are ESTIMATED, not GPS or live tracking.
Actual train position may differ due to delays, rerouting, etc.
"""
from datetime import datetime, timedelta
from typing import Optional


def _parse_time(t: str | None, base_date: datetime, day_offset: int) -> datetime | None:
    """Parse HH:MM:SS into a datetime anchored to base_date + day_offset."""
    if not t:
        return None
    try:
        h, m, s = (int(x) for x in t.split(":"))
        return base_date.replace(hour=h, minute=m, second=s) + timedelta(days=day_offset - 1)
    except (ValueError, AttributeError):
        return None


def estimate_position(
    route: list[dict], journey_date: datetime, query_time: datetime | None = None
) -> dict:
    """
    Given a train's completeOrderedRoute and a journey start date,
    estimate where the train is at query_time (defaults to now).

    Returns a dict with:
      - status: "not_started" | "between_stops" | "completed" | "insufficient_data"
      - message: human-readable explanation
      - estimated_segment: {from_stop, to_stop} when status is "between_stops"
      - disclaimer: always present

    This is SCHEDULED data only — not live GPS.
    """
    DISCLAIMER = (
        "ESTIMATED position based on scheduled timetable only. "
        "Actual train position may differ due to delays or diversions. "
        "This is not live GPS tracking."
    )

    if query_time is None:
        query_time = datetime.utcnow()

    base = journey_date.replace(hour=0, minute=0, second=0, microsecond=0)

    # Build timeline: list of (stop, depart_dt or arrive_dt)
    timeline = []
    for stop in route:
        dep = _parse_time(stop.get("departureTime"), base, stop.get("journeyDay", 1))
        arr = _parse_time(stop.get("arrivalTime"), base, stop.get("journeyDay", 1))
        timeline.append((stop, arr, dep))

    if not timeline:
        return {"status": "insufficient_data", "message": "No route data available.", "disclaimer": DISCLAIMER}

    # First departure
    first_dep = timeline[0][2]
    if first_dep is None:
        return {"status": "insufficient_data", "message": "Departure time for source station is missing.", "disclaimer": DISCLAIMER}

    if query_time < first_dep:
        return {
            "status": "not_started",
            "message": f"Train has not departed yet. Scheduled departure: {first_dep.strftime('%H:%M')} on {first_dep.strftime('%d %b %Y')}.",
            "disclaimer": DISCLAIMER,
        }

    # Last arrival
    last_arr = timeline[-1][1]
    if last_arr and query_time > last_arr:
        return {
            "status": "completed",
            "message": f"Train has completed its journey. Scheduled arrival at destination: {last_arr.strftime('%H:%M')}.",
            "disclaimer": DISCLAIMER,
        }

    # Find segment
    for i in range(len(timeline) - 1):
        _, _, dep_i = timeline[i]
        stop_next, arr_next, _ = timeline[i + 1]
        t_from = dep_i or timeline[i][1]  # fallback to arr if no dep
        t_to = arr_next

        if t_from is None or t_to is None:
            continue

        if t_from <= query_time <= t_to:
            from_stop = timeline[i][0]
            return {
                "status": "between_stops",
                "message": (
                    f"Estimated between {from_stop['stationName']} and {stop_next['stationName']}."
                ),
                "estimated_segment": {
                    "from_stop": from_stop,
                    "to_stop": stop_next,
                    "departed_at": t_from.strftime("%H:%M"),
                    "arrives_at": t_to.strftime("%H:%M"),
                },
                "disclaimer": DISCLAIMER,
            }

    return {
        "status": "insufficient_data",
        "message": "Could not determine position — timing data may be incomplete.",
        "disclaimer": DISCLAIMER,
    }
