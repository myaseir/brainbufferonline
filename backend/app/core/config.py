from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # 1. App Settings
    PROJECT_NAME: str = "Glacia Labs - Brain Buffer"
    VERSION: str = "1.1.0"
    API_V1_STR: str = "/api" 
    
    # 2. Security
    # These should be long random strings in your Render Environment Variables
    SECRET_KEY: str = Field(default="dev-secret-key-change-this")
    ADMIN_SECRET_KEY: str = Field(default="dev-admin-key-change-this") 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # 3. MongoDB Configuration
    # Fallback to localhost for dev, but Render will inject the real URL
    MONGO_URL: str = Field(default="mongodb://localhost:27017")
    DATABASE_NAME: str = "brain_buffer"

    # 4. Redis Configuration
    # IMPORTANT: Render's Redis URL starts with 'rediss://' (with two 's's for SSL)
    # Ensure your code handles 'rediss://' if using Render Managed Redis
    REDIS_URL: str = Field(default="redis://localhost:6379")

    # 5. Email Configuration
    EMAIL_USER: str = Field(default="")
    EMAIL_PASS: str = Field(default="")
    
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_PORT: int = 587
    MAIL_USE_TLS: bool = True

    # 6. Environment Config
    model_config = SettingsConfigDict(
        # This tells Pydantic to check Environment Variables FIRST, then .env
        env_file=".env", 
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra="ignore" 
    )

settings = Settings()