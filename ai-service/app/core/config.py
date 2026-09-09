from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    """Configuration settings for the HypothesiAI Python AI Service."""
    
    PROJECT_NAME: str = "HypothesiAI AI Engine"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Server configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v
    
    # Backend Gateway link
    BACKEND_INTERNAL_URL: str = "http://localhost:5000"
    
    # Resource & Device configuration
    DEVICE: str = "auto"  # 'auto', 'cpu', 'cuda', 'mps'
    MAX_WORKERS: int = 4
    BATCH_SIZE: int = 32
    ENABLE_NEURAL_FALLBACK: bool = True
    
    # Model storage / cache directory
    MODEL_CACHE_DIR: str = ".cache/models"
    
    # Model identifier settings
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    NLI_MODEL_NAME: str = "cross-encoder/nli-distilroberta-base"
    
    # LLM Provider configuration
    LLM_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    
    # PostgreSQL Configuration
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "hypothesiai"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgrespassword"
    DATABASE_URL: str = ""
    
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
