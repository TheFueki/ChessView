from pathlib import Path

from typing import Any

from pydantic import ValidationInfo, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str
    REDIS_URL: str
    STORAGE_DIR: Path
    OAUTHLIB_INSECURE_TRANSPORT: bool

    JWT_SECRET: str
    JWT_ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    BACKEND_URL: str
    FRONTEND_URL: str

    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
    FIRST_ADMIN_EMAIL: str | None = None
    SEED_ADMIN_EMAIL: str = "admin@chessview.app"
    SEED_ADMIN_USERNAME: str = "admin"
    SEED_ADMIN_PASSWORD: str = "admin123"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "no-reply@chessview.local"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    SMTP_TIMEOUT_SECONDS: int = 10

    @field_validator("SMTP_PORT", "SMTP_USE_TLS", "SMTP_USE_SSL", "SMTP_TIMEOUT_SECONDS", mode="before")
    @classmethod
    def blank_smtp_values_use_defaults(cls, value: Any, info: ValidationInfo) -> Any:
        if value == "":
            return cls.model_fields[info.field_name].default
        return value

    @property
    def resolved_storage_dir(self) -> Path:
        if self.STORAGE_DIR.is_absolute():
            return self.STORAGE_DIR
        return BACKEND_ROOT / self.STORAGE_DIR

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        raw = self.CORS_ORIGINS.strip()
        if not raw:
            return ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"]
        if raw.startswith("["):
            import json

            parsed = json.loads(raw)
            return [str(origin).strip() for origin in parsed if str(origin).strip()]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


settings = Settings()
