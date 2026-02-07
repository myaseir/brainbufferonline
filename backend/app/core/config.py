from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # 1. App Settings
    PROJECT_NAME: str = "Glacia Labs"
    VERSION: str = "1.2.0"
    API_V1_STR: str = "/api" 
    
    # 2. Security
    SECRET_KEY: str = Field(default="dev-secret-key-change-this")
    ADMIN_SECRET_KEY: str = Field(default="dev-admin-key-change-this") 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # 3. MongoDB Configuration
    MONGO_URL: str = Field(default="mongodb://localhost:27017")
    DATABASE_NAME: str = "brain_buffer"

    # 4. Redis Configuration (Standard + Upstash)
    # ✅ FIX: This was missing and caused the crash in main.py
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    
    # Legacy Upstash (Optional)
    UPSTASH_REDIS_REST_URL: str = Field(default="")
    UPSTASH_REDIS_REST_TOKEN: str = Field(default="")

    # 5. Brevo Email Configuration
    BREVO_API_KEY: str = Field(default="") 
    SENDER_EMAIL: str = Field(default="support@brainbufferofficial.com")
    SENDER_NAME: str = Field(default="Brain Buffer Support")
    
    LATEST_MOBILE_VERSION: str = Field(default="2.0.0")
    MIN_REQUIRED_MOBILE_VERSION: str = Field(default="1.0.0")
    MOBILE_DOWNLOAD_URL: str = Field(default="https://www.brainbufferofficial.com")

    # 6. Environment Config
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra="ignore" 
    )

settings = Settings()