"""
Microsoft Teams – Adaptive Card notifications via Incoming Webhook.

Ref: https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using
"""

import httpx
import structlog
from datetime import datetime, timezone
from typing import Optional

from app.config import get_settings

logger = structlog.get_logger(__name__)

# ── Severity → color mapping ──────────────────────────────────────
SEVERITY_COLORS = {
    "critical": "#D13438",  # vermelho
    "high":     "#FF8C00",  # laranja
    "warning":  "#FFC300",  # amarelo
    "info":     "#0078D4",  # azul Microsoft
    "success":  "#107C10",  # verde
}

SEVERITY_ICONS = {
    "critical": "🔴",
    "high":     "🟠",
    "warning":  "🟡",
    "info":     "🔵",
    "success":  "🟢",
}


def _build_incident_card(
    title: str,
    message: str,
    severity: str = "info",
    incident_id: Optional[str] = None,
    environment: Optional[str] = None,
    service: Optional[str] = None,
    runbook_url: Optional[str] = None,
    assigned_to: Optional[str] = None,
) -> dict:
    """Monta um Adaptive Card v1.4 rico para alertas de incidente."""
    color = SEVERITY_COLORS.get(severity, SEVERITY_COLORS["info"])
    icon = SEVERITY_ICONS.get(severity, "ℹ️")
    now = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")

    # ── Fact set dinâmico ──
    facts = []
    if incident_id:
        facts.append({"title": "ID Incidente", "value": incident_id})
    if environment:
        facts.append({"title": "Ambiente", "value": environment})
    if service:
        facts.append({"title": "Serviço", "value": service})
    if assigned_to:
        facts.append({"title": "Responsável", "value": assigned_to})
    facts.append({"title": "Horário", "value": now})

    # ── Actions ──
    actions = [
        {
            "type": "Action.OpenUrl",
            "title": "📋 Ver Incidente",
            "url": f"https://disph-aiops.gov.br/incidents/{incident_id or 'dashboard'}",
        },
    ]
    if runbook_url:
        actions.append({
            "type": "Action.OpenUrl",
            "title": "📖 Runbook",
            "url": runbook_url,
        })
    actions.append({
        "type": "Action.OpenUrl",
        "title": "📊 Dashboard",
        "url": "https://disph-aiops.gov.br/dashboard",
    })

    card = {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "contentUrl": None,
                "content": {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "body": [
                        # ── Header com cor ──
                        {
                            "type": "Container",
                            "style": "emphasis",
                            "bleed": True,
                            "items": [
                                {
                                    "type": "ColumnSet",
                                    "columns": [
                                        {
                                            "type": "Column",
                                            "width": "auto",
                                            "items": [
                                                {
                                                    "type": "TextBlock",
                                                    "text": f"{icon} DISPH-AIOPS",
                                                    "weight": "Bolder",
                                                    "size": "Small",
                                                    "color": "Accent",
                                                }
                                            ],
                                        },
                                        {
                                            "type": "Column",
                                            "width": "stretch",
                                            "items": [
                                                {
                                                    "type": "TextBlock",
                                                    "text": severity.upper(),
                                                    "weight": "Bolder",
                                                    "size": "Small",
                                                    "horizontalAlignment": "Right",
                                                    "color": "Attention" if severity in ("critical", "high") else "Default",
                                                }
                                            ],
                                        },
                                    ],
                                }
                            ],
                        },
                        # ── Título ──
                        {
                            "type": "TextBlock",
                            "text": title,
                            "weight": "Bolder",
                            "size": "Large",
                            "wrap": True,
                            "spacing": "Medium",
                        },
                        # ── Mensagem ──
                        {
                            "type": "TextBlock",
                            "text": message,
                            "wrap": True,
                            "spacing": "Small",
                        },
                        # ── Detalhes ──
                        {
                            "type": "FactSet",
                            "facts": facts,
                            "spacing": "Medium",
                        },
                    ],
                    "actions": actions,
                    "msteams": {
                        "width": "Full",
                        "entities": [],
                    },
                },
            }
        ],
    }
    return card


