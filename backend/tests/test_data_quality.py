import copy
import unittest

from app.services import data_quality as dq
from tests.fixtures_synthetic import TRAINS, STATIONS, stop


def kinds(doc, coords=None):
    return {i["kind"] for i in dq.analyze_train(doc, coords)}


class DataQualityTests(unittest.TestCase):
    def test_clean_fixture_trains_have_no_errors(self):
        for t in TRAINS:
            errs = [i for i in dq.analyze_train(t) if i["severity"] == "error"]
            self.assertEqual(errs, [], t["trainNumber"])

    def test_structure_problems(self):
        t = copy.deepcopy(TRAINS[1])
        t["completeOrderedRoute"] = []
        self.assertEqual(kinds(t), {"no_route"})
        t["completeOrderedRoute"] = [stop(1, "R", "RAIPUR JN", None, "06:00:00")]
        self.assertIn("single_stop_route", kinds(t))
        t = copy.deepcopy(TRAINS[2]); t["completeOrderedRoute"][2]["sequence"] = 9
        self.assertIn("sequence_not_contiguous", kinds(t))
        t = copy.deepcopy(TRAINS[2]); t["completeOrderedRoute"].append(stop(5, "R", "RAIPUR JN", "17:00:00", None, 1, 300))
        self.assertIn("duplicate_station_in_route", kinds(t))
        t = copy.deepcopy(TRAINS[2]); t["destination"] = {"code": "CSMT", "name": "X"}
        self.assertIn("endpoint_mismatch", kinds(t))

    def test_time_and_distance_problems(self):
        t = copy.deepcopy(TRAINS[2])
        for s in t["completeOrderedRoute"]:
            s["arrivalTime"] = s["departureTime"] = None
        self.assertIn("all_times_missing", kinds(t))
        t = copy.deepcopy(TRAINS[2]); t["completeOrderedRoute"][3]["arrivalTime"] = "08:00:00"   # earlier than previous stop, same day
        self.assertIn("time_goes_backwards", kinds(t))
        t = copy.deepcopy(TRAINS[0])                                   # overnight train with proper journeyDay is NOT flagged
        self.assertNotIn("time_goes_backwards", kinds(t))
        t = copy.deepcopy(TRAINS[2])
        for s in t["completeOrderedRoute"]:
            s["distance"] = 0
        self.assertIn("all_distances_zero", kinds(t))
        t = copy.deepcopy(TRAINS[2]); t["completeOrderedRoute"][2]["distance"] = 5
        self.assertIn("distance_goes_backwards", kinds(t))

    def test_long_route_like_the_294_stop_train(self):
        t = copy.deepcopy(TRAINS[1])
        t["completeOrderedRoute"] = [stop(i, f"S{i}", f"STATION {i}", None, None, 1, 0) for i in range(1, 295)]
        t["source"], t["destination"] = {"code": "S1"}, {"code": "S294"}
        k = kinds(t)
        self.assertTrue({"very_long_route", "all_times_missing", "all_distances_zero"} <= k, k)

    def test_running_days_and_coordinates(self):
        t = copy.deepcopy(TRAINS[1]); t["runningDays"] = None
        self.assertIn("running_days_missing", kinds(t))
        t["runningDays"] = {"MON": False}
        self.assertIn("running_days_never", kinds(t))
        coords = {s["code"]: bool(s["coordinates"] and s["coordinates"]["latitude"]) for s in STATIONS}
        self.assertIn("many_stops_without_coordinates", kinds(TRAINS[2], {**coords, "DURG": False, "G": False}))
        self.assertNotIn("many_stops_without_coordinates", kinds(TRAINS[2], {c: True for c in coords}))

    def test_report_and_markdown(self):
        bad = copy.deepcopy(TRAINS[2]); bad["trainNumber"] = "99999"; bad["completeOrderedRoute"] = []
        rep = dq.build_report(TRAINS + [bad], STATIONS)
        self.assertEqual(rep["trainsChecked"], 6)
        self.assertEqual(rep["worstTrains"][0]["trainNumber"], "99999")
        self.assertEqual(rep["issuesBySeverity"]["error"], 1)
        st = rep["stations"]
        self.assertEqual((st["stations"], st["withoutCoordinates"]), (9, 3))    # RCTY, G (0,0), LONELY
        md = dq.to_markdown(rep)
        self.assertIn("# Railway data quality report", md)
        self.assertIn("**99999**", md)
        self.assertEqual(dq.build_report([], [])["trainsChecked"], 0)

    def test_checks_never_modify_the_input(self):
        t = copy.deepcopy(TRAINS[0]); before = copy.deepcopy(t)
        dq.analyze_train(t); dq.build_report([t], STATIONS)
        self.assertEqual(t, before)


if __name__ == "__main__":
    unittest.main()
