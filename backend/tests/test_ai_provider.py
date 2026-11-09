"""Tests for app/services/ai_provider.py using a fake HTTP transport (no network)."""
import json
import socket
import unittest
import urllib.error
from types import SimpleNamespace

from app.services.ai_provider import AIProviderError, GeminiProvider, build_provider, is_configured

SECRET = "AIza-TEST-SECRET-KEY-123"


def ok(parts, finish="STOP"):
    return 200, json.dumps({"candidates": [{"content": {"role": "model", "parts": parts}, "finishReason": finish}]}).encode()


class ProviderTests(unittest.TestCase):
    def provider(self, transport):
        return GeminiProvider(SECRET, "gemini-test-model", 5.0, transport=transport)

    def gen(self, transport, **kw):
        return self.provider(transport).generate("sys", [{"role": "user", "parts": [{"text": "hi"}]}],
                                                 kw.get("tools", []))

    def test_request_shape_and_key_only_in_header(self):
        seen = {}

        def transport(url, headers, body, timeout):
            seen.update(url=url, headers=headers, body=json.loads(body), timeout=timeout)
            return ok([{"text": "hello"}])

        tools = [{"name": "t", "description": "d", "parameters": {"type": "object", "properties": {}}}]
        out = self.gen(transport, tools=tools)
        self.assertEqual(out["content"]["parts"], [{"text": "hello"}])
        self.assertIn("/v1beta/models/gemini-test-model:generateContent", seen["url"])
        self.assertEqual(seen["headers"]["x-goog-api-key"], SECRET)
        self.assertNotIn(SECRET, seen["url"])
        self.assertNotIn(SECRET, json.dumps(seen["body"]))
        self.assertEqual(seen["body"]["systemInstruction"]["parts"][0]["text"], "sys")
        self.assertEqual(seen["body"]["tools"][0]["functionDeclarations"], tools)
        self.assertEqual(seen["body"]["toolConfig"]["functionCallingConfig"]["mode"], "AUTO")
        self.assertEqual(seen["timeout"], 5.0)

    def test_no_tools_means_no_tool_config(self):
        seen = {}
        def transport(url, headers, body, timeout):
            seen["body"] = json.loads(body); return ok([{"text": "x"}])
        self.gen(transport)
        self.assertNotIn("tools", seen["body"])

    def test_thought_signatures_and_function_calls_are_returned_verbatim(self):
        parts = [{"functionCall": {"name": "get_train_details", "args": {"train_number": "12810"}},
                  "thoughtSignature": "SIG=="}]
        out = self.gen(lambda *a: ok(parts))
        self.assertEqual(out["content"]["parts"], parts)

    def assert_error(self, transport, code, status=None, forbid=SECRET):
        with self.assertRaises(AIProviderError) as cm:
            self.gen(transport)
        self.assertEqual(cm.exception.code, code)
        if status:
            self.assertEqual(cm.exception.http_status, status)
        self.assertNotIn(forbid, cm.exception.message)
        return cm.exception

    def test_http_errors_are_mapped_and_never_leak_the_key(self):
        def http(status, msg=""):
            body = json.dumps({"error": {"message": msg}}).encode()
            return lambda *a: (status, body)
        self.assert_error(http(400, f"API key not valid. Please pass a valid API key {SECRET}"), "auth", 502)
        self.assert_error(http(401), "auth")
        self.assert_error(http(403), "auth")
        self.assert_error(http(429), "rate_limited", 429)
        e = self.assert_error(http(404), "bad_request")
        self.assertIn("GEMINI_MODEL", e.message)
        self.assert_error(http(400, "bad schema"), "bad_request")
        self.assert_error(http(500), "unavailable", 503)
        self.assert_error(http(503), "unavailable", 503)
        self.assert_error(lambda *a: (302, b""), "bad_response")

    def test_network_problems(self):
        def boom(exc):
            def t(*a): raise exc
            return t
        self.assert_error(boom(TimeoutError()), "timeout", 504)
        self.assert_error(boom(socket.timeout()), "timeout", 504)
        self.assert_error(boom(urllib.error.URLError("dns")), "network", 502)
        self.assert_error(boom(ConnectionResetError()), "network", 502)

    def test_bad_bodies(self):
        self.assert_error(lambda *a: (200, b"<html>not json"), "bad_response")
        self.assert_error(lambda *a: (200, b"{}"), "bad_response")
        self.assert_error(lambda *a: (200, json.dumps({"promptFeedback": {"blockReason": "SAFETY"}}).encode()), "blocked", 422)
        self.assert_error(lambda *a: ok([], finish="SAFETY"), "blocked", 422)

    def test_build_provider_configuration(self):
        def s(**kw):
            base = dict(ai_provider="gemini", gemini_api_key=SECRET, gemini_model="m", ai_timeout_seconds=7)
            base.update(kw); return SimpleNamespace(**base)
        p = build_provider(s())
        self.assertEqual((p.name, p.model, p.timeout), ("gemini", "m", 7.0))
        for bad in ("", "   ", "your-google-ai-studio-key-here", "<key>", "changeme"):
            with self.assertRaises(AIProviderError) as cm:
                build_provider(s(gemini_api_key=bad))
            self.assertEqual(cm.exception.code, "not_configured")
            self.assertEqual(cm.exception.http_status, 503)
            self.assertIn("GEMINI_API_KEY", cm.exception.message)
        with self.assertRaises(AIProviderError) as cm:
            build_provider(s(ai_provider="openai"))
        self.assertIn("not supported", cm.exception.message)
        self.assertTrue(is_configured(s()))
        self.assertFalse(is_configured(s(gemini_api_key="")))


if __name__ == "__main__":
    unittest.main()
