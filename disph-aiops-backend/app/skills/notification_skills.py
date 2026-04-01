"""Skills de notificação – Microsoft Teams e WhatsApp."""

from app.skills.registry import register_skill


@register_skill(
    name="notify_teams",
    description="Envia notificação via webhook do Microsoft Teams",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "title": {"type": "string", "required": True},
        "message": {"type": "string", "required": True},
        "severity": {"type": "string", "default": "info"},
        "channel_webhook": {"type": "string", "required": False},
    },
)
async def notify_teams(params: dict) -> dict:
    """
    Skeleton: Envia Adaptive Card para Teams via Incoming Webhook.

    Em produção:
    1. Monta payload de Adaptive Card
    2. POST para webhook URL do canal
    """
    # TODO: implementar chamada real
    # async with httpx.AsyncClient() as client:
    #     card = {
    #         "type": "message",
    #         "attachments": [{
    #             "contentType": "application/vnd.microsoft.card.adaptive",
    #             "content": { ... }
    #         }]
    #     }
    #     await client.post(webhook_url, json=card)

    return {
        "action": "teams_notification_sent",
        "title": params.get("title"),
        "severity": params.get("severity", "info"),
        "status": "delivered",
    }


@register_skill(
    name="notify_whatsapp",
    description="Envia alerta via WhatsApp Business API (Meta Cloud API)",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "phone_number": {"type": "string", "required": True},
        "template_name": {"type": "string", "required": True},
        "template_params": {"type": "array", "required": False},
    },
)
async def notify_whatsapp(params: dict) -> dict:
    """
    Skeleton: Envia mensagem template via WhatsApp Business API.

    Em produção:
    1. POST https://graph.facebook.com/v18.0/{phone_id}/messages
    2. Usa template pré-aprovado pela Meta
    """
    return {
        "action": "whatsapp_notification_sent",
        "phone": params.get("phone_number"),
        "template": params.get("template_name"),
        "status": "sent",
        "message_id": "wamid.mock12345",
    }
