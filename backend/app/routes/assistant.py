"""
assistant.py — HTTP endpoints for the AI journey assistant.

POST /api/assistant/chat    one conversation turn
GET  /api/assistant/status  is the AI configured? (never returns the key)
"""
import logging
import threading
import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..config import settings
from ..services import assistant as assistant_service
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


class _RateLimiter:
    """Small in-memory sliding window per client IP (protects your AI quota)."""

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


@router.get("/status")
def assistant_status():
    return {"configured": is_configured(settings), "provider": settings.ai_provider,
            "model": settings.gemini_model if settings.ai_provider == "gemini" else None}


@router.post("/chat")
def chat(body: ChatRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    if not _limiter.allow(ip, max(1, settings.assistant_rate_limit_per_min)):
        raise _err(429, "too_many_requests", "You are sending messages too quickly. Please wait a moment.")
    try:
        provider = build_provider(settings)
        return assistant_service.chat(
            body.message, [h.model_dump() for h in body.history], body.context, provider=provider)
    except assistant_service.AssistantInputError as exc:
        raise _err(422, "invalid_input", str(exc))
    except AIProviderError as exc:
        raise _err(exc.http_status, exc.code, exc.message)
    except DatabaseUnavailable:
        logger.error("Assistant: MongoDB unavailable")
        raise _err(503, "database_unavailable",
                   "The railway database is unreachable right now, so I can't look anything up. Please try again shortly.")
    except Exception:  # noqa: BLE001
        logger.exception("Assistant failed unexpectedly")
        raise _err(500, "internal_error", "Something went wrong while answering. Please try again.")
