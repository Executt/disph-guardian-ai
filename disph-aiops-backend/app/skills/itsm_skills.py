"""Skills de ITSM – GLPI, Jira, ServiceNow, CITSmart, Freshservice, Azure DevOps.

Inclui também um wrapper genérico `create_ticket(provider=...)` para uso
pelo agente de IA quando o provedor é decidido em runtime.
"""

from app.skills.registry import register_skill
from app.services.itsm.client import (
    GLPIClient,
    JiraClient,
    ServiceNowClient,
    CITSmartClient,
)


# ─────────────────────────────────────────────────────────────
# Skills específicas por provedor (mantidas para invocação direta)
# ─────────────────────────────────────────────────────────────

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


@register_skill(
    name="open_freshservice_ticket",
    description="Cria ticket no Freshservice (ITIL) via API v2",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "subject": {"type": "string", "required": True},
        "description": {"type": "string", "required": True},
        "email": {"type": "string", "required": True},
        "priority": {"type": "integer", "default": 2, "enum": [1, 2, 3, 4]},
        "status": {"type": "integer", "default": 2},
        "group_id": {"type": "integer", "required": False},
    },
)
async def open_freshservice_ticket(params: dict) -> dict:
    # Skeleton — integração real virá via FreshserviceClient
    return {
        "action": "freshservice_ticket_created",
        "status": "skipped",
        "reason": "freshservice_client_not_implemented",
        "subject": params["subject"],
    }


@register_skill(
    name="open_azuredevops_workitem",
    description="Cria work item (Bug, Task, User Story) no Azure DevOps Boards",
    risk_level=1,
    required_role="operator",
    parameters_schema={
        "organization": {"type": "string", "required": True},
        "project": {"type": "string", "required": True},
        "work_item_type": {"type": "string", "default": "Bug"},
        "title": {"type": "string", "required": True},
        "description": {"type": "string", "required": True},
        "area_path": {"type": "string", "required": False},
        "iteration_path": {"type": "string", "required": False},
    },
)
async def open_azuredevops_workitem(params: dict) -> dict:
    # Skeleton — integração real virá via AzureDevOpsClient
    return {
        "action": "azuredevops_workitem_created",
        "status": "skipped",
        "reason": "azuredevops_client_not_implemented",
        "title": params["title"],
    }


# ─────────────────────────────────────────────────────────────
# Wrapper genérico com parâmetro `provider`
# ─────────────────────────────────────────────────────────────

PROVIDER_DISPATCH = {
    "glpi": open_glpi_ticket,
    "jira": open_jira_ticket,
    "servicenow": open_servicenow_incident,
    "citsmart": open_citsmart_ticket,
    "freshservice": open_freshservice_ticket,
    "azure-devops": open_azuredevops_workitem,
}


@register_skill(
    name="create_ticket",
    description=(
        "Abre chamado/ticket no provedor ITSM informado. "
        "Providers suportados: glpi, jira, servicenow, citsmart, freshservice, azure-devops."
    ),
    risk_level=2,
    required_role="operator",
    parameters_schema={
        "provider": {
            "type": "string",
            "required": True,
            "enum": ["glpi", "jira", "servicenow", "citsmart", "freshservice", "azure-devops"],
        },
        "title": {"type": "string", "required": True},
        "description": {"type": "string", "required": True},
        "priority": {"type": "string", "default": "medium"},
        "extra": {
            "type": "object",
            "required": False,
            "description": "Parâmetros específicos do provedor (project_key, category, etc.)",
        },
    },
)
async def create_ticket(params: dict) -> dict:
    """Roteador genérico: delega para a skill do provedor."""
    provider = params["provider"]
    handler = PROVIDER_DISPATCH.get(provider)
    if not handler:
        return {"action": "create_ticket", "status": "error", "error": f"provider '{provider}' não suportado"}

    extra = params.get("extra") or {}
    payload = {
        "title": params["title"],
        "description": params["description"],
        "priority": params.get("priority", "medium"),
        **extra,
    }
    # Adaptações mínimas para campos com nomes distintos por provedor
    if provider == "jira":
        payload.setdefault("summary", payload.pop("title"))
        payload.setdefault("project_key", extra.get("project_key", ""))
    elif provider == "servicenow":
        payload.setdefault("short_description", payload.pop("title"))
    elif provider == "freshservice":
        payload.setdefault("subject", payload.pop("title"))
        payload.setdefault("email", extra.get("email", "noreply@disph.gov.br"))
    elif provider == "azure-devops":
        payload.setdefault("organization", extra.get("organization", ""))
        payload.setdefault("project", extra.get("project", ""))
    elif provider == "glpi":
        payload.setdefault("category", extra.get("category", "general"))
    elif provider == "citsmart":
        payload.setdefault("service_id", extra.get("service_id", 0))
        payload.setdefault("requester", extra.get("requester", "system"))

    return await handler(payload)


@register_skill(
    name="update_ticket",
    description="Atualiza status/comentário em ticket existente em qualquer provedor ITSM",
    risk_level=2,
    required_role="operator",
    parameters_schema={
        "provider": {"type": "string", "required": True},
        "ticket_id": {"type": "string", "required": True},
        "status": {"type": "string", "required": False},
        "comment": {"type": "string", "required": False},
    },
)
async def update_ticket(params: dict) -> dict:
    # Skeleton — implementação por provedor a ser adicionada nos clients
    return {
        "action": "ticket_updated",
        "status": "skipped",
        "reason": "update_not_yet_implemented_per_provider",
        "provider": params["provider"],
        "ticket_id": params["ticket_id"],
    }


@register_skill(
    name="create_change",
    description="Abre mudança (RFC/Change Request) com avaliação de risco em GLPI/Jira/ServiceNow",
    risk_level=4,
    required_role="operator",
    parameters_schema={
        "provider": {"type": "string", "required": True},
        "title": {"type": "string", "required": True},
        "description": {"type": "string", "required": True},
        "risk": {"type": "string", "default": "low", "enum": ["low", "medium", "high"]},
        "planned_start": {"type": "string", "required": False},
        "planned_end": {"type": "string", "required": False},
    },
)
async def create_change(params: dict) -> dict:
    return {
        "action": "change_created",
        "status": "skipped",
        "reason": "change_management_pending_implementation",
        "provider": params["provider"],
        "risk": params.get("risk", "low"),
    }
