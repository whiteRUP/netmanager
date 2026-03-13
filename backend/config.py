from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    backend_port: int = 3345
    database_url: str = "sqlite+aiosqlite:////app/data/netmanager.db"
    integrations_config: str = "/app/config/integrations.json"
    jwt_algorithm: str = "HS256"
    # Secret key auto-generated on first run and stored in DB
    # No credentials here — all set via setup wizard

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
