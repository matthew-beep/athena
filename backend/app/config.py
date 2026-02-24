from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "athena"
    postgres_user: str = "athena"
    db_password: str = "changeme"

    # Ollama
    ollama_host: str = "localhost"
    ollama_port: int = 11434
    ollama_model: str = "qwen2.5:7b"
    ollama_embed_model: str = "nomic-embed-text"

    # Qdrant
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333

    # Auth
    jwt_secret_key: str = "supersecretkey-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    # App
    log_level: str = "INFO"
    seed_admin_password: str = "athena"

    # RAG
    rag_top_k: int = 6
    rag_threshold: float = 0.35

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.db_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def ollama_base_url(self) -> str:
        return f"http://{self.ollama_host}:{self.ollama_port}"

    @property
    def qdrant_base_url(self) -> str:
        return f"http://{self.qdrant_host}:{self.qdrant_port}"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
