"""Google ID-token verification and per-user RailSaathi preferences."""
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from ..config import settings
from ..database import get_db

router = APIRouter(prefix="/api/account", tags=["account"])


class PreferencesPayload(BaseModel):
    home_station: dict | None = None
    language: str = Field(default="en", pattern="^(en|hi)$")
    personalization_enabled: bool = True


def verified_user(authorization: str | None):
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured yet")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in with Google to continue")
    try:
        claims = id_token.verify_oauth2_token(
            authorization[7:].strip(), google_requests.Request(), settings.google_client_id
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Google sign-in token is invalid or expired")
    if not claims.get("sub") or not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="A verified Google account is required")
    return {
        "google_sub": claims["sub"], "email": claims.get("email", ""),
        "name": claims.get("name", ""), "picture": claims.get("picture", ""),
    }


@router.get("/me")
def get_me(authorization: str | None = Header(default=None)):
    user = verified_user(authorization)
    profile = get_db()["user_profiles"].find_one({"google_sub": user["google_sub"]}, {"_id": 0}) or {}
    return {
        "user": {key: user[key] for key in ("email", "name", "picture")},
        "preferences": profile.get("preferences", {
            "home_station": None, "language": "en", "personalization_enabled": True
        }),
    }


@router.put("/me/preferences")
def save_preferences(payload: PreferencesPayload, authorization: str | None = Header(default=None)):
    user = verified_user(authorization)
    home = payload.home_station
    if home is not None:
        code = home.get("code") if isinstance(home, dict) else None
        name = home.get("name") if isinstance(home, dict) else None
        if not isinstance(code, str) or not (1 <= len(code) <= 10):
            raise HTTPException(status_code=422, detail="Invalid home station")
        home = {"code": code.upper(), "name": str(name or "")[:80]}
    preferences = {
        "home_station": home, "language": payload.language,
        "personalization_enabled": payload.personalization_enabled,
    }
    get_db()["user_profiles"].update_one(
        {"google_sub": user["google_sub"]},
        {"$set": {
            "google_sub": user["google_sub"], "email": user["email"],
            "name": user["name"], "picture": user["picture"], "preferences": preferences,
        }},
        upsert=True,
    )
    return {"preferences": preferences}
