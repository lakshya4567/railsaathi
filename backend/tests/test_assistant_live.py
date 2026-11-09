"""
LIVE checks against YOUR real MongoDB (read-only) — and, if GEMINI_API_KEY is set,
against the real Gemini model. Records are picked from the database at run time, so
nothing here is hard-coded sample railway data.

Run:  python -m unittest tests.test_assistant_live -v
Skipped automatically when MongoDB is unreachable / no API key is configured.
"""
import unittest

from app.services import railway_tools as rt

try:
    from app.config import settings
    from app.database import get_db, ping
    DB_OK = ping()
except Exception:  # noqa: BLE001
    DB_OK, settings = False, None


@unittest.skipUnless(DB_OK, "MongoDB not reachable")
class LiveToolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = get_db()
        # a train with a long route, chosen from the real data
        cls.doc = cls.db["trains"].find_one({"completeOrderedRoute.9": {"$exists": True}}, {"_id": 0})
        assert cls.doc, "no train with 10+ stops found"
        cls.route = sorted(cls.doc["completeOrderedRoute"], key=lambda s: s["sequence"])
        cls.num = cls.doc["trainNumber"]

    def test_train_number_and_name_search(self):
        r = rt.search_trains(self.db, self.num)
        self.assertEqual(r["trains"][0]["trainNumber"], self.num)
        word = self.doc["trainName"].split()[0]
        r = rt.search_trains(self.db, word)
        self.assertTrue(r["found"])
        self.assertTrue(any(t["trainNumber"] == self.num for t in rt.search_trains(self.db, self.doc["trainName"])["trains"]))

    def test_details_match_database(self):
        t = rt.get_train_details(self.db, self.num)["train"]
        self.assertEqual(t["trainName"], self.doc["trainName"])
        self.assertEqual(t["source"], self.doc["source"])
        self.assertEqual(t["stopCount"], len(self.route))

    def test_route_is_complete_and_ordered(self):
        r = rt.get_train_route(self.db, self.num, show_map=True)
        self.assertEqual(r["stopCount"], len(self.route))
        self.assertEqual([s["stationCode"] for s in r["stops"]], [s["stationCode"] for s in self.route])
        seqs = [s["sequence"] for s in r["stops"]]
        self.assertEqual(seqs, sorted(seqs))
        self.assertLessEqual(r["coordinates"]["mapped"], r["coordinates"]["total"])

    def test_station_search_and_details(self):
        code, name = self.route[0]["stationCode"], self.route[0]["stationName"]
        self.assertEqual(rt.search_stations(self.db, code)["stations"][0]["code"], code)
        st = rt.get_station_details(self.db, code)
        self.assertTrue(st["found"])
        self.assertEqual(st["station"]["code"], code)
        self.assertTrue(rt.search_stations(self.db, name)["found"])

    def test_trains_at_station(self):
        code = self.route[len(self.route) // 2]["stationCode"]
        r = rt.get_trains_at_station(self.db, code, limit=25)
        self.assertGreaterEqual(r["total"], 1)
        self.assertTrue(r["trains"])
        r2 = rt.get_station_trains(self.db, code, limit=25)
        self.assertEqual(r["total"], r2["total"])

    def test_trains_between_two_stops_of_a_real_train(self):
        a, b = self.route[1], self.route[-2]
        r = rt.find_trains_between_stations(self.db, a["stationCode"], b["stationCode"], limit=rt.MAX_RESULTS)
        self.assertTrue(r["found"], r.get("message"))
        if r["directTrainsFound"] <= rt.MAX_RESULTS:      # whole list returned -> must contain our train
            self.assertIn(self.num, {t["trainNumber"] for t in r["trains"]})
        for t in r["trains"]:                              # every result really visits A before B
            doc = self.db["trains"].find_one({"trainNumber": t["trainNumber"]}, {"completeOrderedRoute": 1})
            codes = [x["stationCode"] for x in sorted(doc["completeOrderedRoute"], key=lambda x: x["sequence"])]
            self.assertLess(codes.index(a["stationCode"]), codes.index(b["stationCode"]))

    def test_missing_records_are_reported(self):
        self.assertFalse(rt.get_train_details(self.db, "000000")["found"])
        self.assertFalse(rt.search_stations(self.db, "zzqxjv nowhere")["found"])
        self.assertFalse(rt.search_trains(self.db, "zzqxjv nowhere")["found"])

    def test_position_is_labelled_as_estimate(self):
        r = rt.get_scheduled_position(self.db, self.num)
        self.assertTrue(r["isEstimate"])
        self.assertFalse(r["isLiveTracking"])
        self.assertIn("NOT live tracking", r["disclaimer"])

    def test_read_only_database_unchanged_counts(self):
        before = (self.db["trains"].estimated_document_count(), self.db["stations"].estimated_document_count())
        rt.find_trains_between_stations(self.db, self.route[0]["stationCode"], self.route[-1]["stationCode"])
        after = (self.db["trains"].estimated_document_count(), self.db["stations"].estimated_document_count())
        self.assertEqual(before, after)


@unittest.skipUnless(DB_OK and settings and settings.gemini_api_key and not settings.gemini_api_key.lower().startswith("your-"),
                     "needs MongoDB and a real GEMINI_API_KEY")
class LiveModelTests(unittest.TestCase):
    """Real model + real DB. Checks the model's judgement: tool choice and follow-ups."""

    @classmethod
    def setUpClass(cls):
        from app.services import assistant as A
        from app.services.ai_provider import build_provider
        cls.A, cls.provider = A, build_provider(settings)
        cls.db = get_db()
        cls.doc = cls.db["trains"].find_one({"completeOrderedRoute.9": {"$exists": True}}, {"_id": 0})

    def ask(self, msg, hist, ctx):
        return self.A.chat(msg, hist, ctx, provider=self.provider, db=self.db)

    def test_train_then_route_then_next_station(self):
        n = self.doc["trainNumber"]
        o1 = self.ask(f"Tell me about train {n}.", [], None)
        self.assertEqual(o1["blocks"][0]["type"], "train_card")
        self.assertEqual(o1["blocks"][0]["train"]["trainName"], self.doc["trainName"])
        h = [{"role": "user", "text": f"Tell me about train {n}."}, {"role": "assistant", "text": o1["reply"]}]
        o2 = self.ask("Show me the route of this train.", h, o1["context"])
        self.assertIn("train_route", [b["type"] for b in o2["blocks"]])
        self.assertIn("map_route", [b["type"] for b in o2["blocks"]])
        h += [{"role": "user", "text": "Show me the route of this train."}, {"role": "assistant", "text": o2["reply"]}]
        o3 = self.ask("What is its next station?", h, o2["context"])
        self.assertEqual(o3["context"]["focus_train"]["trainNumber"], n)
