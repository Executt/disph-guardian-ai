"""
WhatsApp Business API – Meta Cloud API v18.0+.

Ref: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
"""

import httpx
import structlog
from datetime import datetime, timezone
from typing import Optional

from app.config import get_settings

logger = structlog.get_logger(__name__)

# ── Template builders ──────────────────────────────────────────────

WHATSAPP_TEMPLATES = {
    "incident_alert": {
        "name": "disph_incident_alert",
        "language": {"code": "pt_BR"},
        "description": "Alerta de incidente com severidade, serviço e ação sugerida",
        "components_builder": "_build_incident_alert_components",
    },
    "deployment_status": {
        "name": "disph_deployment_status",
        "language": {"code": "pt_BR"},
        "description": "Notificação de status de deploy",
        "components_builder": "_build_deployment_components",
    },
    "guardrail_approval": {
        "name": "disph_guardrail_approval",
        "language": {"code": "pt_BR"},
        "description": "Solicitação de aprovação para ação de alto risco",
        "components_builder": "_build_guardrail_components",
    },
    "maintenance_window": {
        "name": "disph_maintenance_window",
        "language": {"code": "pt_BR"},
        "description": "Aviso de janela de manutenção programada",
        "components_builder": "_build_maintenance_components",
    },
}


def _build_incident_alert_components(
    severity: str,
    title: str,
    service: str,
    environment: str,
    incident_id: str,
    suggested_action: Optional[str] = None,
) -> list[dict]:
    """Componentes para template disph_incident_alert."""
    severity_emoji = {"critical": "🔴", "high": "🟠", "warning": "🟡", "info": "🔵"}.get(severity, "ℹ️")

    header_params = [{"type": "text", "text": f"{severity_emoji} {severity.upper()}"}]
    body_params = [
        {"type": "text", "text": title},
        {"type": "text", "text": service},
        {"type": "text", "text": environment},
        {"type": "text", "text": incident_id},
        {"type": "text", "text": datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")},
    ]
    if suggested_action:
        body_params.append({"type": "text", "text": suggested_action})

    components = [
        {"type": "header", "parameters": header_params},
        {"type": "body", "parameters": body_params},
        {
            "type": "button",
            "sub_type": "url",
            "index": "0",
            "parameters": [{"type": "text", "text": incident_id}],
        },
    ]
    return components


def _build_deployment_components(
    service: str,
    version: str,
    environment: str,
    status: str,
) -> list[dict]:
    """Componentes para template disph_deployment_status."""
    emoji = "✅" if status == "success" else "❌"
    return [
        {
            "type": "header",
            "parameters": [{"type": "text", "text": f"{emoji} Deploy {status.upper()}"}],
        },
        {
            "type": "body",
            "parameters": [
                {"type": "text", "text": service},
                {"type": "text", "text": version},
                {"type": "text", "text": environment},
                {"type": "text", "text": datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")},
            ],
        },
    ]


def _build_guardrail_components(
    action_name: str,
    risk_level: int,
    operator: str,
    reason: str,
) -> list[dict]:
    """Componentes para template disph_guardrail_approval."""
    risk_display = f"{'🔴' * risk_level}{'⚪' * (5 - risk_level)} ({risk_level}/5)"
    return [
        {
            "type": "header",
            "parameters": [{"type": "text", "text": "⚠️ Aprovação Necessária"}],
        },
        {
            "type": "body",
            "parameters": [
                {"type": "text", "text": action_name},
                {"type": "text", "text": risk_display},
                {"type": "text", "text": operator},
                {"type": "text", "text": reason},
            ],
        },
        {
            "type": "button",
            "sub_type": "quick_reply",
            "index": "0",
            "parameters": [{"type": "payload", "payload": f"approve_{action_name}"}],
        },
        {
            "type": "button",
            "sub_type": "quick_reply",
            "index": "1",
            "parameters": [{"type": "payload", "payload": f"reject_{action_name}"}],
        },
    ]


def _build_maintenance_components(
    service: str,
    start_time: str,
    end_time: str,
    description: str,
) -> list[dict]:
    """Componentes para template disph_maintenance_window."""
    return [
        {
            "type": "header",
            "parameters": [{"type": "text", "text": "🔧 Manutenção Programada"}],
        },
        {
            "type": "body",
            "parameters": [
                {"type": "text", "text": service},
                {"type": "text", "text": start_time},
                {"type": "text", "text": end_time},
                {"type": "text", "text": description},
            ],
        },
    ]


# ── Sender ─────────────────────────────────────────────────────────

async def send_whatsapp_template(
    phone_number: str,
    template_name: str,
    template_components: list[dict],
    language_code: str = "pt_BR",
    phone_number_id: Optional[str] = None,
) -> dict:
    """
    Envia mensagem template via WhatsApp Business Cloud API (Meta).

    O template deve estar pré-aprovado no Meta Business Manager.
    """
    settings = get_settings()
    base_url = settings.WHATSAPP_API_URL or "https://graph.facebook.com/v18.0"
    token = settings.WHATSAPP_API_TOKEN
    pid = phone_number_id or "PHONE_NUMBER_ID"

    if not token:
        logger.warning("whatsapp_token_not_configured")
        return {"status": "skipped", "reason": "whatsapp_api_token_not_configured"}

    # Normaliza telefone: remove espaços, garante código de país
    phone = phone_number.replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        phone = f"+55{phone}"  # default Brasil
    phone = phone.lstrip("+")

    url = f"{base_url}/{pid}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
            "components": template_components,
        },
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            message_id = data.get("messages", [{}])[0].get("id", "unknown")
            logger.info(
                "whatsapp_message_sent",
                phone=phone[:6] + "****",
                template=template_name,
                message_id=message_id,
            )
            return {
                "status": "sent",
                "message_id": message_id,
                "phone": phone[:6] + "****",
                "template": template_name,
            }
        except httpx.HTTPStatusError as exc:
            error_body = exc.response.json() if exc.response.headers.get("content-type", "").startswith("application/json") else {"raw": exc.response.text[:300]}
            logger.error(
                "whatsapp_send_failed",
                status_code=exc.response.status_code,
                error=error_body,
            )
            return {
                "status": "error",
                "status_code": exc.response.status_code,
                "error": error_body,
            }
        except httpx.RequestError as exc:
            logger.error("whatsapp_request_error", error=str(exc))
            return {"status": "error", "error": str(exc)}


async def send_whatsapp_text(
    phone_number: str,
    text: str,
    phone_number_id: Optional[str] = None,
) -> dict:
    """Envia mensagem de texto simples (requer sessão ativa de 24h)."""
    settings = get_settings()
    base_url = settings.WHATSAPP_API_URL or "https://graph.facebook.com/v18.0"
    token = settings.WHATSAPP_API_TOKEN
    pid = phone_number_id or "PHONE_NUMBER_ID"

    if not token:
        return {"status": "skipped", "reason": "whatsapp_api_token_not_configured"}

    phone = phone_number.replace(" ", "").replace("-", "").lstrip("+")
    if len(phone) <= 11:
        phone = f"55{phone}"

    url = f"{base_url}/{pid}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "text",
        "text": {"preview_url": False, "body": text},
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "status": "sent",
                "message_id": data.get("messages", [{}])[0].get("id"),
            }
        except httpx.HTTPStatusError as exc:
            return {"status": "error", "status_code": exc.response.status_code}
        except httpx.RequestError as exc:
            return {"status": "error", "error": str(exc)}
