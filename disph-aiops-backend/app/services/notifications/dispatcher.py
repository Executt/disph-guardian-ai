"""
Notification Dispatcher – Orquestra envio multi-canal.

Centraliza a lógica de roteamento: quem recebe, por qual canal,
com qual nível de urgência.
"""

import structlog
from typing import Optional
from dataclasses import dataclass

from app.services.notifications.teams import (
    send_teams_notification,
    _build_incident_card,
    _build_deployment_card,
    _build_guardrail_card,
)
from app.services.notifications.whatsapp import (
    send_whatsapp_template,
    _build_incident_alert_components,
    _build_deployment_components,
    _build_guardrail_components,
    _build_maintenance_components,
)

logger = structlog.get_logger(__name__)


@dataclass
class NotificationTarget:
    """Define um destinatário de notificação."""
    teams_webhook: Optional[str] = None
    whatsapp_phone: Optional[str] = None
    email: Optional[str] = None  # futuro


# ── Routing rules ─────────────────────────────────────────────────

SEVERITY_CHANNELS = {
    "critical": ["teams", "whatsapp"],  # urgente: ambos
    "high":     ["teams", "whatsapp"],
    "warning":  ["teams"],
    "info":     ["teams"],
    "success":  ["teams"],
}


async def dispatch_incident_alert(
    title: str,
    message: str,
    severity: str,
    targets: list[NotificationTarget],
    incident_id: Optional[str] = None,
    environment: Optional[str] = None,
    service: Optional[str] = None,
    runbook_url: Optional[str] = None,
) -> dict:
    """Despacha alerta de incidente para todos os canais relevantes."""
    channels = SEVERITY_CHANNELS.get(severity, ["teams"])
    results = {"teams": [], "whatsapp": []}

    # ── Teams ──
    if "teams" in channels:
        card = _build_incident_card(
            title=title,
            message=message,
            severity=severity,
            incident_id=incident_id,
            environment=environment,
            service=service,
            runbook_url=runbook_url,
        )
        for target in targets:
            if target.teams_webhook:
                result = await send_teams_notification(card, target.teams_webhook)
                results["teams"].append(result)

        # Fallback: webhook padrão do config
        if not any(t.teams_webhook for t in targets):
            result = await send_teams_notification(card)
            results["teams"].append(result)

    # ── WhatsApp ──
    if "whatsapp" in channels:
        components = _build_incident_alert_components(
            severity=severity,
            title=title,
            service=service or "N/A",
            environment=environment or "N/A",
            incident_id=incident_id or "N/A",
        )
        for target in targets:
            if target.whatsapp_phone:
                result = await send_whatsapp_template(
                    phone_number=target.whatsapp_phone,
                    template_name="disph_incident_alert",
                    template_components=components,
                )
                results["whatsapp"].append(result)

    logger.info(
        "incident_alert_dispatched",
        severity=severity,
        channels=channels,
        teams_count=len(results["teams"]),
        whatsapp_count=len(results["whatsapp"]),
    )
    return results


async def dispatch_deployment_notification(
    service: str,
    version: str,
    environment: str,
    status: str,
    targets: list[NotificationTarget],
    pipeline_url: Optional[str] = None,
    deployer: Optional[str] = None,
    changelog: Optional[list[str]] = None,
) -> dict:
    """Notifica deploy via Teams (e WhatsApp se falha)."""
    results = {"teams": [], "whatsapp": []}

    card = _build_deployment_card(
        service=service,
        version=version,
        environment=environment,
        status=status,
        pipeline_url=pipeline_url,
        deployer=deployer,
        changelog=changelog,
    )
    for target in targets:
        if target.teams_webhook:
            results["teams"].append(await send_teams_notification(card, target.teams_webhook))

    if not any(t.teams_webhook for t in targets):
        results["teams"].append(await send_teams_notification(card))

    # WhatsApp somente para falhas
    if status != "success":
        components = _build_deployment_components(service, version, environment, status)
        for target in targets:
            if target.whatsapp_phone:
                results["whatsapp"].append(
                    await send_whatsapp_template(
                        target.whatsapp_phone,
                        "disph_deployment_status",
                        components,
                    )
                )

    return results


async def dispatch_guardrail_alert(
    action_name: str,
    risk_level: int,
    operator: str,
    reason: str,
    targets: list[NotificationTarget],
    approval_required: bool = True,
) -> dict:
    """Notifica guardrail / solicitação de aprovação."""
    results = {"teams": [], "whatsapp": []}

    card = _build_guardrail_card(action_name, risk_level, operator, reason, approval_required)
    for target in targets:
        if target.teams_webhook:
            results["teams"].append(await send_teams_notification(card, target.teams_webhook))

    if not any(t.teams_webhook for t in targets):
        results["teams"].append(await send_teams_notification(card))

    # WhatsApp para aprovações urgentes (risk >= 4)
    if approval_required and risk_level >= 4:
        components = _build_guardrail_components(action_name, risk_level, operator, reason)
        for target in targets:
            if target.whatsapp_phone:
                results["whatsapp"].append(
                    await send_whatsapp_template(
                        target.whatsapp_phone,
                        "disph_guardrail_approval",
                        components,
                    )
                )

    return results
