"""
Configuration settings for the screener service.
Uses pydantic-settings for environment variable loading.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server settings
    port: int = 8001
    host: str = "0.0.0.0"
    log_level: str = "info"

    # App info
    app_name: str = "TV Screener Service"
    app_version: str = "0.1.0"

    class Config:
        env_prefix = "SCREENER_SERVICE_"
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
