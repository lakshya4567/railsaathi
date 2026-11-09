"""
ai_provider.py — talks to the AI model. Runs ONLY on the backend.

* The API key is read from the environment (backend/.env) via config.settings and is
  sent in a request header. It is never returned to the browser, never logged and
  never placed in an error message.
* Uses only the Python standard library (urllib), so there is no new dependency.
* Provider is chosen with AI_PROVIDER. Only "gemini" (Google AI Studio) exists today;
  adding another provider means adding one class with the same `generate()` method.
"""
from __future__ import annotations

import json
import logging
import socket
import urllib.error
import urllib.request
from typing import Any, Callable

logger = logging.getLogger(__name__)

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com"
GEMINI_API_VERSION = "v1beta"


class AIProviderError(Exception):
    """A problem talking to the AI provider, with a user-safe message.

    `code` is machine readable (not_configured, auth, rate_limited, timeout,
    network, unavailable, blocked, bad_request, bad_response); `http_status` is the
    status our own API should answer with.
    """

    def __init__(self, code: str, message: str, http_status: int = 502):
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status


# transport(url, headers, body_bytes, timeout) -> (status_code, response_bytes)
Transport = Callable[[str, dict, bytes, float], "tuple[int, bytes]"]


def _urllib_transport(url: str, headers: dict, body: bytes, timeout: float) -> tuple[int, bytes]:
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (https URL built in code)
            return resp.status, resp.read()
    except urllib.error.HTTPError as err:
        return err.code, err.read() or b""


def _provider_message(raw: bytes) -> str:
    """Pull a short, key-free message out of a provider error body."""
    try:
        data = json.loads(raw.decode("utf-8", "replace"))
        msg = data.get("error", {}).get("message") or ""
    except (ValueError, AttributeError):
        msg = ""
    return msg[:200]


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str, model: str, timeout: float = 30.0,
                 transport: Transport | None = None, base_url: str = GEMINI_BASE_URL):
        self._api_key = api_key
        self.model = model
        self.timeout = timeout
        self._transport = transport or _urllib_transport
        self._base_url = base_url.rstrip("/")

    def generate(self, system: str, contents: list[dict], tool_declarations: list[dict],
                 temperature: float = 0.2, max_output_tokens: int = 1024) -> dict:
        """One model call. Returns {"content": {...model content with parts...}, "finish_reason": str|None}.

        `contents` follows Gemini's format. When the model asked for tools, the
        returned content (including any thoughtSignature fields) must be sent back
        unchanged on the next call — the caller does that.
        """
        body: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": contents,
            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_output_tokens},
        }
        if tool_declarations:
            body["tools"] = [{"functionDeclarations": tool_declarations}]
            body["toolConfig"] = {"functionCallingConfig": {"mode": "AUTO"}}

        url = f"{self._base_url}/{GEMINI_API_VERSION}/models/{self.model}:generateContent"
        headers = {"Content-Type": "application/json", "x-goog-api-key": self._api_key}
        try:
            status, raw = self._transport(url, headers, json.dumps(body).encode("utf-8"), self.timeout)
        except (socket.timeout, TimeoutError):
            raise AIProviderError("timeout", "The AI service took too long to answer. Please try again.", 504)
        except (urllib.error.URLError, OSError):
            logger.warning("AI provider network error")
            raise AIProviderError("network", "Could not reach the AI service. Check the server's internet connection.", 502)

        if status != 200:
            self._raise_for_status(status, raw)

        try:
            data = json.loads(raw.decode("utf-8"))
        except ValueError:
            raise AIProviderError("bad_response", "The AI service returned an unreadable response.", 502)

        candidates = data.get("candidates") or []
        if not candidates:
            reason = (data.get("promptFeedback") or {}).get("blockReason")
            if reason:
                raise AIProviderError("blocked", "The AI service declined to answer that request.", 422)
            raise AIProviderError("bad_response", "The AI service returned no answer.", 502)

        cand = candidates[0]
        content = cand.get("content") or {}
        parts = content.get("parts") or []
        finish = cand.get("finishReason")
        if not parts and finish in ("SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"):
            raise AIProviderError("blocked", "The AI service declined to answer that request.", 422)
        return {"content": {"role": "model", "parts": parts}, "finish_reason": finish}

    @staticmethod
    def _raise_for_status(status: int, raw: bytes) -> None:
        detail = _provider_message(raw)
        low = detail.lower()
        logger.warning("AI provider HTTP %s: %s", status, detail)  # message only; never the key
        if status in (401, 403) or "api key" in low or "api_key" in low:
            raise AIProviderError("auth", "The AI service rejected the API key. Check GEMINI_API_KEY in backend/.env.", 502)
        if status == 429:
            raise AIProviderError("rate_limited", "The AI service is busy or the quota is used up. Please try again shortly.", 429)
        if status == 404:
            raise AIProviderError("bad_request", "The configured AI model was not found. Check GEMINI_MODEL in backend/.env.", 502)
        if status == 400:
            raise AIProviderError("bad_request", "The AI service could not process that request.", 502)
        if status >= 500:
            raise AIProviderError("unavailable", "The AI service is temporarily unavailable. Please try again.", 503)
        raise AIProviderError("bad_response", f"Unexpected response from the AI service (HTTP {status}).", 502)


def _looks_like_placeholder(value: str) -> bool:
    v = (value or "").strip().lower()
    return (not v) or v.startswith("your-") or "<" in v or v in ("changeme", "xxx", "todo")


def build_provider(settings, transport: Transport | None = None):
    """Create the configured provider or raise AIProviderError('not_configured')."""
    name = (getattr(settings, "ai_provider", "gemini") or "gemini").strip().lower()
    if name != "gemini":
        raise AIProviderError("not_configured",
                              f"AI_PROVIDER '{name}' is not supported. Supported: gemini.", 503)
    key = getattr(settings, "gemini_api_key", "")
    if _looks_like_placeholder(key):
        raise AIProviderError(
            "not_configured",
            "The AI assistant is not configured yet. Add GEMINI_API_KEY to backend/.env "
            "(see .env.example) and restart the backend.", 503)
    return GeminiProvider(
        api_key=key.strip(),
        model=(getattr(settings, "gemini_model", "") or "gemini-2.5-flash").strip(),
        timeout=float(getattr(settings, "ai_timeout_seconds", 30.0)),
        transport=transport,
    )


def is_configured(settings) -> bool:
    try:
        build_provider(settings)
        return True
    except AIProviderError:
        return False
