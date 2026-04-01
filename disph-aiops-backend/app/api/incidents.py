"""Incidents API – CRUD e acionamento de remediação."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter()


class IncidentCreate(BaseModel):
    title: str
    severity: str = Field(..., pattern="^(critical|high|medium|low)$")
    environment: str
    service: str
    description: str
    source: str = "manual"  # "zabbix" | "prometheus" | "manual" | "aiops"


@router.post("/")
async def create_incident(payload: IncidentCreate):
    """Cria incidente e dispara análise RAG + sugestão de skill."""
    # TODO: persist to DB, trigger RAG analysis, suggest remediation skill
    return {"status": "created", "incident": payload.dict()}


@router.get("/")
async def list_incidents():
    """Lista incidentes ativos."""
    return {"incidents": []}
