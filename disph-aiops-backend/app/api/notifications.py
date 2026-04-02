"""
API de Notificações – Endpoints REST para envio direto e teste.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.services.notifications.teams import (
    send_teams_notification,
    _build_incident_card,
    _build_deployment_card,
)
from app.services.notifications.whatsapp import (
    send_whatsapp_template,
    _build_incident_alert_components,
)
from app.services.notifications.dispatcher import (
    dispatch_incident_alert,
    dispatch_deployment_notification,
    dispatch_guardrail_alert,
    NotificationTarget,
)

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


# ── Schemas ────────────────────────────────────────────────────────

class TeamsAlertRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    message: str = Field(..., min_length=1)
    severity: str = Field(default="info")
    incident_id: Optional[str] = None
    environment: Optional[str] = None
    service: Optional[str] = None
    runbook_url: Optional[str] = None
    webhook_url: Optional[str] = None


class WhatsAppAlertRequest(BaseModel):
    phone_number: str = Field(..., pattern=r"^\+?\d{10,15}$")
    severity: str = Field(default="info")
    title: str = Field(default="Alerta DISPH-AIOPS")
    service: Optional[str] = None
    environment: Optional[str] = None
    incident_id: Optional[str] = None


class MultiChannelRequest(BaseModel):
    title: str
    message: str
    severity: str = "info"
    incident_id: Optional[str] = None
    environment: Optional[str] = None
    service: Optional[str] = None
    teams_webhooks: list[str] = []
    whatsapp_phones: list[str] = []


# ── Endpoints ──────────────────────────────────────────────────────

@router.post("/teams/alert")
async def send_teams_alert(req: TeamsAlertRequest):
    """Envia alerta de incidente para Microsoft Teams."""
    card = _build_incident_card(
        title=req.title,
        message=req.message,
        severity=req.severity,
        incident_id=req.incident_id,
        environment=req.environment,
        service=req.service,
        runbook_url=req.runbook_url,
    )
    result = await send_teams_notification(card, req.webhook_url)
    if result.get("status") == "error":
        raise HTTPException(status_code=502, detail=result)
    return result


@router.post("/whatsapp/alert")
async def send_whatsapp_alert(req: WhatsAppAlertRequest):
    """Envia alerta de incidente via WhatsApp Business API."""
    components = _build_incident_alert_components(
        severity=req.severity,
        title=req.title,
        service=req.service or "N/A",
        environment=req.environment or "N/A",
        incident_id=req.incident_id or "N/A",
    )
    result = await send_whatsapp_template(
        phone_number=req.phone_number,
        template_name="disph_incident_alert",
        template_components=components,
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=502, detail=result)
    return result


@router.post("/dispatch")
async def dispatch_multi_channel(req: MultiChannelRequest):
    """Despacha notificação multi-canal (Teams + WhatsApp) conforme severidade."""
    targets = []
    all_webhooks = req.teams_webhooks or [None]
    all_phones = req.whatsapp_phones or []

    for wh in all_webhooks:
        for phone in all_phones:
            targets.append(NotificationTarget(teams_webhook=wh, whatsapp_phone=phone))
        if not all_phones:
            targets.append(NotificationTarget(teams_webhook=wh))

    result = await dispatch_incident_alert(
        title=req.title,
        message=req.message,
        severity=req.severity,
        targets=targets,
        incident_id=req.incident_id,
        environment=req.environment,
        service=req.service,
    )
    return result


@router.get("/templates")
async def list_templates():
    """Lista templates WhatsApp disponíveis."""
    from app.services.notifications.whatsapp import WHATSAPP_TEMPLATES
    return {
        name: {
            "wa_template_name": info["name"],
            "language": info["language"]["code"],
            "description": info["description"],
        }
        for name, info in WHATSAPP_TEMPLATES.items()
    }
