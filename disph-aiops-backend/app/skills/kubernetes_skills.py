"""Skills de Kubernetes – OKD/OpenShift."""

from app.skills.registry import register_skill


@register_skill(
    name="k8s_scale_deployment",
    description="Escala réplicas de um Deployment no Kubernetes/OKD",
    risk_level=3,
    required_role="operator",
    parameters_schema={
        "namespace": {"type": "string", "required": True},
        "deployment": {"type": "string", "required": True},
        "replicas": {"type": "integer", "required": True},
        "affected_services": {"type": "array", "required": False},
    },
)
async def k8s_scale_deployment(params: dict) -> dict:
    return {
        "action": "deployment_scaled",
        "namespace": params.get("namespace"),
        "deployment": params.get("deployment"),
        "replicas": params.get("replicas"),
        "status": "scaled",
    }


@register_skill(
    name="k8s_rollback_deployment",
    description="Faz rollback de um Deployment para revisão anterior",
    risk_level=4,
    required_role="senior_operator",
    parameters_schema={
        "namespace": {"type": "string", "required": True},
        "deployment": {"type": "string", "required": True},
        "revision": {"type": "integer", "required": False},
        "affected_services": {"type": "array", "required": False},
    },
)
async def k8s_rollback_deployment(params: dict) -> dict:
    return {
        "action": "deployment_rollback",
        "namespace": params.get("namespace"),
        "deployment": params.get("deployment"),
        "revision": params.get("revision", "previous"),
        "status": "rolled_back",
    }


@register_skill(
    name="k8s_cordon_node",
    description="Drena e isola um node do cluster Kubernetes",
    risk_level=5,
    required_role="admin",
    parameters_schema={
        "node_name": {"type": "string", "required": True},
        "reason": {"type": "string", "required": True},
        "affected_services": {"type": "array", "required": True},
    },
)
async def k8s_cordon_node(params: dict) -> dict:
    return {
        "action": "node_cordoned",
        "node": params.get("node_name"),
        "reason": params.get("reason"),
        "status": "cordoned_and_draining",
    }
