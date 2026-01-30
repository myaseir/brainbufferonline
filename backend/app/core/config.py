from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os

class Settings(BaseSettings):
    # 1. App Settings
    PROJECT_NAME: str = "Glacia Labs - Brain Buffer"
    VERSION: str = "1.1.0"
    # Tip: If your frontend is calling /api/, make sure this matches your router prefixes
    API_V1_STR: str = "/api" 
    
    # 2. Security (JWT & Admin)
    # IMPORTANT: On Render, set these in the 'Environment' tab, don't leave defaults
    SECRET_KEY: str = Field(default="super-secret-key-for-numl-project")
    ADMIN_SECRET_KEY: str = Field(default="glacia_admin_2026_safe") 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week

    # 3. MongoDB Configuration
    # Render uses an environment variable for Mongo (e.g., MONGO_URL or DATABASE_URL)
    MONGO_URL: str = Field(default="mongodb://localhost:27017")
    DATABASE_NAME: str = "brain_buffer"

    # 4. Redis Configuration
    REDIS_URL: str = Field(default="redis://localhost:6379")

    # 5. Email Configuration
    # By using Field(default=...), Pydantic will first look for an 
    # Environment Variable named EMAIL_USER before using the default.
    EMAIL_USER: str = Field(default="techglacia@gmail.com")
    EMAIL_PASS: str = Field(default="veyrigopokjsckhw")

    # 6. Environment Config
    model_config = SettingsConfigDict(
        # env_file is great for local, but Render will inject vars directly
        env_file=".env", 
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra="ignore" 
    )

# Create a single instance
settings = Settings()