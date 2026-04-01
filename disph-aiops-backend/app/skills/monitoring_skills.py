"""Skills de monitoramento – Zabbix, Prometheus, Grafana."""

from app.skills.registry import register_skill


@register_skill(
    name="query_zabbix",
    description="Consulta métricas e alertas do Zabbix via API",
    risk_level=1,
    required_role="viewer",
    parameters_schema={
        "host_group": {"type": "string", "required": False},
        "metric_name": {"type": "string", "required": False},
        "time_range": {"type": "string", "default": "1h"},
        "severity_min": {"type": "integer", "default": 2},
    },
)
async def query_zabbix(params: dict) -> dict:
    """
    Skeleton: Consulta Zabbix API.

    Em produção:
    1. POST para Zabbix JSON-RPC API
    2. Método: trigger.get / history.get / host.get
    """
    return {
        "action": "zabbix_query",
        "host_group": params.get("host_group", "all"),
        "alerts_found": 3,
        "data": [
            {"host": "srv-app-01", "trigger": "CPU > 90%", "severity": "high", "age": "15m"},
            {"host": "srv-db-02", "trigger": "Disk I/O wait", "severity": "medium", "age": "1h"},
            {"host": "srv-web-03", "trigger": "Memory > 85%", "severity": "high", "age": "5m"},
        ],
    }


@register_skill(
    name="query_prometheus",
    description="Executa PromQL no Prometheus para métricas de containers/pods",
    risk_level=1,
    required_role="viewer",
    parameters_schema={
        "promql": {"type": "string", "required": True},
        "time_range": {"type": "string", "default": "1h"},
        "step": {"type": "string", "default": "15s"},
    },
)
async def query_prometheus(params: dict) -> dict:
    return {
        "action": "prometheus_query",
        "query": params.get("promql"),
        "result_type": "matrix",
        "samples": 240,
        "status": "success",
    }


@register_skill(
    name="silence_alert",
    description="Silencia um alerta no Alertmanager por período definido",
    risk_level=2,
    required_role="operator",
    parameters_schema={
        "alert_name": {"type": "string", "required": True},
        "duration": {"type": "string", "default": "2h"},
        "comment": {"type": "string", "required": True},
    },
)
async def silence_alert(params: dict) -> dict:
    return {
        "action": "alert_silenced",
        "alert": params.get("alert_name"),
        "duration": params.get("duration", "2h"),
        "silence_id": "mock-silence-77",
        "status": "active",
    }
