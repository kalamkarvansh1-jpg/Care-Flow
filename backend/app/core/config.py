"""CareFlow FastAPI Backend Configuration.

Loads environment variables using Pydantic Settings with strict validation and safe defaults.
"""

from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class CareFlowSettings(BaseSettings):
    """Application runtime settings loaded from environment variables with safe defaults."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = Field(default="CareFlow Clinical Pathway API", description="Service application name")
    APP_VERSION: str = Field(default="1.0.0", description="Semantic service version")
    ENVIRONMENT: str = Field(default="development", description="Runtime environment (development, staging, production)")
    DEBUG: bool = Field(default=False, description="Debug mode toggle")
    API_V1_PREFIX: str = Field(default="/api/v1", description="Version 1 API route prefix")

    ALLOWED_ORIGINS: Union[List[str], str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
        description="Explicit allowed CORS origin domains",
    )

    HOST: str = Field(default="127.0.0.1", description="Bind host")
    PORT: int = Field(default=8000, description="Bind port")

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = CareFlowSettings()
