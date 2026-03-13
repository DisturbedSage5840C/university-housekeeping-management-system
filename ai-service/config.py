"""
ILGC Tracker - AI/ML Service Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "ILGC AI Service"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4

    # API Security
    API_KEY: str = "your-internal-ai-service-key"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3001", "http://localhost:3000"]

    # OpenAI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4-turbo"
    OPENAI_MAX_TOKENS: int = 2000
    OPENAI_TEMPERATURE: float = 0.3

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://ilgc_admin:password@postgres:5432/ilgc_tracker"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"
    CACHE_TTL: int = 3600  # 1 hour

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # ML Models
    MODEL_DIR: str = "/app/ai-service/models/saved"
    TRAINING_DATA_DIR: str = "/app/ai-service/data"

    # Logging
    LOG_LEVEL: str = "INFO"
    SENTRY_DSN: Optional[str] = None

    # NLP
    SPACY_MODEL: str = "en_core_web_sm"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
