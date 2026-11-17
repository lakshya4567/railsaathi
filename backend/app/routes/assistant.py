"""
assistant.py — HTTP endpoints for the AI journey assistant.

POST /api/assistant/chat     one conversation turn (JSON response)
POST /api/assistant/stream   same, as server-sent events: progress steps, then the result
POST /api/assistant/ticket   read a ticket photo (image is processed in memory only)
GET  /api/assistant/status   is the AI configured? (never returns the key)
"""
import json
import logging
import queue
import threading
import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..config import settings
from ..database import get_db
from ..services import assistant as assistant_service
from ..services import ticket_reader
from ..services.ai_provider import AIProviderError, build_provider, is_configured
from ..services.railway_tools import DatabaseUnavailable

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class HistoryItem(BaseModel):
    role: str = Field(..., max_length=12)
    text: str = Field(..., max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=2000)   # tighter limit enforced in the service
    history: list[HistoryItem] = Field(default_factory=list, max_length=40)
    context: dict | None = None
    language: str = Field("en", max_length=5)
    preferences: dict | None = None


class TicketRequest(BaseModel):
    image_base64: str = Field(..., max_length=6_000_000)
    mime_type: str = Field(..., max_length=20)


class _RateLimiter:
    """Small in-memory sliding window per key (protects your AI quota)."""

    def __init__(self):
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window: float = 60.0) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > window:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            if len(self._hits) > 5000:           # keep memory bounded
                for k in [k for k, v in self._hits.items() if not v][:1000]:
                    self._hits.pop(k, None)
            return True


_limiter = _RateLimiter()


def _err(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def _check_limits(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    if not _limiter.allow(ip, max(1, settings.assistant_rate_limit_per_min)):
        raise _err(429, "too_many_requests", "You are sending messages too quickly. Please wait a moment.")
    if not _limiter.allow(ip + ":day", max(1, settings.assistant_daily_limit), 86400.0):
        raise _err(429, "daily_limit", "The daily assistant limit for this connection has been reached. Please try again tomorrow.")


def _map_exception(exc: Exception) -> tuple[int, str, str]:
    """(http_status, code, user-safe message) for anything the assistant can raise."""
    if isinstance(exc, assistant_service.AssistantInputError):
        return 422, "invalid_input", str(exc)
    if isinstance(exc, ticket_reader.TicketInputError):
        return 422, "invalid_image", str(exc)
    if isinstance(exc, AIProviderError):
        return exc.http_status, exc.code, exc.message
    if isinstance(exc, DatabaseUnavailable):
        logger.error("Assistant: MongoDB unavailable")
        return 503, "database_unavailable", ("The railway database is unreachable right now, so I can't look anything up. "
                                             "Please try again shortly.")
    logger.error("Assistant failed unexpectedly", exc_info=exc)
    return 500, "internal_error", "Something went wrong while answering. Please try again."


def _run_chat(body: ChatRequest, on_event=None) -> dict:
    provider = build_provider(settings)
    return assistant_service.chat(
        body.message, [h.model_dump() for h in body.history], body.context, provider=provider,
        run_tool=assistant_service.cached_run_tool, language=body.language,
        preferences=body.preferences, on_event=on_event)


@router.get("/status")
def assistant_status():
    return {"configured": is_configured(settings), "provider": settings.ai_provider,
            "model": settings.gemini_model if settings.ai_provider == "gemini" else None,
            "dailyLimit": settings.assistant_daily_limit}


@router.post("/chat")
def chat(body: ChatRequest, request: Request):
    _check_limits(request)
    try:
        return _run_chat(body)
    except Exception as exc:  # noqa: BLE001
        status, code, message = _map_exception(exc)
        raise _err(status, code, message)


@router.post("/stream")
def chat_stream(body: ChatRequest, request: Request):
    """Server-sent events: `status` (progress lines), then `result` or `error`."""
    _check_limits(request)
    events: queue.Queue = queue.Queue()

    def worker():
        try:
            result = _run_chat(body, on_event=lambda e: events.put(("status", e)))
            events.put(("result", result))
        except Exception as exc:  # noqa: BLE001
            status, code, message = _map_exception(exc)
            events.put(("error", {"code": code, "message": message, "status": status}))
        finally:
            events.put(None)

    threading.Thread(target=worker, daemon=True).start()

    def generate():
        while True:
            try:
                item = events.get(timeout=15)
            except queue.Empty:
                yield ": keep-alive\n\n"          # stops proxies closing an idle connection
                continue
            if item is None:
                return
            name, data = item
            yield f"event: {name}\ndata: {json.dumps(data, default=str, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/ticket")
def read_ticket(body: TicketRequest, request: Request):
    _check_limits(request)
    try:
        provider = build_provider(settings)
        return {"ticket": ticket_reader.read_ticket(provider, get_db(), body.image_base64, body.mime_type)}
    except Exception as exc:  # noqa: BLE001
        status, code, message = _map_exception(exc)
        raise _err(status, code, message)
