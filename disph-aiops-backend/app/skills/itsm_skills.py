"""Skills de ITSM – GLPI, Jira, ServiceNow, CITSmart."""

from app.skills.registry import register_skill


@register_skill(
    name="open_glpi_ticket",
    description="Abre chamado no GLPI com categorização automática",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "title": {"type": "string", "required": True},
        "description": {"type": "string", "required": True},
        "category": {"type": "string", "required": True},
        "priority": {"type": "integer", "default": 3},
        "assigned_group": {"type": "string", "required": False},
    },
)
async def open_glpi_ticket(params: dict) -> dict:
    """
    Skeleton: Cria ticket no GLPI via REST API.

    Em produção:
    1. POST /apirest.php/initSession (autenticação)
    2. POST /apirest.php/Ticket (criação)
    """
    return {
        "action": "glpi_ticket_created",
        "ticket_id": "GLPI-2024-00142",
        "title": params.get("title"),
        "priority": params.get("priority", 3),
        "status": "new",
        "url": "https://glpi.gov.br/front/ticket.form.php?id=142",
    }


@register_skill(
    name="open_jira_ticket",
    description="Cria issue no Jira com labels e componentes",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "project_key": {"type": "string", "required": True},
        "summary": {"type": "string", "required": True},
        "description": {"type": "string", "required": True},
        "issue_type": {"type": "string", "default": "Bug"},
        "priority": {"type": "string", "default": "High"},
        "labels": {"type": "array", "required": False},
    },
)
async def open_jira_ticket(params: dict) -> dict:
    return {
        "action": "jira_ticket_created",
        "ticket_id": f"{params.get('project_key', 'DISPH')}-1042",
        "summary": params.get("summary"),
        "status": "To Do",
    }


@register_skill(
    name="open_servicenow_incident",
    description="Cria incidente no ServiceNow via Table API",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "short_description": {"type": "string", "required": True},
        "description": {"type": "string", "required": True},
        "urgency": {"type": "integer", "default": 2},
        "impact": {"type": "integer", "default": 2},
        "assignment_group": {"type": "string", "required": False},
    },
)
async def open_servicenow_incident(params: dict) -> dict:
    return {
        "action": "servicenow_incident_created",
        "incident_number": "INC0042567",
        "short_description": params.get("short_description"),
        "status": "New",
    }


@register_skill(
    name="open_citsmart_ticket",
    description="Cria requisição de serviço no CITSmart/ITSM",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "service_id": {"type": "integer", "required": True},
        "description": {"type": "string", "required": True},
        "requester": {"type": "string", "required": True},
        "urgency": {"type": "string", "default": "Medium"},
    },
)
async def open_citsmart_ticket(params: dict) -> dict:
    return {
        "action": "citsmart_ticket_created",
        "ticket_id": "REQ-2024-003891",
        "service_id": params.get("service_id"),
        "status": "Em Andamento",
    }
