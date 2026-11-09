"""
Unit tests for the controlled MongoDB tool functions (app/services/railway_tools.py).

They run against an in-memory database loaded with SYNTHETIC records (see
fixtures_synthetic.py) so they work offline. test_assistant_live.py repeats the
key checks against your real MongoDB.
"""
import unittest
from datetime import datetime

from pymongo.errors import ServerSelectionTimeoutError

from app.services import railway_tools as rt
from tests.fake_db import FakeDB, BrokenDB
from tests.fixtures_synthetic import TRAINS, STATIONS


class ToolTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB(TRAINS, STATIONS)

    # ---- trains ----
    def test_train_number_search_exact(self):
        r = rt.search_trains(self.db, "12810")
        self.assertTrue(r["found"])
        self.assertEqual(r["trains"][0]["trainName"], "TEST MAIL (SYNTHETIC)")
        self.assertEqual(r["matchedBy"], "exact train number")

    def test_train_number_prefix_search(self):
        r = rt.search_trains(self.db, "900")
        self.assertEqual(sorted(t["trainNumber"] for t in r["trains"]),
                         ["90001", "90002", "90003", "90004"])

    def test_train_name_search_multiword_any_order(self):
        r = rt.search_trains(self.db, "express test")
        self.assertEqual([t["trainNumber"] for t in r["trains"]], ["90001"])

    def test_train_not_found_is_explicit(self):
        r = rt.search_trains(self.db, "zzzz unknown")
        self.assertFalse(r["found"])
        self.assertIn("No train matching", r["message"])
        r = rt.get_train_details(self.db, "55555")
        self.assertFalse(r["found"])
        self.assertIn("not in the database", r["message"])

    def test_train_details(self):
        r = rt.get_train_details(self.db, "12810")
        t = r["train"]
        self.assertEqual(t["source"]["code"], "HWH")
        self.assertEqual(t["stopCount"], 7)
        self.assertEqual(t["departsSource"], "22:05")
        self.assertEqual(t["runningDaysText"], "SUN, TUE, FRI")
        # 22:05 day1 -> 02:40 day3 = 28h35m
        self.assertEqual(t["scheduledDuration"], "28h 35m")

    def test_train_route_complete_and_ordered(self):
        r = rt.get_train_route(self.db, "12810", show_map=True)
        seqs = [s["sequence"] for s in r["stops"]]
        self.assertEqual(seqs, [1, 2, 3, 4, 5, 6, 7])
        self.assertEqual(r["stopCount"], 7)
        self.assertTrue(r["showMap"])
        raipur = next(s for s in r["stops"] if s["stationCode"] == "R")
        self.assertEqual(raipur["haltMinutes"], 10)
        self.assertEqual(raipur["journeyDay"], 2)
        # first stop has no arrival, last has no departure -> stay None, not invented
        self.assertIsNone(r["stops"][0]["arrivalTime"])
        self.assertIsNone(r["stops"][-1]["departureTime"])
        self.assertIsNone(r["stops"][0]["haltMinutes"])

    def test_route_coordinate_coverage_does_not_invent(self):
        r = rt.get_train_route(self.db, "12810")
        # Gondia has 0,0 in the data => counted as NOT mappable
        self.assertEqual(r["coordinates"], {"mapped": 6, "total": 7})
        g = next(s for s in r["stops"] if s["stationCode"] == "G")
        self.assertFalse(g["hasCoordinates"])

    # ---- stations ----
    def test_station_search_by_name_and_code(self):
        r = rt.search_stations(self.db, "Nagpur")
        self.assertEqual(r["stations"][0]["code"], "NGP")
        r = rt.search_stations(self.db, "ngp")
        self.assertEqual(r["stations"][0]["code"], "NGP")

    def test_station_search_not_found(self):
        r = rt.search_stations(self.db, "Atlantis")
        self.assertFalse(r["found"])

    def test_station_details_junction_wording(self):
        # "Raipur Junction" must find stored name "RAIPUR JN", preferring the busier one
        r = rt.get_station_details(self.db, "Raipur Junction")
        self.assertEqual(r["station"]["code"], "R")
        self.assertEqual(r["station"]["state"], "Chhattisgarh")
        self.assertTrue(r["resolution"]["ambiguous"])
        self.assertEqual(r["resolution"]["otherMatches"][0]["code"], "RCTY")

    def test_station_details_missing_coordinates_stay_missing(self):
        r = rt.get_station_details(self.db, "RCTY")
        self.assertIsNone(r["station"]["coordinates"])
        r = rt.get_station_details(self.db, "G")
        self.assertIsNone(r["station"]["coordinates"])  # 0,0 is not a location

    def test_station_trains(self):
        r = rt.get_station_trains(self.db, "R")
        self.assertEqual(r["total"], 5)  # 12810, 90001, 90002, 90003, 90004
        self.assertEqual([t["trainNumber"] for t in r["trains"]],
                         ["12810", "90001", "90002", "90003", "90004"])

    def test_station_with_no_trains(self):
        r = rt.get_station_trains(self.db, "LONELY")
        self.assertTrue(r["found"])
        self.assertEqual(r["total"], 0)
        self.assertEqual(r["trains"], [])

    def test_trains_at_station_with_times_sorted(self):
        r = rt.get_trains_at_station(self.db, "R")
        nums = [t["trainNumber"] for t in r["trains"]]
        # by time of day at Raipur: 06:00, 07:00(90003 arr 11:30 dep none -> arrival), ...
        self.assertEqual(nums[0], "90001")
        t90001 = r["trains"][0]
        self.assertEqual(t90001["atStation"]["departureTime"], "06:00:00")

    def test_trains_at_station_after_time(self):
        r = rt.get_trains_at_station(self.db, "R", after_time="08:30")
        self.assertEqual([t["trainNumber"] for t in r["trains"]], ["90002", "90003"])
        with self.assertRaises(rt.ToolInputError):
            rt.get_trains_at_station(self.db, "R", after_time="soon")

    # ---- journeys ----
    def test_find_trains_between_direction_and_stops(self):
        r = rt.find_trains_between_stations(self.db, "Raipur", "Nagpur")
        nums = [t["trainNumber"] for t in r["trains"]]
        self.assertEqual(set(nums), {"90001", "90002", "12810"})
        self.assertNotIn("90003", nums)   # opposite direction
        self.assertNotIn("90004", nums)   # never reaches Nagpur
        self.assertEqual(r["from"]["code"], "R")
        self.assertEqual(r["to"]["code"], "NGP")
        self.assertEqual(r["directTrainsFound"], 3)

    def test_find_trains_between_default_sorted_by_departure(self):
        r = rt.find_trains_between_stations(self.db, "R", "NGP")
        # departures at Raipur: 90001 06:00, 90002 09:00, 12810 07:25 (day 2)
        self.assertEqual([t["trainNumber"] for t in r["trains"]], ["90001", "90002", "12810"])

    def test_find_trains_between_shortest_duration(self):
        r = rt.find_trains_between_stations(self.db, "R", "NGP", sort_by="duration")
        self.assertEqual(r["trains"][0]["trainNumber"], "90001")
        self.assertEqual(r["trains"][0]["journey"]["scheduledDuration"], "4h 30m")
        self.assertEqual(r["shortestScheduled"]["trainNumber"], "90001")
        # 12810: dep 07:25, arr 13:10 same calendar day => 5h45m
        t = next(t for t in r["trains"] if t["trainNumber"] == "12810")
        self.assertEqual(t["journey"]["scheduledDuration"], "5h 45m")
        self.assertEqual(t["journey"]["distanceKm"], 350.0)
        self.assertEqual(t["journey"]["intermediateStops"], 2)

    def test_find_trains_between_day_filter_uses_start_day_offset(self):
        # 12810 starts SUN/TUE/FRI and reaches Raipur on journey day 2 => leaves Raipur MON/WED/SAT
        mon = rt.find_trains_between_stations(self.db, "R", "NGP", day="MON")
        self.assertEqual({t["trainNumber"] for t in mon["trains"]}, {"90001", "90002", "12810"})
        sun = rt.find_trains_between_stations(self.db, "R", "NGP", day="SUN")
        self.assertEqual({t["trainNumber"] for t in sun["trains"]}, {"90001"})

    def test_find_trains_between_reports_assumption_for_ambiguous_names(self):
        r = rt.find_trains_between_stations(self.db, "Raipur", "Nagpur")
        res = r["resolution"][0]
        self.assertEqual(res["chosen"]["code"], "R")
        self.assertTrue(res["ambiguous"])

    def test_no_direct_train_is_clear(self):
        r = rt.find_trains_between_stations(self.db, "Durg", "Howrah")
        self.assertFalse(r["found"])
        self.assertEqual(r["reason"], "no_direct_train")
        self.assertIn("No direct train", r["message"])

    def test_unknown_station_in_journey(self):
        r = rt.find_trains_between_stations(self.db, "Raipur", "Atlantis")
        self.assertFalse(r["found"])
        self.assertEqual(r["reason"], "station_not_found")

    def test_same_station(self):
        r = rt.find_trains_between_stations(self.db, "R", "Raipur Junction")
        self.assertEqual(r["reason"], "same_station")

    # ---- scheduled position (estimate, never live) ----
    def test_scheduled_position_second_day_run(self):
        # Monday 9 Nov 2026 10:00 IST. 12810 started Sunday 8 Nov (runs SUN) -> day 2.
        r = rt.get_scheduled_position(self.db, "12810", now=datetime(2026, 11, 9, 10, 0))
        self.assertTrue(r["found"])
        self.assertTrue(r["isEstimate"])
        self.assertFalse(r["isLiveTracking"])
        self.assertIn("NOT live tracking", r["disclaimer"])
        self.assertEqual(r["status"], "in_progress_per_schedule")
        inst = r["instances"][0]
        self.assertEqual(inst["journeyStartDate"], "2026-11-08")
        self.assertEqual(inst["estimatedBetween"]["lastScheduledStop"]["code"], "DURG")
        self.assertEqual(inst["estimatedBetween"]["nextScheduledStop"]["code"], "G")
        self.assertEqual(inst["estimatedBetween"]["nextScheduledStop"]["scheduledArrival"], "11:00")

    def test_scheduled_position_explicit_date_time(self):
        r = rt.get_scheduled_position(self.db, "12810", date="2026-11-09", time="10:00")
        self.assertEqual(r["instances"][0]["estimatedBetween"]["nextScheduledStop"]["code"], "G")
        self.assertFalse(r["assumedNoon"])
        r = rt.get_scheduled_position(self.db, "12810", date="2026-11-09")
        self.assertTrue(r["assumedNoon"])

    def test_scheduled_position_not_running(self):
        # Thursday 12 Nov 12:00: the Tuesday run already finished (02:40 on day 3),
        # and no run starts on Wed/Thu -> nothing in progress, and it says so.
        r = rt.get_scheduled_position(self.db, "12810", now=datetime(2026, 11, 12, 12, 0))
        self.assertEqual(r["status"], "no_scheduled_run_in_progress")
        self.assertIn("no run in progress", r["message"])
        self.assertFalse(r["isLiveTracking"])
        self.assertTrue(all(i["status"] != "between_stops" for i in r["instances"]))

    def test_scheduled_position_timezone_aware_now_is_converted_to_ist(self):
        from datetime import timezone
        # 04:30 UTC == 10:00 IST on Mon 9 Nov -> same answer as the naive-IST test
        r = rt.get_scheduled_position(self.db, "12810", now=datetime(2026, 11, 9, 4, 30, tzinfo=timezone.utc))
        self.assertEqual(r["estimatedForIST"], "2026-11-09 10:00")
        self.assertEqual(r["instances"][0]["estimatedBetween"]["nextScheduledStop"]["code"], "G")

    def test_scheduled_position_bad_input(self):
        with self.assertRaises(rt.ToolInputError):
            rt.get_scheduled_position(self.db, "12810", date="09/11/2026")
        with self.assertRaises(rt.ToolInputError):
            rt.get_scheduled_position(self.db, "12810", time="late")
        self.assertFalse(rt.get_scheduled_position(self.db, "55555")["found"])

    # ---- input validation / safety ----
    def test_invalid_inputs(self):
        for bad in (None, "", "   ", 123, {"$ne": ""}, ["x"], "x" * 500):
            with self.assertRaises(rt.ToolInputError):
                rt.search_trains(self.db, bad)
        for bad in ("12A10", "1", "1234567", "12810; drop", {"$gt": ""}):
            with self.assertRaises(rt.ToolInputError):
                rt.get_train_details(self.db, bad)
        with self.assertRaises(rt.ToolInputError):
            rt.find_trains_between_stations(self.db, "R", "NGP", day="FUNDAY")
        with self.assertRaises(rt.ToolInputError):
            rt.find_trains_between_stations(self.db, "R", "NGP", sort_by="cheapest")

    def test_regex_metacharacters_are_never_interpreted(self):
        # Metacharacters are stripped/escaped, so a query containing them behaves exactly
        # like the same words without them. ".*" can never mean "match everything".
        import re
        for q in (".*", "(((", "^$", "\\"):
            for fn in (rt.search_trains, rt.search_stations):
                with self.assertRaises(rt.ToolInputError):   # nothing searchable left
                    fn(self.db, q)
        for q in ("a.*", "T(ST", "TEST|R", "(?i)test", "nag.pur", "RAIPUR+", "[a-z]+"):
            plain = " ".join(re.findall(r"[A-Za-z0-9]+", q))
            for fn in (rt.search_trains, rt.search_stations):
                a, b = fn(self.db, q), fn(self.db, plain)
                for r in (a, b):
                    r.pop("message", None)   # message echoes the raw query text
                self.assertEqual(a, b, f"{fn.__name__}({q!r})")

    def test_run_tool_rejects_unknown_tools_and_arguments(self):
        with self.assertRaises(rt.ToolInputError):
            rt.run_tool("drop_collection", {}, db=self.db)
        with self.assertRaises(rt.ToolInputError):
            rt.run_tool("search_trains", {"query": "x", "filter": {"$where": "1"}}, db=self.db)
        with self.assertRaises(rt.ToolInputError):
            rt.run_tool("search_trains", {}, db=self.db)
        with self.assertRaises(rt.ToolInputError):
            rt.run_tool("search_trains", "not a dict", db=self.db)
        ok = rt.run_tool("get_train_details", {"train_number": "12810"}, db=self.db)
        self.assertTrue(ok["found"])

    def test_tools_registry_is_read_only_by_construction(self):
        # No tool name suggests a write, and tool code uses no write operations.
        import inspect, re
        src = inspect.getsource(rt)
        writes = re.findall(
            r"\.(insert_one|insert_many|update_one|update_many|delete_one|delete_many|"
            r"drop|drop_collection|drop_database|bulk_write|replace_one|find_one_and_\w+|"
            r"create_index|aggregate|command)\(", src)
        self.assertEqual(writes, [], f"unexpected DB write/admin calls: {writes}")
        for banned in ("$where", "$function", "$out", "$merge", "eval(", "exec("):
            self.assertNotIn(banned, src)
        for name in rt.TOOL_SPECS:
            self.assertNotRegex(name, r"(insert|update|delete|drop|write|remove|create)")

    # ---- database failure ----
    def test_database_unavailable_is_raised_not_hidden(self):
        broken = BrokenDB(ServerSelectionTimeoutError("cluster unreachable"))
        with self.assertRaises(rt.DatabaseUnavailable):
            rt.get_train_details(broken, "12810")
        with self.assertRaises(rt.DatabaseUnavailable):
            rt.find_trains_between_stations(broken, "R", "NGP")


if __name__ == "__main__":
    unittest.main()
