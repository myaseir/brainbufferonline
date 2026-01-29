from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # 1. App Settings
    PROJECT_NAME: str = "Glacia Labs - Brain Buffer"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # 2. Security (JWT & Admin)
    SECRET_KEY: str = Field(default="super-secret-key-for-numl-project")
    # Add the Admin Key here so Pydantic recognizes it
    ADMIN_SECRET_KEY: str = Field(default="glacia_admin_2026_safe") 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week

    # 3. MongoDB Configuration
    MONGO_URL: str = Field(default="mongodb://localhost:27017")
    DATABASE_NAME: str = "brain_buffer_db"

    # 4. Redis Configuration
    REDIS_URL: str = Field(default="redis://localhost:6379")

    # 5. Safepay Sandbox Keys
    # Use Optional or provide a default if they aren't always in your .env yet
    SAFEPAY_API_KEY: str = Field(default="your-key-here")
    SAFEPAY_WEBHOOK_SECRET: str = Field(default="your-secret-here")
    SAFEPAY_BASE_URL: str = "https://sandbox.api.getsafepay.com"

    # 6. Environment Config
    # extra="ignore" is the magic line that stops the "Extra inputs" crash
    model_config = SettingsConfigDict(
        env_file=".env", 
        case_sensitive=True,
        extra="ignore" 
    )

# Create a single instance to be used everywhere
settings = Settings()