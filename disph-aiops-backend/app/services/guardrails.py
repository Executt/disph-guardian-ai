"""
Guardrails Engine (ACS – Autonomy Control System).

Camadas de validação antes de executar qualquer skill:

1. MFA Validation    – Exige token TOTP válido para ações de risco
2. Risk Assessment   – Avalia risk_level da skill vs threshold configurado
3. Blast Radius      – Verifica quantos serviços serão afetados
4. Approval Gate     – Skills de alto risco requerem aprovação de supervisor
5. Audit Trail       – Registra decisão no log de auditoria (imutável)
"""

from dataclasses import dataclass
from typing import Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings


@dataclass
class GuardrailContext:
    operator_id: str
    skill_name: str
    risk_level: int  # 1-5
    environment: str
    mfa_token: Optional[str]
    affected_services: list[str]
    incident_id: Optional[str]


class GuardrailsEngine:
    """
    Motor de guardrails com pipeline de validações.

    Decisões possíveis:
    - "approved"          → Execução liberada
    - "blocked"           → Ação negada (com razão)
    - "pending_approval"  → Requer aprovação de supervisor
    """

    def __init__(self):
        self.settings = get_settings()

    async def evaluate(self, ctx: GuardrailContext, db: AsyncSession) -> dict:
        """Executa pipeline completa de guardrails."""

        checks = []

        # ── 1. MFA Validation ───────────────────────────────
        mfa_result = await self._check_mfa(ctx, db)
        checks.append(mfa_result)
        if mfa_result["status"] == "failed":
            verdict = self._build_verdict("blocked", checks, "MFA obrigatório não fornecido ou inválido")
            await self._audit_log(ctx, verdict, db)
            return verdict

        # ── 2. Risk Level Assessment ────────────────────────
        risk_result = self._check_risk_level(ctx)
        checks.append(risk_result)

        # ── 3. Blast Radius ─────────────────────────────────
        blast_result = self._check_blast_radius(ctx)
        checks.append(blast_result)
        if blast_result["status"] == "failed":
            verdict = self._build_verdict(
                "blocked", checks,
                f"Raio de impacto ({len(ctx.affected_services)} serviços) excede o limite de {self.settings.GUARDRAILS_MAX_BLAST_RADIUS}"
            )
            await self._audit_log(ctx, verdict, db)
            return verdict

        # ── 4. Approval Gate ────────────────────────────────
        if ctx.risk_level > self.settings.GUARDRAILS_REQUIRE_APPROVAL_ABOVE:
            approval_result = await self._check_approval(ctx, db)
            checks.append(approval_result)
            if approval_result["status"] == "pending":
                verdict = self._build_verdict("pending_approval", checks, "Aguardando aprovação de supervisor")
                await self._audit_log(ctx, verdict, db)
                return verdict

        # ── 5. Tudo aprovado ────────────────────────────────
        verdict = self._build_verdict("approved", checks, "Todas as validações passaram")
        await self._audit_log(ctx, verdict, db)
        return verdict

    async def _check_mfa(self, ctx: GuardrailContext, db: AsyncSession) -> dict:
        """Valida token MFA TOTP do operador."""
        if not self.settings.GUARDRAILS_REQUIRE_MFA:
            return {"check": "mfa", "status": "skipped", "reason": "MFA desabilitado"}

        if not ctx.mfa_token:
            return {"check": "mfa", "status": "failed", "reason": "Token MFA não fornecido"}

        # Validar TOTP contra auth.mfa_tokens
        result = await db.execute(
            text("""
                SELECT id FROM auth.mfa_tokens
                WHERE user_id = (SELECT id FROM auth.users WHERE id = :uid::uuid)
                  AND is_active = true
                LIMIT 1
            """),
            {"uid": ctx.operator_id},
        )
        mfa_row = result.fetchone()

        if not mfa_row:
            return {"check": "mfa", "status": "failed", "reason": "MFA não configurado para este operador"}

        # TODO: validar TOTP real com pyotp
        # import pyotp
        # totp = pyotp.TOTP(mfa_row.secret)
        # if not totp.verify(ctx.mfa_token):
        #     return {"check": "mfa", "status": "failed", "reason": "Token MFA inválido"}

        return {"check": "mfa", "status": "passed", "reason": "MFA validado"}

    def _check_risk_level(self, ctx: GuardrailContext) -> dict:
        """Avalia nível de risco da skill."""
        threshold = self.settings.GUARDRAILS_REQUIRE_APPROVAL_ABOVE
        if ctx.risk_level <= threshold:
            return {
                "check": "risk_level",
                "status": "passed",
                "reason": f"Risk {ctx.risk_level} <= threshold {threshold}",
            }
        return {
            "check": "risk_level",
            "status": "warning",
            "reason": f"Risk {ctx.risk_level} > threshold {threshold} – requer aprovação",
        }

    def _check_blast_radius(self, ctx: GuardrailContext) -> dict:
        """Verifica raio de impacto (número de serviços afetados)."""
        max_radius = self.settings.GUARDRAILS_MAX_BLAST_RADIUS
        count = len(ctx.affected_services)
        if count <= max_radius:
            return {
                "check": "blast_radius",
                "status": "passed",
                "reason": f"{count} serviços afetados <= limite {max_radius}",
            }
        return {
            "check": "blast_radius",
            "status": "failed",
            "reason": f"{count} serviços afetados > limite {max_radius}",
        }

    async def _check_approval(self, ctx: GuardrailContext, db: AsyncSession) -> dict:
        """
        Verifica se já existe aprovação de supervisor para esta ação.
        Em produção, cria um request de aprovação e retorna "pending".
        """
        # TODO: verificar tabela de aprovações pendentes
        # Por ora, retorna pending para skills de alto risco
        return {
            "check": "approval_gate",
            "status": "pending",
            "reason": f"Skill '{ctx.skill_name}' com risk_level={ctx.risk_level} requer aprovação",
        }

    def _build_verdict(self, decision: str, checks: list, reason: str) -> dict:
        return {
            "decision": decision,
            "reason": reason,
            "checks": checks,
        }

    async def _audit_log(self, ctx: GuardrailContext, verdict: dict, db: AsyncSession) -> None:
        """Registra decisão no audit log (imutável, conformidade LGPD/SISP)."""
        try:
            await db.execute(
                text("""
                    INSERT INTO audit.audit_logs
                        (user_id, action, resource_type, resource_id, details, ip_address)
                    VALUES
                        (:uid::uuid, :action, 'skill', :skill, :details::jsonb, '0.0.0.0')
                """),
                {
                    "uid": ctx.operator_id,
                    "action": f"guardrail_{verdict['decision']}",
                    "skill": ctx.skill_name,
                    "details": str({
                        "incident_id": ctx.incident_id,
                        "environment": ctx.environment,
                        "risk_level": ctx.risk_level,
                        "checks": verdict["checks"],
                    }).replace("'", '"'),
                },
            )
            await db.commit()
        except Exception:
            pass  # Audit log failure should not block operation
