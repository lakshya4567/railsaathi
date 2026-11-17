"""Tests for journey_tools.py (transfers, reachability, comparison, halts, trip planner) and the
new time filters. Expectations were worked out by hand from tests/fixtures_synthetic.py."""
import unittest
from datetime import datetime

from app.services import journey_tools as jt
from app.services import railway_tools as rt
from app.services import tools
from tests.fake_db import FakeDB
from tests.fixtures_synthetic import TRAINS, STATIONS


class TimeFilterTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB(TRAINS, STATIONS)

    def nums(self, **kw):
        return [t["trainNumber"] for t in rt.find_trains_between_stations(self.db, "R", "NGP", **kw)["trains"]]

    def test_depart_after_before(self):
        # departures from Raipur: 90001 06:00, 12810 07:25, 90002 09:00
        self.assertEqual(self.nums(depart_after="08:00"), ["90002"])
        self.assertEqual(self.nums(depart_before="06:30"), ["90001"])
        self.assertEqual(self.nums(depart_after="06:30", depart_before="08:00"), ["12810"])

    def test_arrive_by_same_day(self):
        # arrivals at Nagpur: 90001 10:30, 12810 13:10, 90002 16:45
        self.assertEqual(self.nums(arrive_by="11:00"), ["90001"])
        self.assertEqual(self.nums(arrive_by="14:00"), ["90001", "12810"])

    def test_filters_validated_and_reported(self):
        with self.assertRaises(rt.ToolInputError):
            self.nums(depart_after="evening")
        r = rt.find_trains_between_stations(self.db, "R", "NGP", arrive_by="11:00")
        self.assertEqual(r["timeFilters"]["arriveBy"], "11:00")
        none = rt.find_trains_between_stations(self.db, "R", "NGP", depart_after="23:00")
        self.assertFalse(none["found"])
        self.assertIn("Time filters applied", none["message"])


class TransferTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB(TRAINS, STATIONS)

    def test_one_change_journey_computed_by_hand(self):
        # BSP -> NGP on MON: 90004 BSP 05:00 -> Raipur (arr 07:00), then 90002 (MON) Raipur 09:00 -> Nagpur 16:45
        r = jt.find_journeys_with_transfer(self.db, "Bilaspur", "Nagpur", day="MON")
        self.assertTrue(r["found"])
        self.assertEqual(r["optionsFound"], 1)
        o = r["options"][0]
        self.assertEqual((o["legs"][0]["train"]["trainNumber"], o["legs"][1]["train"]["trainNumber"]), ("90004", "90002"))
        self.assertEqual(o["transfer"]["station"]["code"], "R")        # tie with Durg: longer layover (safer) wins
        self.assertEqual(o["transfer"]["layoverMinutes"], 120)
        self.assertEqual(o["totalDuration"], "11h 45m")
        self.assertEqual((o["departureTime"], o["arrivalTime"], o["arrivalDayOffset"]), ("05:00", "16:45", 0))
        self.assertEqual((o["legs"][0]["departureTime"], o["legs"][0]["arrivalTime"]), ("05:00", "07:00"))
        self.assertEqual((o["legs"][1]["departureTime"], o["legs"][1]["arrivalTime"]), ("09:00", "16:45"))
        self.assertEqual(o["legs"][0]["duration"] + "|" + o["legs"][1]["duration"], "2h 00m|7h 45m")

    def test_running_days_are_respected(self):
        # 90002 does not run on TUE, and 90001 (daily) leaves Raipur too early -> wait > 8h
        r = jt.find_journeys_with_transfer(self.db, "BSP", "NGP", day="TUE")
        self.assertFalse(r["found"])
        self.assertEqual(r["reason"], "no_transfer_journey")

    def test_layover_limits(self):
        self.assertFalse(jt.find_journeys_with_transfer(self.db, "BSP", "NGP", day="MON", max_layover_minutes=60)["found"])
        self.assertTrue(jt.find_journeys_with_transfer(self.db, "BSP", "NGP", day="MON", min_layover_minutes=60)["found"])
        self.assertFalse(jt.find_journeys_with_transfer(self.db, "BSP", "NGP", day="MON", min_layover_minutes=150, max_layover_minutes=200)["found"])
        with self.assertRaises(rt.ToolInputError):
            jt.find_journeys_with_transfer(self.db, "BSP", "NGP", min_layover_minutes=200, max_layover_minutes=100)

    def test_direct_trains_are_not_reported_as_transfers(self):
        # Raipur -> Nagpur has direct trains only; no (train, same-station change) is invented
        r = jt.find_journeys_with_transfer(self.db, "R", "NGP", day="MON")
        self.assertFalse(r["found"])

    def test_default_day_uses_the_given_clock(self):
        mon = jt.find_journeys_with_transfer(self.db, "BSP", "NGP", now=datetime(2026, 11, 9, 9, 0))   # Monday
        tue = jt.find_journeys_with_transfer(self.db, "BSP", "NGP", now=datetime(2026, 11, 10, 9, 0))  # Tuesday
        self.assertTrue(mon["found"] and not tue["found"])
        self.assertEqual(mon["dayUsed"], "MON")

    def test_bad_input(self):
        for kw in ({"day": "FUNDAY"}, {"limit": "x"}):
            with self.assertRaises(rt.ToolInputError):
                jt.find_journeys_with_transfer(self.db, "BSP", "NGP", **kw)
        self.assertEqual(jt.find_journeys_with_transfer(self.db, "BSP", "Atlantis")["reason"], "station_not_found")
        self.assertEqual(jt.find_journeys_with_transfer(self.db, "BSP", "BSP")["reason"], "same_station")


class ReachabilityTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB(TRAINS, STATIONS)

    def test_reachable_within_six_hours(self):
        r = jt.find_reachable_stations(self.db, "Raipur", max_hours=6)
        got = [(s["code"], s["durationMinutes"]) for s in r["stations"]]
        self.assertEqual(got, [("DURG", 40), ("G", 215), ("NGP", 270)])   # CSMT (19h) excluded
        self.assertEqual(r["origin"]["code"], "R")
        self.assertEqual(r["origin"]["coordinates"], {"latitude": 21.25, "longitude": 81.63})
        by = {s["code"]: s for s in r["stations"]}
        self.assertIsNone(by["G"]["coordinates"])                       # 0,0 is not a location
        self.assertEqual(r["withoutCoordinates"], 1)
        self.assertEqual(by["NGP"]["viaTrain"]["trainNumber"], "90001")  # the faster of two trains
        self.assertEqual(by["NGP"]["state"], "Maharashtra")

    def test_min_hours_skips_near_places(self):
        r = jt.find_reachable_stations(self.db, "R", max_hours=6, min_hours=3)
        self.assertEqual([s["code"] for s in r["stations"]], ["G", "NGP"])

    def test_day_filter(self):
        r = jt.find_reachable_stations(self.db, "R", max_hours=6, day="SUN")
        self.assertEqual([(s["code"], s["durationMinutes"]) for s in r["stations"]], [("DURG", 55), ("NGP", 270)])

    def test_nothing_reachable_and_bad_input(self):
        self.assertFalse(jt.find_reachable_stations(self.db, "LONELY")["found"])
        self.assertFalse(jt.find_reachable_stations(self.db, "Atlantis")["found"])
        with self.assertRaises(rt.ToolInputError):
            jt.find_reachable_stations(self.db, "R", max_hours=3, min_hours=3)
        with self.assertRaises(rt.ToolInputError):
            jt.find_reachable_stations(self.db, "R", day="FUNDAY")


class CompareAndHaltTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB(TRAINS, STATIONS)

    def test_compare(self):
        r = jt.compare_trains(self.db, ["12810", "90001"])
        by = {t["trainNumber"]: t for t in r["trains"]}
        self.assertEqual(by["12810"]["scheduledDuration"], "28h 35m")
        self.assertEqual(by["90001"]["scheduledDuration"], "4h 30m")
        self.assertEqual(by["12810"]["averageSpeedKmph"], 66.5)    # 1900 km / (1715/60 h)
        self.assertEqual(by["90001"]["averageSpeedKmph"], 64.4)
        self.assertEqual(by["12810"]["longestHalt"]["minutes"], 10)
        self.assertEqual((r["shortestScheduled"], r["highestAverageSpeed"], r["fewestStops"]), ("90001", "12810", "90001"))

    def test_compare_missing_and_invalid(self):
        r = jt.compare_trains(self.db, ["12810", "90001", "55555"])
        self.assertTrue(r["found"])
        self.assertEqual(r["notFound"], ["55555"])
        self.assertFalse(jt.compare_trains(self.db, ["12810", "55555"])["found"])
        for bad in ("12810", ["12810"], ["12810"] * 2, ["1", "2"], ["12810", "90001", "90002", "90003", "90004"], [12810, 90001], None):
            with self.assertRaises(rt.ToolInputError):
                jt.compare_trains(self.db, bad)

    def test_halts(self):
        r = jt.get_train_halts(self.db, "12810", min_minutes=10)
        self.assertEqual([h["stationCode"] for h in r["halts"]], ["BSP", "R", "NGP"])
        self.assertEqual(r["longestHalt"]["haltMinutes"], 10)
        self.assertFalse(jt.get_train_halts(self.db, "12810", min_minutes=11)["found"])
        self.assertFalse(jt.get_train_halts(self.db, "55555")["found"])
        self.assertFalse(jt.get_train_halts(self.db, "90001")["found"])      # no intermediate stops


class TripPlannerTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB(TRAINS, STATIONS)

    def test_two_leg_trip_computed_by_hand(self):
        r = jt.plan_trip(self.db, ["Raipur", "Nagpur", "Raipur"], day="MON", start_time="00:00", min_stay_hours=2)
        self.assertTrue(r["found"])
        l1, l2 = r["legs"]
        self.assertEqual((l1["train"]["trainNumber"], l1["departureTime"], l1["arrivalTime"], l1["tripDay"]), ("90001", "06:00", "10:30", 1))
        # ready again at 12:30 -> next 90003 is Tuesday 07:00 -> Raipur 11:30 (trip day 2)
        self.assertEqual((l2["train"]["trainNumber"], l2["departureTime"], l2["arrivalTime"], l2["tripDay"], l2["arrivalTripDay"]), ("90003", "07:00", "11:30", 2, 2))
        self.assertEqual(l2["wait"], "18h 30m")
        self.assertEqual(r["totalTravelSpan"], "29h 30m")

    def test_start_time_changes_choice(self):
        r = jt.plan_trip(self.db, ["R", "NGP"], day="MON", start_time="08:00")
        self.assertEqual(r["legs"][0]["train"]["trainNumber"], "90002")      # 06:00 and 07:25 already gone

    def test_unreachable_leg_reported(self):
        r = jt.plan_trip(self.db, ["Durg", "Howrah"], day="MON")
        self.assertFalse(r["found"])
        self.assertEqual(r["reason"], "no_direct_leg")
        self.assertEqual(r["failedLeg"]["to"]["code"], "HWH")

    def test_validation(self):
        for bad in ("R NGP", ["R"], ["R"] * 6, [1, 2]):
            with self.assertRaises(rt.ToolInputError):
                jt.plan_trip(self.db, bad)
        with self.assertRaises(rt.ToolInputError):
            jt.plan_trip(self.db, ["R", "Raipur Junction"])
        with self.assertRaises(rt.ToolInputError):
            jt.plan_trip(self.db, ["R", "NGP"], start_time="soon")
        self.assertEqual(jt.plan_trip(self.db, ["R", "Atlantis"])["reason"], "station_not_found")


class RegistryTests(unittest.TestCase):
    def test_all_tools_are_registered_and_validated(self):
        db = FakeDB(TRAINS, STATIONS)
        for name in ("find_journeys_with_transfer", "find_reachable_stations", "compare_trains", "get_train_halts", "plan_trip",
                     "demo_pnr_lookup", "demo_fare_estimate", "demo_seat_availability", "demo_live_status", "demo_food_menu"):
            self.assertIn(name, tools.TOOL_SPECS)
        self.assertEqual(len(tools.declarations()), len(tools.TOOL_SPECS))
        r = tools.run_tool("compare_trains", {"train_numbers": ["12810", "90001"]}, db=db)
        self.assertTrue(r["found"])
        with self.assertRaises(rt.ToolInputError):
            tools.run_tool("compare_trains", {"train_numbers": ["12810", "90001"], "x": 1}, db=db)
        with self.assertRaises(rt.ToolInputError):
            tools.run_tool("demo_place_order", {}, db=db)     # ordering is not an AI tool
        self.assertEqual(tools.DEMO_TOOLS, {"demo_pnr_lookup", "demo_fare_estimate", "demo_seat_availability", "demo_live_status", "demo_food_menu"})

    def test_declarations_are_valid_json_schema_shapes(self):
        for d in tools.declarations():
            self.assertRegex(d["name"], r"^[a-z_]+$")
            self.assertEqual(d["parameters"]["type"], "object")
            for k in d["parameters"].get("required", []):
                self.assertIn(k, d["parameters"]["properties"])
            for p in d["parameters"]["properties"].values():
                self.assertIn(p["type"], ("string", "integer", "boolean", "array"))
                if p["type"] == "array":
                    self.assertIn("items", p)

    def test_no_tool_module_can_write_or_run_arbitrary_queries(self):
        import inspect, re
        from app.services import demo_tools
        for mod in (rt, jt, demo_tools):
            src = inspect.getsource(mod)
            bad = re.findall(r"\.(insert_one|insert_many|update_one|update_many|delete_one|delete_many|drop|drop_collection|"
                             r"bulk_write|replace_one|find_one_and_\w+|create_index|aggregate|command)\(", src)
            self.assertEqual(bad, [], mod.__name__)
            for banned in ("$where", "$function", "$out", "$merge", "eval(", "exec("):
                self.assertNotIn(banned, src, mod.__name__)


if __name__ == "__main__":
    unittest.main()
