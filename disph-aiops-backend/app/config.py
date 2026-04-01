"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://disph:disph@localhost:5432/disph_aiops"

    # Embedding model
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIM: int = 1536

    # LLM (Azure OpenAI or local vLLM)
    LLM_PROVIDER: str = "azure"  # "azure" | "vllm" | "ollama"
    LLM_BASE_URL: str = "https://your-instance.openai.azure.com/"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o"
    LLM_TEMPERATURE: float = 0.1
    LLM_MAX_TOKENS: int = 2048

    # Guardrails
    GUARDRAILS_REQUIRE_MFA: bool = True
    GUARDRAILS_MAX_BLAST_RADIUS: int = 3  # max services affected
    GUARDRAILS_REQUIRE_APPROVAL_ABOVE: int = 2  # risk level threshold

    # ITSM integrations
    GLPI_BASE_URL: str = ""
    GLPI_API_TOKEN: str = ""
    JIRA_BASE_URL: str = ""
    JIRA_API_TOKEN: str = ""
    SERVICENOW_BASE_URL: str = ""
    SERVICENOW_API_TOKEN: str = ""
    CITSMART_BASE_URL: str = ""
    CITSMART_API_TOKEN: str = ""

    # Notifications
    TEAMS_WEBHOOK_URL: str = ""
    WHATSAPP_API_URL: str = ""
    WHATSAPP_API_TOKEN: str = ""

    # Keycloak
    KEYCLOAK_URL: str = "http://keycloak:8080"
    KEYCLOAK_REALM: str = "disph"
    KEYCLOAK_CLIENT_ID: str = "disph-aiops"

    class Config:
        env_prefix = "DISPH_"
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
