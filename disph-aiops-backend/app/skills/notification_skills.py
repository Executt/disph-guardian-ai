"""Skills de notificação – Microsoft Teams e WhatsApp com integração real."""

from app.skills.registry import register_skill
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
from app.services.notifications.dispatcher import (
    dispatch_incident_alert,
    NotificationTarget,
)


@register_skill(
    name="notify_teams",
    description="Envia Adaptive Card rica para Microsoft Teams via Incoming Webhook",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "title": {"type": "string", "required": True},
        "message": {"type": "string", "required": True},
        "severity": {"type": "string", "default": "info", "enum": ["critical", "high", "warning", "info", "success"]},
        "incident_id": {"type": "string", "required": False},
        "environment": {"type": "string", "required": False},
        "service": {"type": "string", "required": False},
        "runbook_url": {"type": "string", "required": False},
        "channel_webhook": {"type": "string", "required": False},
    },
)
async def notify_teams(params: dict) -> dict:
    """Envia Adaptive Card formatada para Teams via Incoming Webhook."""
    card = _build_incident_card(
        title=params["title"],
        message=params["message"],
        severity=params.get("severity", "info"),
        incident_id=params.get("incident_id"),
        environment=params.get("environment"),
        service=params.get("service"),
        runbook_url=params.get("runbook_url"),
    )
    result = await send_teams_notification(
        card_payload=card,
        webhook_url=params.get("channel_webhook"),
    )
    return {
        "action": "teams_notification_sent",
        "title": params["title"],
        "severity": params.get("severity", "info"),
        **result,
    }


@register_skill(
    name="notify_teams_deploy",
    description="Envia notificação de deploy para Microsoft Teams com changelog",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "service": {"type": "string", "required": True},
        "version": {"type": "string", "required": True},
        "environment": {"type": "string", "required": True},
        "status": {"type": "string", "default": "success"},
        "pipeline_url": {"type": "string", "required": False},
        "deployer": {"type": "string", "required": False},
        "changelog": {"type": "array", "required": False},
        "channel_webhook": {"type": "string", "required": False},
    },
)
async def notify_teams_deploy(params: dict) -> dict:
    """Envia Adaptive Card de deploy para Teams."""
    card = _build_deployment_card(
        service=params["service"],
        version=params["version"],
        environment=params["environment"],
        status=params.get("status", "success"),
        pipeline_url=params.get("pipeline_url"),
        deployer=params.get("deployer"),
        changelog=params.get("changelog"),
    )
    result = await send_teams_notification(card, params.get("channel_webhook"))
    return {"action": "teams_deploy_notification", **result}


@register_skill(
    name="notify_teams_guardrail",
    description="Envia alerta de guardrail/aprovação para Microsoft Teams",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "action_name": {"type": "string", "required": True},
        "risk_level": {"type": "integer", "required": True},
        "operator": {"type": "string", "required": True},
        "reason": {"type": "string", "required": True},
        "approval_required": {"type": "boolean", "default": True},
        "channel_webhook": {"type": "string", "required": False},
    },
)
async def notify_teams_guardrail(params: dict) -> dict:
    """Envia Adaptive Card de guardrail para Teams."""
    card = _build_guardrail_card(
        action_name=params["action_name"],
        risk_level=params["risk_level"],
        operator=params["operator"],
        reason=params["reason"],
        approval_required=params.get("approval_required", True),
    )
    result = await send_teams_notification(card, params.get("channel_webhook"))
    return {"action": "teams_guardrail_alert", **result}


@register_skill(
    name="notify_whatsapp",
    description="Envia alerta de incidente via WhatsApp Business API com template aprovado",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "phone_number": {"type": "string", "required": True},
        "template_name": {"type": "string", "required": True, "enum": ["incident_alert", "deployment_status", "guardrail_approval", "maintenance_window"]},
        "severity": {"type": "string", "default": "info"},
        "title": {"type": "string", "required": False},
        "service": {"type": "string", "required": False},
        "environment": {"type": "string", "required": False},
        "incident_id": {"type": "string", "required": False},
    },
)
async def notify_whatsapp(params: dict) -> dict:
    """Envia mensagem template via WhatsApp Business Cloud API."""
    template = params["template_name"]

    if template == "incident_alert":
        components = _build_incident_alert_components(
            severity=params.get("severity", "info"),
            title=params.get("title", "Alerta"),
            service=params.get("service", "N/A"),
            environment=params.get("environment", "N/A"),
            incident_id=params.get("incident_id", "N/A"),
        )
        wa_template = "disph_incident_alert"
    elif template == "deployment_status":
        components = _build_deployment_components(
            service=params.get("service", "N/A"),
            version=params.get("version", "N/A"),
            environment=params.get("environment", "N/A"),
            status=params.get("status", "success"),
        )
        wa_template = "disph_deployment_status"
    elif template == "guardrail_approval":
        components = _build_guardrail_components(
            action_name=params.get("action_name", "N/A"),
            risk_level=params.get("risk_level", 3),
            operator=params.get("operator", "N/A"),
            reason=params.get("reason", "N/A"),
        )
        wa_template = "disph_guardrail_approval"
    elif template == "maintenance_window":
        components = _build_maintenance_components(
            service=params.get("service", "N/A"),
            start_time=params.get("start_time", "N/A"),
            end_time=params.get("end_time", "N/A"),
            description=params.get("description", "N/A"),
        )
        wa_template = "disph_maintenance_window"
    else:
        return {"status": "error", "error": f"Template desconhecido: {template}"}

    result = await send_whatsapp_template(
        phone_number=params["phone_number"],
        template_name=wa_template,
        template_components=components,
    )
    return {
        "action": "whatsapp_notification_sent",
        "template": wa_template,
        **result,
    }


