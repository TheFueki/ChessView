from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str
    STORAGE_DIR: Path
    OAUTHLIB_INSECURE_TRANSPORT: bool

    JWT_SECRET: str
    JWT_ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int

    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GITHUB_CLIENT_ID: str
    GITHUB_CLIENT_SECRET: str
    BACKEND_URL: str
    FRONTEND_URL: str

    CORS_ORIGINS: list[str]
    FIRST_ADMIN_EMAIL: str | None = None

    @property
    def resolved_storage_dir(self) -> Path:
        if self.STORAGE_DIR.is_absolute():
            return self.STORAGE_DIR
        return BACKEND_ROOT / self.STORAGE_DIR


settings = Settings()
