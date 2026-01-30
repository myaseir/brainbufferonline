from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # 1. App Settings
    PROJECT_NAME: str = "Glacia Labs - Brain Buffer"
    VERSION: str = "1.1.0"
    API_V1_STR: str = "/api" 
    
    # 2. Security
    # In Render, change these! Defaults are only for local dev.
    SECRET_KEY: str = Field(default="super-secret-key-for-numl-project")
    ADMIN_SECRET_KEY: str = Field(default="glacia_admin_2026_safe") 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # 3. MongoDB Configuration
    # Render will override this if you set MONGO_URL in the Dashboard
    MONGO_URL: str = Field(default="mongodb://localhost:27017")
    DATABASE_NAME: str = "brain_buffer"

    # 4. Redis Configuration
    # The 'Matchmaking Exception' in your logs is likely because REDIS_URL 
    # is still pointing to localhost. Render provides a REDIS_URL environment variable.
    REDIS_URL: str = Field(default="redis://localhost:6379")

    # 5. Email Configuration
    EMAIL_USER: str = Field(default="techglacia@gmail.com")
    EMAIL_PASS: str = Field(default="veyrigopokjsckhw")
    
    # NEW: Email Port settings for Render compatibility
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_PORT: int = 587  # Use 587 for TLS (Render friendly)
    MAIL_USE_TLS: bool = True

    # 6. Environment Config
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra="ignore" 
    )

settings = Settings()