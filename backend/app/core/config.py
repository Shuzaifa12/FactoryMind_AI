import re
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FactoryMind AI Backend"
    app_version: str = "0.1.0"
    environment: str = "development"
    log_level: str = "INFO"

    # Database
    database_url: str = "sqlite:///./factorymind.db"

    # CORS
    cors_origins: str = "http://localhost:3000"

    # File uploads
    max_upload_mb: int = 10
    upload_dir: str = "./uploads"

    # AI Configuration (optional & provider-independent)
    ai_provider: str | None = None
    ai_api_key: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        if not self.cors_origins:
            return []
        origins = [orig.strip() for orig in self.cors_origins.split(",") if orig.strip()]
        return origins

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def sqlalchemy_database_url(self) -> str:
        url = self.database_url
        # If using standard postgresql:// URL, convert to psycopg3 driver prefix
        if url.startswith(("postgresql://", "postgres://")):
            url = re.sub(r"^postgres(ql)?://", "postgresql+psycopg://", url)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
