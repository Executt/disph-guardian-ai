"""
Skill Registry – Registro automático de skills via decorator.

Cada skill define:
- name: identificador único
- description: o que faz
- risk_level: 1 (baixo) a 5 (crítico)
- required_role: role mínima para execução
- parameters_schema: dict com parâmetros esperados
- execute(): função async que executa a ação
"""

from dataclasses import dataclass, field
from typing import Callable, Optional

SKILL_REGISTRY: dict[str, "SkillDefinition"] = {}


@dataclass
class SkillDefinition:
    name: str
    description: str
    risk_level: int
    required_role: str
    parameters_schema: dict
    execute: Callable


def register_skill(
    name: str,
    description: str,
    risk_level: int = 1,
    required_role: str = "operator",
    parameters_schema: Optional[dict] = None,
):
    """Decorator para registrar uma skill no registry global."""
    def decorator(func):
        SKILL_REGISTRY[name] = SkillDefinition(
            name=name,
            description=description,
            risk_level=risk_level,
            required_role=required_role,
            parameters_schema=parameters_schema or {},
            execute=func,
        )
        return func
    return decorator


def get_skill(name: str) -> Optional[SkillDefinition]:
    return SKILL_REGISTRY.get(name)


# ── Auto-import skill modules to trigger registration ──
from app.skills import (
    ansible_skills,
    gitlab_skills,
    monitoring_skills,
    itsm_skills,
    kubernetes_skills,
    notification_skills,
)
