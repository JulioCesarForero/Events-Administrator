from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Events Administrator API"
    debug: bool = Field(default=False, validation_alias="DEBUG")

    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/events",
        validation_alias="DATABASE_URL",
    )

    jwt_secret: str = Field(default="change-me-in-production", validation_alias="JWT_SECRET")
    jwt_issuer: str = Field(default="events-administrator", validation_alias="JWT_ISSUER")
    jwt_staff_audience: str = Field(default="staff", validation_alias="JWT_STAFF_AUDIENCE")
    jwt_buyer_audience: str = Field(default="buyer", validation_alias="JWT_BUYER_AUDIENCE")
    jwt_access_ttl_minutes: int = Field(default=60, validation_alias="JWT_ACCESS_TTL_MINUTES")

    cors_origins: str = Field(default="*", validation_alias="CORS_ORIGINS")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")

    # Prefijo público cuando Nginx (u otro proxy) expone la API bajo /api (Swagger / Try it out).
    root_path: str = Field(default="", validation_alias="ROOT_PATH")

    # Idempotency store. Leave empty for in-memory (MVP); set to a Redis URL in
    # production to share the cache across replicas.
    redis_url: str = Field(default="", validation_alias="REDIS_URL")
    idempotency_ttl_seconds: int = Field(
        default=3600, validation_alias="IDEMPOTENCY_TTL_SECONDS"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
