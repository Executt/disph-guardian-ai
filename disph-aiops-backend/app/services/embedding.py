"""
Embedding Service – Gera embeddings para busca vetorial.

Suporta:
- sentence-transformers local (via API interna ou import direto)
- Azure OpenAI embeddings API
"""

import httpx
from app.config import get_settings


async def generate_embedding(text: str) -> list[float]:
    """
    Gera embedding vetorial para um texto.

    Em produção, pode usar:
    1. sentence-transformers rodando como microserviço
    2. Azure OpenAI Embeddings API
    3. Modelo local via HuggingFace Inference

    Retorna vetor de dimensão configurada (default 1536 para ada-002).
    """
    settings = get_settings()

    if settings.LLM_PROVIDER == "azure":
        return await _azure_embedding(text, settings)
    else:
        return await _local_embedding(text, settings)


async def _azure_embedding(text: str, settings) -> list[float]:
    """Chama Azure OpenAI Embeddings API."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.LLM_BASE_URL}/openai/deployments/text-embedding-ada-002/embeddings?api-version=2024-02-01",
            headers={
                "api-key": settings.LLM_API_KEY,
                "Content-Type": "application/json",
            },
            json={"input": text},
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        return data["data"][0]["embedding"]


async def _local_embedding(text: str, settings) -> list[float]:
    """
    Chama serviço local de embeddings (ex: TEI – Text Embeddings Inference).
    Endpoint esperado: POST /embed {"text": "..."}
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://embedding-service:8081/embed",
            json={"text": text, "model": settings.EMBEDDING_MODEL},
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()["embedding"]
