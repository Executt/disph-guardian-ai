"""Skills de ITSM – GLPI, Jira, ServiceNow, CITSmart com integração real."""

from app.skills.registry import register_skill
from app.services.itsm.client import (
    GLPIClient,
    JiraClient,
    ServiceNowClient,
    CITSmartClient,
)


@register_skill(
    name="open_glpi_ticket",
    description="Abre chamado no GLPI com categorização automática via REST API",
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
    client = GLPIClient()
    result = await client.create_ticket(
        title=params["title"],
        description=params["description"],
        category=params["category"],
        priority=params.get("priority", 3),
        assigned_group=params.get("assigned_group"),
    )
    return {"action": "glpi_ticket_created", **result}


@register_skill(
    name="open_jira_ticket",
    description="Cria issue no Jira Cloud/DC com ADF formatting e labels",
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
    client = JiraClient()
    result = await client.create_issue(
        project_key=params["project_key"],
        summary=params["summary"],
        description=params["description"],
        issue_type=params.get("issue_type", "Bug"),
        priority=params.get("priority", "High"),
        labels=params.get("labels"),
    )
    return {"action": "jira_ticket_created", **result}


@register_skill(
    name="open_servicenow_incident",
    description="Cria incidente no ServiceNow via Table API REST",
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
    client = ServiceNowClient()
    result = await client.create_incident(
        short_description=params["short_description"],
        description=params["description"],
        urgency=params.get("urgency", 2),
        impact=params.get("impact", 2),
        assignment_group=params.get("assignment_group"),
    )
    return {"action": "servicenow_incident_created", **result}


@register_skill(
    name="open_citsmart_ticket",
    description="Cria requisição de serviço no CITSmart/ITSM via API REST",
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
    client = CITSmartClient()
    result = await client.create_request(
        service_id=params["service_id"],
        description=params["description"],
        requester=params["requester"],
        urgency=params.get("urgency", "Medium"),
    )
    return {"action": "citsmart_ticket_created", **result}
