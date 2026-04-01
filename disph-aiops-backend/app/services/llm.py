"""
LLM Service – Abstração para chamadas ao modelo de linguagem.

Suporta:
- Azure OpenAI (GPT-4o)
- vLLM local (Mistral, LLaMA)
- Ollama
"""

import httpx
from app.config import Settings


async def llm_completion(
    system_prompt: str,
    user_prompt: str,
    settings: Settings,
) -> dict:
    """
    Executa completion no LLM configurado.

    Retorna:
        {
            "content": str,
            "model": str,
            "tokens_used": int
        }
    """
    if settings.LLM_PROVIDER == "azure":
        return await _azure_completion(system_prompt, user_prompt, settings)
    elif settings.LLM_PROVIDER == "vllm":
        return await _vllm_completion(system_prompt, user_prompt, settings)
    else:
        return await _ollama_completion(system_prompt, user_prompt, settings)


async def _azure_completion(system_prompt: str, user_prompt: str, settings: Settings) -> dict:
    """Azure OpenAI Chat Completion."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.LLM_BASE_URL}/openai/deployments/{settings.LLM_MODEL}/chat/completions?api-version=2024-02-01",
            headers={
                "api-key": settings.LLM_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": settings.LLM_TEMPERATURE,
                "max_tokens": settings.LLM_MAX_TOKENS,
            },
            timeout=120.0,
        )
        response.raise_for_status()
        data = response.json()
        return {
            "content": data["choices"][0]["message"]["content"],
            "model": data.get("model", settings.LLM_MODEL),
            "tokens_used": data.get("usage", {}).get("total_tokens", 0),
        }


async def _vllm_completion(system_prompt: str, user_prompt: str, settings: Settings) -> dict:
    """vLLM local – compatível com OpenAI API."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.LLM_BASE_URL}/v1/chat/completions",
            json={
                "model": settings.LLM_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": settings.LLM_TEMPERATURE,
                "max_tokens": settings.LLM_MAX_TOKENS,
            },
            timeout=120.0,
        )
        response.raise_for_status()
        data = response.json()
        return {
            "content": data["choices"][0]["message"]["content"],
            "model": data.get("model", settings.LLM_MODEL),
            "tokens_used": data.get("usage", {}).get("total_tokens", 0),
        }


async def _ollama_completion(system_prompt: str, user_prompt: str, settings: Settings) -> dict:
    """Ollama local."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.LLM_BASE_URL}/api/chat",
            json={
                "model": settings.LLM_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "stream": False,
            },
            timeout=120.0,
        )
        response.raise_for_status()
        data = response.json()
        return {
            "content": data["message"]["content"],
            "model": settings.LLM_MODEL,
            "tokens_used": data.get("eval_count", 0),
        }
