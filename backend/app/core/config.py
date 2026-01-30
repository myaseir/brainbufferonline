from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # 1. App Settings
    PROJECT_NAME: str = "Glacia Labs - Brain Buffer"
    VERSION: str = "1.1.0"
    API_V1_STR: str = "/api/v1"
    
    # 2. Security (JWT & Admin)
    SECRET_KEY: str = Field(default="super-secret-key-for-numl-project")
    ADMIN_SECRET_KEY: str = Field(default="glacia_admin_2026_safe") 
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week

    # 3. MongoDB Configuration
    MONGO_URL: str = Field(default="mongodb://localhost:27017")
    DATABASE_NAME: str = "brain_buffer"

    # 4. Redis Configuration
    REDIS_URL: str = Field(default="redis://localhost:6379")

    # ✅ 5. Email Configuration (Fetched from .env)
    EMAIL_USER: str = Field(default="techglacia@gmail.com")
    EMAIL_PASS: str = Field(default="veyrigopokjsckhw")

    # 6. Environment Config
    model_config = SettingsConfigDict(
        env_file=".env", 
        case_sensitive=True,
        extra="ignore" 
    )

# Create a single instance to be used everywhere
settings = Settings()