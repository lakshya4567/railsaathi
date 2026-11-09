"""
config.py — reads settings from backend/.env via pydantic-settings.
All settings are read at import time; no secrets are ever forwarded to the frontend.
"""
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    mongodb_uri: str = Field(..., alias="MONGODB_URI")
    db_name: str = Field("indian_railway", alias="DB_NAME")
    allowed_origins: str = Field("http://localhost:5173", alias="ALLOWED_ORIGINS")

    # --- AI journey assistant (all optional: the rest of the API works without them) ---
    ai_provider: str = Field("gemini", alias="AI_PROVIDER")
    gemini_api_key: str = Field("", alias="GEMINI_API_KEY")
    gemini_model: str = Field("gemini-2.5-flash", alias="GEMINI_MODEL")
    ai_timeout_seconds: float = Field(30.0, alias="AI_TIMEOUT_SECONDS")
    assistant_rate_limit_per_min: int = Field(20, alias="ASSISTANT_RATE_LIMIT_PER_MIN")

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
