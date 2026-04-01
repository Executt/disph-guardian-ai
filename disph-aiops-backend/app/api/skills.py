"""
Skills Repository – Tool Registry para o agente de IA.

Cada skill é uma função skeleton que pode ser invocada pelo agente
após validação de guardrails (ACS). As skills são registradas
automaticamente via decorator @register_skill.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.services.guardrails import GuardrailsEngine, GuardrailContext
from app.skills.registry import SKILL_REGISTRY, get_skill

router = APIRouter()


class SkillExecuteRequest(BaseModel):
    skill_name: str = Field(..., description="Nome da skill a executar")
    params: dict = Field(default_factory=dict, description="Parâmetros da skill")
    operator_id: str = Field(..., description="ID do operador solicitante")
    mfa_token: Optional[str] = Field(None, description="Token MFA TOTP")
    incident_id: Optional[str] = Field(None, description="ID do incidente associado")
    environment: str = Field("On-Premise", description="Ambiente alvo")


class SkillExecuteResponse(BaseModel):
    skill_name: str
    status: str  # "executed" | "blocked" | "pending_approval"
    result: Optional[dict] = None
    guardrail_verdict: dict
    execution_log_id: Optional[str] = None


@router.get("/")
async def list_skills():
    """Lista todas as skills registradas no repositório."""
    return {
        "skills": [
            {
                "name": name,
                "description": skill.description,
                "risk_level": skill.risk_level,
                "required_role": skill.required_role,
                "parameters": skill.parameters_schema,
            }
            for name, skill in SKILL_REGISTRY.items()
        ]
    }


@router.post("/execute", response_model=SkillExecuteResponse)
async def execute_skill(
    payload: SkillExecuteRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Executa uma skill com validação de guardrails (ACS).

    Fluxo:
    1. Busca skill no registry
    2. Monta contexto de guardrails
    3. Valida: MFA, risk level, blast radius, approval
    4. Se aprovado → executa skill
    5. Registra log de execução em ai_engine.ai_execution_logs
    """
    skill = get_skill(payload.skill_name)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{payload.skill_name}' não encontrada")

    # Montar contexto de guardrails
    context = GuardrailContext(
        operator_id=payload.operator_id,
        skill_name=payload.skill_name,
        risk_level=skill.risk_level,
        environment=payload.environment,
        mfa_token=payload.mfa_token,
        affected_services=payload.params.get("affected_services", []),
        incident_id=payload.incident_id,
    )

    # Validar guardrails
    engine = GuardrailsEngine()
    verdict = await engine.evaluate(context, db)

    if verdict["decision"] == "blocked":
        return SkillExecuteResponse(
            skill_name=payload.skill_name,
            status="blocked",
            guardrail_verdict=verdict,
        )

    if verdict["decision"] == "pending_approval":
        return SkillExecuteResponse(
            skill_name=payload.skill_name,
            status="pending_approval",
            guardrail_verdict=verdict,
        )

    # Executar skill
    try:
        result = await skill.execute(payload.params)
    except Exception as e:
        return SkillExecuteResponse(
            skill_name=payload.skill_name,
            status="error",
            result={"error": str(e)},
            guardrail_verdict=verdict,
        )

    return SkillExecuteResponse(
        skill_name=payload.skill_name,
        status="executed",
        result=result,
        guardrail_verdict=verdict,
    )