def _build_deployment_card(
    service: str,
    version: str,
    environment: str,
    status: str = "success",
    pipeline_url: Optional[str] = None,
    deployer: Optional[str] = None,
    changelog: Optional[list[str]] = None,
) -> dict:
    """Adaptive Card para notificações de deploy."""
    icon = "✅" if status == "success" else "❌"
    color = "Good" if status == "success" else "Attention"
    now = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")

    facts = [
        {"title": "Serviço", "value": service},
        {"title": "Versão", "value": version},
        {"title": "Ambiente", "value": environment},
        {"title": "Status", "value": f"{icon} {status.upper()}"},
        {"title": "Horário", "value": now},
    ]
    if deployer:
        facts.append({"title": "Responsável", "value": deployer})

    body = [
        {
            "type": "TextBlock",
            "text": f"{icon} Deploy – {service} v{version}",
            "weight": "Bolder",
            "size": "Large",
            "wrap": True,
        },
        {"type": "FactSet", "facts": facts, "spacing": "Medium"},
    ]

    if changelog:
        body.append({
            "type": "TextBlock",
            "text": "**Changelog:**",
            "spacing": "Medium",
            "weight": "Bolder",
        })
        for item in changelog[:5]:
            body.append({
                "type": "TextBlock",
                "text": f"• {item}",
                "wrap": True,
                "spacing": "None",
            })

    actions = []
    if pipeline_url:
        actions.append({
            "type": "Action.OpenUrl",
            "title": "🔗 Pipeline",
            "url": pipeline_url,
        })

    return {
        "type": "message",
        "attachments": [{
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.4",
                "body": body,
                "actions": actions,
            },
        }],
    }


def _build_guardrail_card(
    action_name: str,
    risk_level: int,
    operator: str,
    reason: str,
    approval_required: bool = False,
) -> dict:
    """Adaptive Card para alertas de guardrail / aprovação."""
    icon = "🛡️" if not approval_required else "⚠️"
    now = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")

    body = [
        {
            "type": "TextBlock",
            "text": f"{icon} Guardrail – Aprovação Necessária" if approval_required else f"{icon} Guardrail – Ação Bloqueada",
            "weight": "Bolder",
            "size": "Large",
            "color": "Warning" if approval_required else "Attention",
        },
        {
            "type": "FactSet",
            "facts": [
                {"title": "Ação", "value": action_name},
                {"title": "Nível de Risco", "value": f"{'🔴' * risk_level}{'⚪' * (5 - risk_level)} ({risk_level}/5)"},
                {"title": "Operador", "value": operator},
                {"title": "Motivo", "value": reason},
                {"title": "Horário", "value": now},
            ],
        },
    ]

    actions = [
        {
            "type": "Action.OpenUrl",
            "title": "📋 Revisar no Console",
            "url": "https://disph-aiops.gov.br/incidents",
        },
    ]

    return {
        "type": "message",
        "attachments": [{
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.4",
                "body": body,
                "actions": actions,
            },
        }],
    }


# ── Sender ─────────────────────────────────────────────────────────

async def send_teams_notification(
    card_payload: dict,
    webhook_url: Optional[str] = None,
) -> dict:
    """Envia Adaptive Card para o Microsoft Teams via Incoming Webhook."""
    settings = get_settings()
    url = webhook_url or settings.TEAMS_WEBHOOK_URL

    if not url:
        logger.warning("teams_webhook_not_configured")
        return {"status": "skipped", "reason": "webhook_url_not_configured"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(url, json=card_payload)
            resp.raise_for_status()

            logger.info(
                "teams_notification_sent",
                status_code=resp.status_code,
                webhook=url[:40] + "...",
            )
            return {
                "status": "delivered",
                "status_code": resp.status_code,
                "response": resp.text[:200],
            }
        except httpx.HTTPStatusError as exc:
            logger.error(
                "teams_notification_failed",
                status_code=exc.response.status_code,
                body=exc.response.text[:300],
            )
            return {
                "status": "error",
                "status_code": exc.response.status_code,
                "error": exc.response.text[:300],
            }
        except httpx.RequestError as exc:
            logger.error("teams_notification_error", error=str(exc))
            return {"status": "error", "error": str(exc)}
