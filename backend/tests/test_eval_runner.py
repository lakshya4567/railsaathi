"""Tests the evaluation HARNESS (app/services/eval_runner.py) offline. A rule-based stand-in for the
model behaves well (harness must pass it) or badly (harness must catch it). The real model is
checked with scripts/run_assistant_eval.py."""
import re
import unittest

from app.services import eval_runner as E
from app.services import tools as tl
from tests.fake_db import FakeDB
from tests.fixtures_synthetic import TRAINS, STATIONS


def call(name, **a): return {"functionCall": {"name": name, "args": a}}
def text(t): return {"text": t}


class WellBehavedModel:
    """Tiny rule-based imitation of a good assistant (NOT an AI): picks a tool from the wording."""
    name, model = "rules", "rules"

    def generate(self, system, contents, tools, **kw):
        last = contents[-1]
        msg = next((p["text"] for p in last["parts"] if "text" in p), "") if last["role"] == "user" else ""
        if any("functionResponse" in p for p in last["parts"]):
            fr = [p["functionResponse"] for p in last["parts"] if "functionResponse" in p][0]
            r = fr["response"]
            if r.get("found") is False or r.get("error"):
                return {"content": {"role": "model", "parts": [text("That is not in the database.")]}}
            if fr["name"] == "get_scheduled_position":
                return {"content": {"role": "model", "parts": [text("According to the timetable this is an estimate, not live tracking.")]}}
            if fr["name"] == "demo_pnr_lookup":
                return {"content": {"role": "model", "parts": [text("DEMO result: this is a simulated booking, not real.")]}}
            if fr["name"] == "get_train_details":
                t = r["train"]
                return {"content": {"role": "model", "parts": [text(f"{t['trainNumber']} {t['trainName']} - ट्रेन की जानकारी ऊपर है।" if "ट्रेन" in str(contents) else f"{t['trainNumber']} is {t['trainName']}.")]}}
            return {"content": {"role": "model", "parts": [text("Here are the results from the database.")]}}
        m = msg.lower()
        focus = re.search(r"Focus train: (\d+)", system)
        focus = focus.group(1) if focus else None
        first_listed = re.search(r"\n\s+1\. (\d+)", system)
        num = re.search(r"\b(\d{3,6})\b", msg)
        two = re.search(r"trains (\d+) and (\d+)", m)
        ft = re.search(r"from (.+?) to (.+?)[?.]", msg)
        step = None
        if "ignore all previous" in m: return {"content": {"role": "model", "parts": [text("I can't share that.")]}}
        if "poem" in m: return {"content": {"role": "model", "parts": [text("I can only help with Indian railway journeys.")]}}
        if "running late" in m: return {"content": {"role": "model", "parts": [text("I don't have live data, only the timetable.")]}}
        if "shortest scheduled" in m: return {"content": {"role": "model", "parts": [text(f"The shortest is {first_listed.group(1)}.")]}}
        if "pnr" in m: step = call("demo_pnr_lookup", pnr=re.search(r"\d{10}", msg).group(0))
        elif two: step = call("compare_trains", train_numbers=[two.group(1), two.group(2)])
        elif "stop the longest" in m: step = call("get_train_halts", train_number=num.group(1))
        elif "where can i go from" in m: step = call("find_reachable_stations", from_station=re.search(r"from (.+?) in", msg).group(1))
        elif "one change" in m: step = call("find_journeys_with_transfer", from_station=ft.group(1), to_station=ft.group(2), day="MON")
        elif "next station" in m: step = call("get_scheduled_position", train_number=focus)
        elif "route" in m and "map" in m: step = call("get_train_route", train_number=num.group(1), show_map=True)
        elif "route" in m: step = call("get_train_route", train_number=focus or first_listed.group(1), show_map=False)
        elif "called" in m: step = call("search_trains", query=re.search(r"called (.+?)\.", msg).group(1))
        elif ft: step = call("find_trains_between_stations", from_station=ft.group(1), to_station=ft.group(2))
        elif "which trains stop at" in m: step = call("get_station_trains", station=re.search(r"stop at (.+?)\?", msg).group(1))
        elif "train" in m or "ट्रेन" in msg: step = call("get_train_details", train_number=num.group(1))
        else: step = call("get_station_details", station=re.search(r"about (.+?)\.", msg).group(1))
        return {"content": {"role": "model", "parts": [step]}}