@register_skill(
    name="notify_multi_channel",
    description="Despacha alerta de incidente simultaneamente para Teams e WhatsApp conforme severidade",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "title": {"type": "string", "required": True},
        "message": {"type": "string", "required": True},
        "severity": {"type": "string", "required": True},
        "incident_id": {"type": "string", "required": False},
        "environment": {"type": "string", "required": False},
        "service": {"type": "string", "required": False},
        "teams_webhook": {"type": "string", "required": False},
        "whatsapp_phones": {"type": "array", "required": False},
    },
)
async def notify_multi_channel(params: dict) -> dict:
    """Despacho multi-canal: Teams + WhatsApp baseado na severidade."""
    targets = []

    # Webhook Teams
    teams_wh = params.get("teams_webhook")
    phones = params.get("whatsapp_phones", [])

    if teams_wh or phones:
        for phone in phones:
            targets.append(NotificationTarget(teams_webhook=teams_wh, whatsapp_phone=phone))
        if not phones and teams_wh:
            targets.append(NotificationTarget(teams_webhook=teams_wh))
    else:
        targets.append(NotificationTarget())  # usa defaults do config

    result = await dispatch_incident_alert(
        title=params["title"],
        message=params["message"],
        severity=params["severity"],
        targets=targets,
        incident_id=params.get("incident_id"),
        environment=params.get("environment"),
        service=params.get("service"),
    )
    return {"action": "multi_channel_dispatch", **result}


# ─────────────────────────────────────────────────────────────
# Skills de colaboração (Slack, Discord, Mattermost, Telegram)
# Skeletons – integração real via webhooks/bots configurados em settings.
# ─────────────────────────────────────────────────────────────

@register_skill(
    name="notify_slack",
    description="Envia mensagem para canal Slack via Incoming Webhook ou chat.postMessage",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "channel": {"type": "string", "required": True, "description": "#canal ou ID"},
        "message": {"type": "string", "required": True},
        "severity": {"type": "string", "default": "info", "enum": ["critical", "high", "warning", "info", "success"]},
        "blocks": {"type": "array", "required": False, "description": "Block Kit blocks (opcional)"},
        "webhook_url": {"type": "string", "required": False},
    },
)
async def notify_slack(params: dict) -> dict:
    return {
        "action": "slack_notification_sent",
        "status": "skipped",
        "reason": "slack_client_not_configured",
        "channel": params["channel"],
        "severity": params.get("severity", "info"),
    }


@register_skill(
    name="notify_discord",
    description="Envia mensagem para canal Discord via Webhook (com embeds opcionais)",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "webhook_url": {"type": "string", "required": True},
        "message": {"type": "string", "required": True},
        "username": {"type": "string", "required": False, "default": "DISPH"},
        "embeds": {"type": "array", "required": False},
    },
)
async def notify_discord(params: dict) -> dict:
    return {
        "action": "discord_notification_sent",
        "status": "skipped",
        "reason": "discord_client_not_configured",
    }


@register_skill(
    name="notify_mattermost",
    description="Envia mensagem para canal Mattermost via Incoming Webhook",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "channel": {"type": "string", "required": True},
        "message": {"type": "string", "required": True},
        "webhook_url": {"type": "string", "required": False},
    },
)
async def notify_mattermost(params: dict) -> dict:
    return {
        "action": "mattermost_notification_sent",
        "status": "skipped",
        "reason": "mattermost_client_not_configured",
        "channel": params["channel"],
    }


@register_skill(
    name="notify_telegram",
    description="Envia mensagem para chat/grupo Telegram via Bot API",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "chat_id": {"type": "string", "required": True},
        "message": {"type": "string", "required": True},
        "parse_mode": {"type": "string", "default": "Markdown", "enum": ["Markdown", "HTML"]},
    },
)
async def notify_telegram(params: dict) -> dict:
    return {
        "action": "telegram_notification_sent",
        "status": "skipped",
        "reason": "telegram_bot_not_configured",
        "chat_id": params["chat_id"],
    }
