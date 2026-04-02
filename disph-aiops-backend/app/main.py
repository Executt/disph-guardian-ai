"""DISPH-AIOPS – FastAPI Application Entry Point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.rag import router as rag_router
from app.api.skills import router as skills_router
from app.api.incidents import router as incidents_router
from app.api.notifications import router as notifications_router

app = FastAPI(
    title="DISPH-AIOPS",
    version="1.0.0",
    description="Plataforma AIOps para ambientes de missão crítica – Setor Público Brasileiro",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rag_router, prefix="/api/v1/rag", tags=["RAG"])
app.include_router(skills_router, prefix="/api/v1/skills", tags=["Skills"])
app.include_router(incidents_router, prefix="/api/v1/incidents", tags=["Incidents"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "disph-aiops"}
