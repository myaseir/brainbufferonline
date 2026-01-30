from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # 1. App Settings
    PROJECT_NAME: str = "Glacia Labs - Brain Buffer"
    VERSION: str = "1.1.0"
    API_V1_STR: str = "/api" 
    
    # 2. Security
    # Set these as ENV VARS on Render for production safety
    SECRET_KEY: str = Field(default="dev-secret-key-change-this")
    ADMIN_SECRET_KEY: str = Field(default="dev-admin-key-change-this") 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # 3. MongoDB Configuration
    MONGO_URL: str = Field(default="mongodb://localhost:27017")
    DATABASE_NAME: str = "brain_buffer"

    # 4. Redis Configuration
    REDIS_URL: str = Field(default="redis://localhost:6379")

    # 5. Resend Email Configuration (API based - bypasses Render's SMTP block)
    # Pydantic will automatically look for an ENV VAR named RESEND_API_KEY
    RESEND_API_KEY: str = Field(default="")

    # 6. Environment Config
    model_config = SettingsConfigDict(
        # Pydantic reads .env first, but OS Environment Variables (Render) 
        # will ALWAYS override the .env file.
        env_file=".env", 
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra="ignore" 
    )

# Create the settings instance
settings = Settings()