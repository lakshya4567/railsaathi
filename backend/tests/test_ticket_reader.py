import base64
import json
import unittest

from app.services import ticket_reader as tr
from tests.fake_db import FakeDB
from tests.fixtures_synthetic import TRAINS, STATIONS

JPEG = base64.b64encode(b"\xff\xd8\xff\xe0" + b"0" * 64).decode()
PNG = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 64).decode()
WEBP = base64.b64encode(b"RIFF\x00\x00\x00\x00WEBP" + b"0" * 64).decode()


class Prov:
    name = "fake"; model = "m"
    def __init__(self, reply): self.reply, self.calls = reply, []
    def generate(self, system, contents, tools, **kw):
        self.calls.append((system, contents, tools, kw))
        return {"content": {"role": "model", "parts": [{"text": self.reply}]}}


def ticket(**kw):
    base = {"isRailwayTicket": True, "trainNumber": "12810", "trainName": "TEST MAIL", "fromStation": "Raipur Jn",
            "toStation": "Nagpur", "journeyDate": "2026-11-20", "travelClass": "3A", "unclearFields": []}
    base.update(kw); return json.dumps(base)


class TicketTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeDB(TRAINS, STATIONS)

    def test_happy_path_matches_real_records_and_asks_for_confirmation(self):
        p = Prov(ticket())
        r = tr.read_ticket(p, self.db, JPEG, "image/jpeg")
        self.assertTrue(r["needsConfirmation"])
        self.assertEqual(r["match"]["train"]["trainName"], "TEST MAIL (SYNTHETIC)")     # from the DB, not the image
        self.assertEqual((r["match"]["from"]["code"], r["match"]["to"]["code"]), ("R", "NGP"))
        self.assertIs(r["routeConsistent"], True)
        self.assertEqual(r["confidence"], "high")
        self.assertIn("not a confirmed or validated booking", r["notice"])
        self.assertIn("not saved", r["notice"])
        system, contents, tools, kw = p.calls[0]
        self.assertEqual(tools, [])                                             # no database tools exposed to the vision call
        self.assertEqual(kw["response_mime_type"], "application/json")
        self.assertIn("Do NOT extract PNR", system)
        self.assertEqual(contents[0]["parts"][0]["inlineData"]["mimeType"], "image/jpeg")

    def test_not_a_ticket_does_no_lookups(self):
        r = tr.read_ticket(Prov(ticket(isRailwayTicket=False, trainNumber="12810")), self.db, PNG, "image/png")
        self.assertFalse(r["isRailwayTicket"])
        self.assertIsNone(r["match"]["train"])
        self.assertIn("does not look like a railway ticket", r["message"])
        self.assertFalse(tr.read_ticket(Prov(ticket(isRailwayTicket="yes")), self.db, PNG, "image/png")["isRailwayTicket"])   # strict boolean

    def test_uncertain_or_unknown_values_lower_confidence_and_never_invent(self):
        r = tr.read_ticket(Prov(ticket(trainName="OTHER NAME", unclearFields=["date"])), self.db, WEBP, "image/webp")
        self.assertEqual(r["confidence"], "medium")
        r = tr.read_ticket(Prov(ticket(trainNumber="55555", trainName=None)), self.db, JPEG, "image/jpeg")
        self.assertIsNone(r["match"]["train"])
        self.assertEqual(r["confidence"], "low")
        self.assertIn("could not match", r["message"])
        r = tr.read_ticket(Prov(ticket(fromStation="Nagpur", toStation="Raipur")), self.db, JPEG, "image/jpeg")
        self.assertIs(r["routeConsistent"], False)                              # wrong order for this train

    def test_name_only_matching(self):
        r = tr.read_ticket(Prov(ticket(trainNumber=None, trainName="express a")), self.db, JPEG, "image/jpeg")
        self.assertEqual(r["match"]["train"]["trainNumber"], "90001")

    def test_model_output_is_sanitised(self):
        r = tr.read_ticket(Prov("```json\n" + ticket(trainNumber="12810; drop", journeyDate="tomorrow", trainName="X" * 500,
                                                       fromStation={"$ne": 1}, unclearFields="all") + "\n```"), self.db, JPEG, "image/jpeg")
        e = r["extracted"]
        self.assertIsNone(e["trainNumber"]); self.assertIsNone(e["journeyDate"]); self.assertIsNone(e["fromStation"])
        self.assertLessEqual(len(e["trainName"]), 80)
        self.assertEqual(e["unclearFields"], [])
        for bad in ("not json", "[1,2]", "", None):
            with self.assertRaises(tr.TicketInputError):
                tr.read_ticket(Prov(bad), self.db, JPEG, "image/jpeg")

    def test_prompt_injection_inside_image_text_cannot_add_fields(self):
        r = tr.read_ticket(Prov(ticket(**{"pnr": "1234567890", "passengerName": "A B"})), self.db, JPEG, "image/jpeg")
        self.assertNotIn("pnr", json.dumps(r).lower().replace("pnr numbers", ""))
        self.assertNotIn("passengerName", json.dumps(r))

    def test_upload_validation(self):
        for img, mime in [(JPEG, "image/gif"), (JPEG, None), ("", "image/jpeg"), (None, "image/jpeg"), ("!!!notbase64", "image/jpeg"),
                          (PNG, "image/jpeg"), (JPEG, "image/png"), (base64.b64encode(b"RIFF0000XXXX" + b"0" * 30).decode(), "image/webp"),
                          (base64.b64encode(b"\xff\xd8\xff" + b"0" * (tr.MAX_IMAGE_BYTES + 10)).decode(), "image/jpeg")]:
            with self.assertRaises(tr.TicketInputError, msg=str(mime)):
                tr.read_ticket(Prov(ticket()), self.db, img, mime)

    def test_provider_errors_propagate(self):
        from app.services.ai_provider import AIProviderError
        class Bad(Prov):
            def generate(self, *a, **k): raise AIProviderError("timeout", "slow", 504)
        with self.assertRaises(AIProviderError):
            tr.read_ticket(Bad(""), self.db, JPEG, "image/jpeg")


if __name__ == "__main__":
    unittest.main()
