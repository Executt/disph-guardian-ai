"""Skills de automação via Ansible / AWX."""

from app.skills.registry import register_skill


@register_skill(
    name="trigger_ansible_playbook",
    description="Dispara um playbook Ansible via AWX/Tower para remediação automatizada",
    risk_level=3,
    required_role="operator",
    parameters_schema={
        "playbook_name": {"type": "string", "required": True},
        "inventory": {"type": "string", "required": True},
        "extra_vars": {"type": "object", "required": False},
        "limit_hosts": {"type": "string", "required": False},
    },
)
async def trigger_ansible_playbook(params: dict) -> dict:
    """
    Skeleton: Dispara playbook no AWX.

    Em produção:
    1. POST /api/v2/job_templates/{template_id}/launch/ no AWX
    2. Monitora status do job
    3. Retorna resultado
    """
    playbook = params.get("playbook_name", "unknown")
    inventory = params.get("inventory", "default")

    # TODO: integrar com AWX API
    # async with httpx.AsyncClient() as client:
    #     response = await client.post(
    #         f"{AWX_URL}/api/v2/job_templates/{template_id}/launch/",
    #         headers={"Authorization": f"Bearer {AWX_TOKEN}"},
    #         json={"inventory": inventory, "extra_vars": params.get("extra_vars", {})},
    #     )

    return {
        "action": "ansible_playbook_triggered",
        "playbook": playbook,
        "inventory": inventory,
        "job_id": "mock-job-12345",
        "status": "launched",
    }


@register_skill(
    name="ansible_restart_service",
    description="Reinicia um serviço específico via Ansible em hosts selecionados",
    risk_level=4,
    required_role="senior_operator",
    parameters_schema={
        "service_name": {"type": "string", "required": True},
        "target_hosts": {"type": "array", "required": True},
        "affected_services": {"type": "array", "required": False},
    },
)
async def ansible_restart_service(params: dict) -> dict:
    service = params.get("service_name")
    hosts = params.get("target_hosts", [])

    return {
        "action": "service_restart",
        "service": service,
        "hosts": hosts,
        "status": "completed",
        "message": f"Serviço {service} reiniciado em {len(hosts)} hosts",
    }
