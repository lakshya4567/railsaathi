"""HTTP-level tests for /api/assistant/*. Needs the normal backend environment
(FastAPI installed and a reachable MONGODB_URI, same as tests/test_api.py).
The AI service itself is replaced by mocks, so no API key or credit is used."""
import unittest
from unittest import mock

from fastapi.testclient import TestClient

from app.main import app
from app.routes import assistant as route
from app.services import assistant as svc
from app.services.ai_provider import AIProviderError
from app.services.railway_tools import DatabaseUnavailable

client = TestClient(app)
OK = {"reply": "hi", "blocks": [], "context": svc.empty_context(), "sources": [], "provider": {"name": "fake"}}


class AssistantApiTests(unittest.TestCase):
    def setUp(self):
        route._limiter._hits.clear()

    def post(self, **body):
        body.setdefault("message", "hello")
        return client.post("/api/assistant/chat", json=body)

    def test_status_never_returns_a_key(self):
        r = client.get("/api/assistant/status")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.json()), {"configured", "provider", "model"})

    def test_cors_allows_post_from_the_dev_server(self):
        r = client.options("/api/assistant/chat", headers={
            "Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
        self.assertEqual(r.status_code, 200)
        self.assertIn("POST", r.headers.get("access-control-allow-methods", ""))

    def test_success_passes_history_and_context_through(self):
        with mock.patch.object(route, "build_provider", return_value=object()), \
             mock.patch.object(svc, "chat", return_value=OK) as chat:
            r = self.post(history=[{"role": "user", "text": "a"}], context={"last_focus": "train"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["reply"], "hi")
        args = chat.call_args.args
        self.assertEqual(args[0], "hello")
        self.assertEqual(args[1], [{"role": "user", "text": "a"}])

    def test_error_mapping(self):
        cases = [
            (AIProviderError("not_configured", "setup GEMINI_API_KEY", 503), 503, "not_configured"),
            (AIProviderError("rate_limited", "busy", 429), 429, "rate_limited"),
            (AIProviderError("timeout", "slow", 504), 504, "timeout"),
            (DatabaseUnavailable("down"), 503, "database_unavailable"),
            (svc.AssistantInputError("too long"), 422, "invalid_input"),
            (RuntimeError("bug"), 500, "internal_error"),
        ]
        for exc, status, code in cases:
            with mock.patch.object(route, "build_provider", return_value=object()), \
                 mock.patch.object(svc, "chat", side_effect=exc):
                r = self.post()
            self.assertEqual(r.status_code, status, code)
            self.assertEqual(r.json()["detail"]["code"], code)
            self.assertNotIn("bug", r.json()["detail"]["message"])   # internals never leak

    def test_not_configured_is_a_clear_503_without_calling_the_model(self):
        with mock.patch.object(route.settings, "gemini_api_key", ""):
            r = self.post()
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json()["detail"]["code"], "not_configured")

    def test_request_validation(self):
        self.assertEqual(client.post("/api/assistant/chat", json={}).status_code, 422)
        self.assertEqual(self.post(message="x" * 2001).status_code, 422)
        self.assertEqual(self.post(history="nope").status_code, 422)
        self.assertEqual(client.post("/api/assistant/chat", content="not json",
                                     headers={"content-type": "application/json"}).status_code, 422)

    def test_rate_limit(self):
        with mock.patch.object(route.settings, "assistant_rate_limit_per_min", 3), \
             mock.patch.object(route, "build_provider", return_value=object()), \
             mock.patch.object(svc, "chat", return_value=OK):
            codes = [self.post().status_code for _ in range(5)]
        self.assertEqual(codes, [200, 200, 200, 429, 429])

    def test_existing_endpoints_still_work(self):
        self.assertEqual(client.get("/api/health").status_code, 200)
        self.assertEqual(client.get("/api/trains?page=1&page_size=1").status_code, 200)


if __name__ == "__main__":
    unittest.main()
