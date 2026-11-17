"""Tests for demo_tools.py. Demo output must be deterministic, always flagged as DEMO, tied to
real train/station records, and must never write anything."""
import json
import unittest
from datetime import datetime

from app.services import demo_tools as dt
from app.services import railway_tools as rt
from tests.fake_db import FakeDB
from tests.fixtures_synthetic import TRAINS, STATIONS

NOW = datetime(2026, 11, 9, 10, 0)   # Monday


class DemoTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB(TRAINS, STATIONS)
        self.numbers = {t["trainNumber"] for t in TRAINS}

    def assert_demo(self, r):
        self.assertTrue(r["isDemo"])
        self.assertIn("DEMO", r["demoNotice"])
        self.assertIn("not real", r["demoNotice"])

    # ---- PNR ----
    def test_pnr_is_demo_deterministic_and_tied_to_a_real_train(self):
        a, b = dt.demo_pnr_lookup(self.db, "1234567890", now=NOW), dt.demo_pnr_lookup(self.db, "1234567890", now=NOW)
        self.assertEqual(a, b)
        self.assert_demo(a)
        self.assertIn(a["train"]["trainNumber"], self.numbers)
        route = next(t for t in TRAINS if t["trainNumber"] == a["train"]["trainNumber"])["completeOrderedRoute"]
        seq = {s["stationCode"]: s["sequence"] for s in route}
        j = a["journey"]
        self.assertLess(seq[j["boarding"]["code"]], seq[j["destination"]["code"]])      # real stops, right order
        self.assertTrue(all(p["name"].startswith("DEMO PASSENGER") for p in a["passengers"]))
        self.assertRegex(" ".join(p["currentStatus"] for p in a["passengers"]), r"CNF|RAC|WL")
        self.assertIn("not connected", a["howItWorks"])
        d = datetime.strptime(j["date"], "%Y-%m-%d")
        self.assertTrue(NOW < d <= datetime(2026, 12, 1))

    def test_pnr_varies_with_input_and_validates(self):
        outs = {json.dumps(dt.demo_pnr_lookup(self.db, f"{n:010d}", now=NOW), sort_keys=True) for n in range(30)}
        self.assertGreater(len(outs), 10)
        for bad in ("123", "abcdefghij", "12345678901", "", "123456789 ", None, 1234567890, "١٢٣٤٥٦٧٨٩٠"):
            with self.assertRaises(rt.ToolInputError):
                dt.demo_pnr_lookup(self.db, bad)

    def test_pnr_with_empty_database(self):
        self.assertFalse(dt.demo_pnr_lookup(FakeDB([], []), "1234567890")["found"])

    # ---- fare ----
    def test_fare_distance_real_rates_demo(self):
        r = dt.demo_fare_estimate(self.db, "90001", "Raipur", "Nagpur")
        self.assert_demo(r)
        self.assertEqual(r["distanceKm"], 290)
        by = {f["class"]: f for f in r["fares"]}
        self.assertEqual(len(by), 7)
        self.assertEqual((by["SL"]["baseFare"], by["SL"]["reservationAndOther"], by["SL"]["tax"], by["SL"]["total"]), (174, 50, 0, 224))
        self.assertEqual((by["3A"]["baseFare"], by["3A"]["tax"], by["3A"]["total"]), (464, 27, 561))   # AC tax applies
        self.assertIn("not an IRCTC fare", r["howItWorks"])
        only = dt.demo_fare_estimate(self.db, "90001", "R", "NGP", "3a")
        self.assertEqual([f["class"] for f in only["fares"]], ["3A"])

    def test_fare_rejects_wrong_order_off_route_and_bad_class(self):
        self.assertFalse(dt.demo_fare_estimate(self.db, "90001", "NGP", "R")["found"])
        self.assertFalse(dt.demo_fare_estimate(self.db, "90001", "R", "HWH")["found"])
        self.assertFalse(dt.demo_fare_estimate(self.db, "55555", "R", "NGP")["found"])
        with self.assertRaises(rt.ToolInputError):
            dt.demo_fare_estimate(self.db, "90001", "R", "NGP", "XX")

    # ---- seats ----
    def test_seats_use_real_running_days(self):
        tue = dt.demo_seat_availability(self.db, "90002", "2026-11-10", now=NOW)      # 90002: MON/WED/FRI
        self.assert_demo(tue)
        self.assertIs(tue["runsOnThisWeekday"], False)
        self.assertEqual(tue["classes"], [])
        wed = dt.demo_seat_availability(self.db, "90002", "2026-11-11", now=NOW)
        self.assertIs(wed["runsOnThisWeekday"], True)
        self.assertEqual(len(wed["classes"]), 7)
        self.assertEqual(wed, dt.demo_seat_availability(self.db, "90002", "2026-11-11", now=NOW))   # deterministic
        self.assertRegex(" ".join(c["status"] for c in wed["classes"]), r"AVAILABLE|RAC|WL|REGRET")

    def test_seats_validation(self):
        for bad in ("2026-11-08", "2027-06-01", "11/11/2026", "tomorrow"):
            with self.assertRaises(rt.ToolInputError):
                dt.demo_seat_availability(self.db, "90002", bad, now=NOW)
        self.assertFalse(dt.demo_seat_availability(self.db, "55555", "2026-11-11", now=NOW)["found"])

    # ---- live status ----
    def test_live_status_is_simulated_on_top_of_the_timetable(self):
        r = dt.demo_live_status(self.db, "12810", now=NOW)
        self.assert_demo(r)
        self.assertTrue(0 <= r["simulatedDelayMinutes"] <= 45)
        pos = r["position"]
        self.assertEqual(pos["nextScheduledStop"]["code"], "G")
        h, m = map(int, pos["demoExpectedArrivalAtNext"].split(":"))
        self.assertEqual(h * 60 + m, 11 * 60 + r["simulatedDelayMinutes"])           # 11:00 + delay
        self.assertEqual(r, dt.demo_live_status(self.db, "12810", now=NOW))
        self.assertIn("made-up", r["howItWorks"])
        self.assertFalse(dt.demo_live_status(self.db, "55555")["found"])

    # ---- food ----
    def test_food_menu(self):
        r = dt.demo_food_menu(self.db, "Nagpur")
        self.assert_demo(r)
        ids = [i["id"] for i in r["items"]]
        self.assertIn("D11", ids)
        self.assertIn("D13", ids)
        self.assertGreaterEqual(len(ids), 10)
        self.assertEqual(r, dt.demo_food_menu(self.db, "NGP"))
        self.assertNotEqual(ids, [i["id"] for i in dt.demo_food_menu(self.db, "R")["items"]])
        self.assertFalse(dt.demo_food_menu(self.db, "Atlantis")["found"])

    def test_place_order(self):
        o = dt.demo_place_order(self.db, "12810", "Raipur", [{"id": "D11", "qty": 2}, {"id": "D13", "qty": 1}], now=NOW)
        self.assert_demo(o)
        self.assertEqual(o["total"], 2 * 15 + 20)
        self.assertRegex(o["orderId"], r"^DEMO-\d{8}$")
        self.assertEqual(o["scheduledArrivalAtStation"], "07:15")           # real timetable at Raipur
        self.assertIn("no payment", o["paymentNote"])
        self.assertEqual(o["orderId"], dt.demo_place_order(self.db, "12810", "R", [{"id": "D13", "qty": 1}, {"id": "D11", "qty": 2}], now=NOW)["orderId"])

    def test_place_order_validation(self):
        ok = [{"id": "D11", "qty": 1}]
        self.assertFalse(dt.demo_place_order(self.db, "55555", "R", ok)["found"])
        self.assertFalse(dt.demo_place_order(self.db, "12810", "LONELY", ok)["found"])       # train does not stop there
        self.assertFalse(dt.demo_place_order(self.db, "12810", "Atlantis", ok)["found"])
        bad_sets = [[], "D11", [{"id": "D99", "qty": 1}], [{"id": "D11", "qty": 0}], [{"id": "D11", "qty": 6}],
                    [{"id": "D11", "qty": True}], [{"id": "D11", "qty": 1}, {"id": "D11", "qty": 1}],
                    [{"id": "D11", "qty": 1, "price": 0}], ["D11"], [{"id": "D11", "qty": 1.5}],
                    [{"id": f"D{i:02d}", "qty": 1} for i in range(1, 12)]]
        for items in bad_sets:
            with self.assertRaises(rt.ToolInputError, msg=str(items)):
                dt.demo_place_order(self.db, "12810", "R", items)

    def test_every_found_demo_result_is_flagged(self):
        outs = [dt.demo_pnr_lookup(self.db, "5550001112", now=NOW), dt.demo_fare_estimate(self.db, "90001", "R", "NGP"),
                dt.demo_seat_availability(self.db, "90001", "2026-11-12", now=NOW), dt.demo_live_status(self.db, "12810", now=NOW),
                dt.demo_food_menu(self.db, "R"), dt.demo_place_order(self.db, "12810", "R", [{"id": "D11", "qty": 1}], now=NOW)]
        for r in outs:
            self.assertTrue(r["found"])
            self.assert_demo(r)


if __name__ == "__main__":
    unittest.main()
