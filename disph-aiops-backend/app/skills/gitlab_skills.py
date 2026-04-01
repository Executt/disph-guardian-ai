"""Skills de integração com GitLab."""

from app.skills.registry import register_skill


@register_skill(
    name="create_gitlab_mr",
    description="Cria um Merge Request no GitLab com correção automatizada",
    risk_level=2,
    required_role="developer",
    parameters_schema={
        "project_id": {"type": "string", "required": True},
        "source_branch": {"type": "string", "required": True},
        "target_branch": {"type": "string", "default": "main"},
        "title": {"type": "string", "required": True},
        "description": {"type": "string", "required": False},
        "file_changes": {"type": "array", "required": False},
    },
)
async def create_gitlab_mr(params: dict) -> dict:
    """
    Skeleton: Cria MR no GitLab.

    Em produção:
    1. Cria branch via API
    2. Commita alterações
    3. Abre Merge Request
    """
    return {
        "action": "gitlab_mr_created",
        "project_id": params.get("project_id"),
        "mr_id": "mock-mr-42",
        "url": f"https://gitlab.gov.br/project/-/merge_requests/42",
        "status": "opened",
    }


@register_skill(
    name="trigger_gitlab_pipeline",
    description="Dispara pipeline CI/CD no GitLab para rebuild/redeploy",
    risk_level=3,
    required_role="operator",
    parameters_schema={
        "project_id": {"type": "string", "required": True},
        "ref": {"type": "string", "default": "main"},
        "variables": {"type": "object", "required": False},
    },
)
async def trigger_gitlab_pipeline(params: dict) -> dict:
    return {
        "action": "pipeline_triggered",
        "project_id": params.get("project_id"),
        "pipeline_id": "mock-pipeline-99",
        "ref": params.get("ref", "main"),
        "status": "running",
    }
