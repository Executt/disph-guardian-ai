"""
RAG Endpoint – Busca Híbrida (metadata filter + similaridade vetorial via pgvector).

Fluxo:
1. Recebe query + filtros opcionais (environment, service, severity)
2. Gera embedding da query
3. Executa busca híbrida no PostgreSQL:
   a. Filtra por metadata JSONB (exato)
   b. Ordena por similaridade cosseno do embedding (pgvector)
4. Monta contexto com top-K chunks
5. Envia prompt + contexto para LLM
6. Retorna resposta com sources
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings, Settings
from app.db import get_db
from app.services.embedding import generate_embedding
from app.services.llm import llm_completion

router = APIRouter()


# ── Schemas ─────────────────────────────────────────────────────────

class RAGQuery(BaseModel):
    query: str = Field(..., min_length=3, max_length=2000, description="Pergunta do operador")
    environment: Optional[str] = Field(None, description="Filtro: AWS | OCI | On-Premise")
    service: Optional[str] = Field(None, description="Filtro por nome do microserviço")
    severity: Optional[str] = Field(None, description="Filtro: critical | high | medium | low")
    top_k: int = Field(5, ge=1, le=20, description="Número de chunks retornados")


class RAGSource(BaseModel):
    chunk_id: str
    title: str
    score: float
    metadata: dict


class RAGResponse(BaseModel):
    answer: str
    sources: list[RAGSource]
    model_used: str
    tokens_used: int


# ── Endpoint ────────────────────────────────────────────────────────

@router.post("/query", response_model=RAGResponse)
async def rag_query(
    payload: RAGQuery,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """
    Busca híbrida: metadata JSONB + similaridade vetorial (pgvector cosine).

    SQL gerado:
    ```sql
    SELECT id, title, content, metadata,
           1 - (embedding <=> :query_vec) AS similarity
    FROM ai_engine.knowledge_chunks
    WHERE metadata->>'environment' = :env       -- filtro exato (opcional)
      AND metadata->>'service'     = :svc       -- filtro exato (opcional)
      AND metadata->>'severity'    = :sev       -- filtro exato (opcional)
    ORDER BY embedding <=> :query_vec
    LIMIT :top_k;
    ```
    O operador `<=>` usa o índice HNSW para distância cosseno.
    """

    # 1. Gerar embedding da query
    query_embedding = await generate_embedding(payload.query)

    # 2. Montar SQL com filtros dinâmicos
    where_clauses = []
    params: dict = {
        "query_vec": str(query_embedding),
        "top_k": payload.top_k,
    }

    if payload.environment:
        where_clauses.append("metadata->>'environment' = :env")
        params["env"] = payload.environment

    if payload.service:
        where_clauses.append("metadata->>'service' = :svc")
        params["svc"] = payload.service

    if payload.severity:
        where_clauses.append("metadata->>'severity' = :sev")
        params["sev"] = payload.severity

    where_sql = (" AND " + " AND ".join(where_clauses)) if where_clauses else ""

    sql = text(f"""
        SELECT id::text, title, content, metadata,
               1 - (embedding <=> :query_vec::vector) AS similarity
        FROM ai_engine.knowledge_chunks
        WHERE 1=1 {where_sql}
        ORDER BY embedding <=> :query_vec::vector
        LIMIT :top_k
    """)

    # 3. Executar busca híbrida
    result = await db.execute(sql, params)
    rows = result.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="Nenhum conhecimento encontrado para esta consulta.")

    # 4. Montar contexto para o LLM
    sources = []
    context_parts = []
    for row in rows:
        sources.append(RAGSource(
            chunk_id=row.id,
            title=row.title,
            score=round(float(row.similarity), 4),
            metadata=row.metadata or {},
        ))
        context_parts.append(f"### {row.title}\n{row.content}")

    context = "\n\n---\n\n".join(context_parts)

    # 5. Prompt para o LLM
    system_prompt = """Você é o assistente DISPH-AIOPS, especialista em operações de TI para o setor público brasileiro.
Responda com base EXCLUSIVAMENTE no contexto fornecido abaixo.
Se a informação não estiver no contexto, diga explicitamente que não encontrou dados suficientes.
Sempre cite as fontes utilizadas.
Respostas devem seguir as diretrizes SISP e considerar conformidade LGPD."""

    user_prompt = f"""## Contexto Recuperado (Top-{payload.top_k})

{context}

---

## Pergunta do Operador
{payload.query}

Responda de forma objetiva, citando as fontes relevantes."""

    # 6. Chamar LLM
    llm_result = await llm_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        settings=settings,
    )

    return RAGResponse(
        answer=llm_result["content"],
        sources=sources,
        model_used=llm_result["model"],
        tokens_used=llm_result["tokens_used"],
    )


@router.post("/ingest")
async def ingest_knowledge(
    title: str,
    content: str,
    metadata: dict,
    db: AsyncSession = Depends(get_db),
):
    """Ingerir novo chunk de conhecimento com embedding automático."""
    embedding = await generate_embedding(content)

    sql = text("""
        INSERT INTO ai_engine.knowledge_chunks (title, content, metadata, embedding, source)
        VALUES (:title, :content, :metadata::jsonb, :embedding::vector, 'manual')
        RETURNING id::text
    """)

    result = await db.execute(sql, {
        "title": title,
        "content": content,
        "metadata": str(metadata).replace("'", '"'),
        "embedding": str(embedding),
    })
    await db.commit()
    row = result.fetchone()

    return {"id": row.id, "status": "ingested"}
