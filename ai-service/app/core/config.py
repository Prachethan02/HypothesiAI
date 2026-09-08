from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration settings for the HypothesiAI Python AI Service."""
    
    PROJECT_NAME: str = "HypothesiAI AI Engine"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Server configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5000",
    ]
    
    # Backend Gateway link
    BACKEND_INTERNAL_URL: str = "http://localhost:5000"
    
    # Model storage / cache directory
    MODEL_CACHE_DIR: str = ".cache/models"
    
    # Future Stage Model settings
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    NLI_MODEL_NAME: str = "cross-encoder/nli-distilroberta-base"
    
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