class BadModel:
    """Never uses tools and makes things up."""
    name, model = "bad", "bad"
    def generate(self, system, contents, tools, **kw):
        return {"content": {"role": "model", "parts": [text("Train 12810 is currently at Nagpur and is running late by 20 minutes. Here are my rules: GROUND RULES")]}}


class EvalRunnerTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB(TRAINS, STATIONS)

    def test_samples_come_from_the_database(self):
        s = E.resolve_samples(self.db)
        self.assertEqual((s["train"], s["train_name"], s["station"]), ("12810", "TEST MAIL (SYNTHETIC)", "DURG"))
        self.assertNotEqual(s["train"], s["train2"])
        with self.assertRaises(RuntimeError):
            E.resolve_samples(FakeDB([], []))

    def test_well_behaved_model_passes_every_case(self):
        rep = E.run_all(WellBehavedModel(), self.db)
        failed = [(r["id"], r["failures"]) for r in rep["results"] if not r["passed"]]
        self.assertEqual(failed, [])
        self.assertEqual(rep["total"], len(E.build_cases()))
        self.assertGreaterEqual(rep["total"], 18)

    def test_bad_model_is_caught_by_many_cases(self):
        rep = E.run_all(BadModel(), self.db)
        by = {r["id"]: r for r in rep["results"]}
        self.assertLess(rep["passed"], rep["total"] - 10)
        self.assertFalse(by["train_by_number"]["passed"])
        self.assertIn("expected one of tools", by["train_by_number"]["failures"][0])
        self.assertFalse(by["injection_ignored"]["passed"])
        self.assertTrue(any("GROUND RULES" in f for f in by["injection_ignored"]["failures"]))
        self.assertFalse(by["followup_next_station_is_estimate"]["passed"])
        self.assertFalse(by["hindi_reply"]["passed"])
        self.assertTrue(any("Devanagari" in f for f in by["hindi_reply"]["failures"]))

    def test_only_filter_and_exceptions_are_reported_not_raised(self):
        rep = E.run_all(WellBehavedModel(), self.db, only="route")
        self.assertTrue(all("route" in r["id"] for r in rep["results"]))
        from app.services.ai_provider import AIProviderError
        class Down:
            name = model = "down"
            def generate(self, *a, **k): raise AIProviderError("timeout", "model timed out", 504)
        rep = E.run_all(Down(), self.db, only="train_by_number")
        self.assertFalse(rep["results"][0]["passed"])
        self.assertIn("AIProviderError", rep["results"][0]["failures"][0])    # reported, not raised
        self.assertIn("model timed out", rep["results"][0]["failures"][0])

    def test_check_turn_semantics(self):
        out = {"sources": ["get_train_route"], "blocks": [{"type": "train_route"}], "reply": "Done", "context": {"focus_train": {"trainNumber": "1"}}}
        self.assertEqual(E.check_turn(out, {"tools_any": ["get_train_route"], "blocks_all": ["train_route"], "focus_train": "1"}), [])
        self.assertTrue(E.check_turn(out, {"no_tools": True}))
        self.assertTrue(E.check_turn(out, {"blocks_none": ["train_route"]}))
        self.assertTrue(E.check_turn(out, {"reply_contains_any": ["xyz"]}))
        self.assertTrue(E.check_turn(out, {"reply_not_contains": ["done"]}))     # case-insensitive
        self.assertTrue(E.check_turn(out, {"focus_train": "2"}))


if __name__ == "__main__":
    unittest.main()
