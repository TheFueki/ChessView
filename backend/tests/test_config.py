from app.config import Settings


def test_blank_smtp_environment_values_fall_back_to_defaults():
    settings = Settings(
        _env_file=None,
        DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/chessview",
        REDIS_URL="redis://localhost:6379/0",
        STORAGE_DIR="storage",
        OAUTHLIB_INSECURE_TRANSPORT=True,
        JWT_SECRET="x" * 32,
        JWT_ALGORITHM="HS256",
        ACCESS_TOKEN_EXPIRE_MINUTES=60,
        REFRESH_TOKEN_EXPIRE_DAYS=7,
        BACKEND_URL="http://localhost:8000",
        FRONTEND_URL="http://localhost:5173",
        SMTP_PORT="",
        SMTP_USE_TLS="",
        SMTP_USE_SSL="",
        SMTP_TIMEOUT_SECONDS="",
    )

    assert settings.SMTP_PORT == 587
    assert settings.SMTP_USE_TLS is True
    assert settings.SMTP_USE_SSL is False
    assert settings.SMTP_TIMEOUT_SECONDS == 10


def test_settings_require_explicit_redis_url():
    settings = Settings(
        _env_file=None,
        DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/chessview",
        REDIS_URL="redis://localhost:6379/0",
        STORAGE_DIR="storage",
        OAUTHLIB_INSECURE_TRANSPORT=True,
        JWT_SECRET="x" * 32,
        JWT_ALGORITHM="HS256",
        ACCESS_TOKEN_EXPIRE_MINUTES=60,
        REFRESH_TOKEN_EXPIRE_DAYS=7,
        BACKEND_URL="http://localhost:8000",
        FRONTEND_URL="http://localhost:5173",
    )

    assert settings.REDIS_URL == "redis://localhost:6379/0"
