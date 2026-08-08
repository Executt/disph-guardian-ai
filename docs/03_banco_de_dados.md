# 03 — Banco de Dados

## 1. Plataforma

| Item | Valor |
| --- | --- |
| SGBD | PostgreSQL 15 (Lovable Cloud) |
| Acesso do app | PostgREST (Data API) com JWT |
| Isolamento | Row Level Security em **todas** as tabelas de `public` |
| Extensões | `pgcrypto`, `pg_cron`, `pg_net` |
| Fuso | tudo em `timestamptz`, gravado em UTC |
| Chaves | `uuid` com `gen_random_uuid()` |

---

## 2. Domínios funcionais

| Domínio | Tabelas |
| --- | --- |
| **AR / CTIR** | `ctir_advisories`, `monitored_environments`, `advisory_environment_assessments`, `ctir_sync_state` |
| **Vulnerabilidades** | `nvd_watchlist`, `nvd_vulnerabilities`, `nvd_vulnerability_history` |
| **Operação** | `incidents`, `clusters` |
| **Hypervisores** | `hypervisor_hosts`, `hypervisor_vms`, `hypervisor_failure_points`, `hypervisor_agent_status`, `hypervisor_agent_logs` |
| **Agentes de IA** | `agents`, `agent_profiles`, `agent_skills`, `agent_channels`, `agent_executions`, `skill_catalog_settings` |
| **Plataforma** | `profiles`, `user_roles`, `audit_logs`, `sync_alerts`, `export_jobs`, `ai_conversations` |

Total: **25 tabelas** em `public`.

---

## 3. Padrão obrigatório de criação

```sql
CREATE TABLE public.exemplo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exemplo TO authenticated;
GRANT ALL ON public.exemplo TO service_role;
-- GRANT SELECT ... TO anon;  -- apenas se houver política para anon

ALTER TABLE public.exemplo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura autenticada" ON public.exemplo
  FOR SELECT TO authenticated USING (true);
```

Ordem não negociável: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY`. Tabela sem `GRANT` retorna erro de permissão mesmo com RLS correta.

---

## 4. Tipos enumerados

| Enum | Valores |
| --- | --- |
| `app_role` | admin, operator, viewer, auditor |
| `advisory_kind` | alert, recommendation |
| `advisory_severity` | critical, high, medium, low |
| `compliance_status` | compliant, partial, non_compliant, not_applicable, pending |
| `environment_type` | production, staging, development, dr, sandbox |
| `environment_criticality` | mission_critical, high, medium, low |
| `incident_severity` | critical, high, medium, low |
| `incident_status` | open, investigating, mitigating, resolved, closed |
| `incident_stage` | identified, contained, eradicated, recovered, closed |
| `cluster_provider` | eks, gke, aks, cce, oke, openshift, openshift_local, okd, rancher |
| `cluster_status` | active, inactive, provisioning, error, maintenance |
| `agent_status` | draft, active, paused, archived |
| `agent_autonomy` | manual, supervised, autonomous |
| `agent_channel_type` | teams, whatsapp, telegram |
| `agent_trigger_source` | manual, auto, channel, schedule, webhook |
| `agent_execution_status` | pending, running, awaiting_approval, success, failed, cancelled |

---

## 5. Funções e triggers

| Objeto | Tipo | Descrição |
| --- | --- | --- |
| `has_role(uuid, app_role)` | função `SECURITY DEFINER`, `STABLE`, `search_path = public` | Base de todas as políticas de RLS |
| `has_any_role(uuid, app_role[])` | idem | Verifica conjunto de papéis |
| `update_updated_at_column()` | trigger `BEFORE UPDATE` | Mantém `updated_at` |
| `nvd_vuln_track_changes()` | trigger `AFTER UPDATE` em `nvd_vulnerabilities` | Grava diffs em `nvd_vulnerability_history` |

`has_role` é `SECURITY DEFINER` para evitar recursão de RLS ao ler `user_roles` dentro de políticas.

---

## 6. Índices relevantes

| Tabela | Índice |
| --- | --- |
| `ctir_advisories` | único em `code`; índices em `severity`, `kind`, `published_at` |
| `advisory_environment_assessments` | único `(advisory_id, environment_id)`; índice em `status` |
| `nvd_vulnerabilities` | PK `cve_id`; índices em `severity`, `last_modified`, GIN em `matched_watch_ids` |
| `nvd_watchlist` | único case-insensitive em `lower(value)` |
| `sync_alerts` | índices em `created_at DESC`, `source`, `severity` |
| `export_jobs` | índice `(user_id, created_at DESC)` |
| `hypervisor_hosts` | índice `(environment_id, platform)` |
| `audit_logs` | índices em `created_at DESC`, `user_id`, `resource_type` |

---

## 7. Jobs agendados (`pg_cron`)

| Job | Frequência | Ação |
| --- | --- | --- |
| `sync-ctir-daily` | `0 6 * * *` (06:00 UTC) | Chama `sync-ctir-advisories` via `pg_net` |
| `sync-ctir-hourly` | `0 * * * *` | Coleta incremental leve com conditional GET |
| `sync-nvd-daily` | diário | Chama `sync-nvd-vulnerabilities` |

Cada execução grava `ctir_sync_state` (ETag, Last-Modified, contagem) e, em anomalia, `sync_alerts`.

---

## 8. Retenção e volumetria

| Tabela | Crescimento estimado | Retenção |
| --- | --- | --- |
| `ctir_advisories` | ~150 linhas/ano | permanente |
| `advisory_environment_assessments` | advisories × ambientes | permanente |
| `nvd_vulnerabilities` | milhares/ano (filtrado por watchlist) | permanente |
| `nvd_vulnerability_history` | alto | 5 anos |
| `hypervisor_agent_logs` | muito alto | 90 dias |
| `sync_alerts` | médio | 1 ano |
| `audit_logs` | alto | 5 anos (LGPD/SISP) |
| `export_jobs` + storage | médio | 30 dias, purga do objeto junto |

---

## 9. Migrations

- Versionadas em `supabase/migrations/`, nomeadas por timestamp.
- Sempre idempotentes onde possível (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
- Alterações destrutivas exigem migration em duas fases (adicionar → migrar dados → remover).
- Schemas intocáveis: `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.

---

## 10. Backup e recuperação

| Item | Política |
| --- | --- |
| Backup automático | diário gerenciado pela plataforma |
| PITR | conforme plano da nuvem |
| Teste de restauração | trimestral, documentado no doc 21 |
| RPO alvo | 24h |
| RTO alvo | 4h |
