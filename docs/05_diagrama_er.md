# 05 — Diagrama ER

## 1. Visão geral por domínio

```text
                    ┌──────────────────┐
                    │   auth.users     │  (schema gerenciado)
                    └────────┬─────────┘
                             │ 1:1                  1:N
                 ┌───────────┴───────────┐   ┌──────────────┐
                 │      profiles         │   │  user_roles  │
                 └───────────────────────┘   └──────────────┘
```

### 1.1 Domínio AR / CTIR

```text
┌────────────────────┐        ┌───────────────────────────────────┐        ┌────────────────────────┐
│  ctir_advisories   │ 1    N │ advisory_environment_assessments  │ N    1 │ monitored_environments │
│────────────────────│───────►│───────────────────────────────────│◄───────│────────────────────────│
│ id (PK)            │        │ id (PK)                           │        │ id (PK)                │
│ code (UQ)          │        │ advisory_id (FK)                  │        │ name                   │
│ kind, severity     │        │ environment_id (FK)               │        │ type, criticality      │
│ cves[]             │        │ status (compliance_status)        │        │ total_assets           │
│ published_at       │        │ affected_assets                   │        │ owner, tags[]          │
│ synced_at          │        │ UQ(advisory_id, environment_id)   │        └────────────────────────┘
└────────────────────┘        └───────────────────────────────────┘

┌────────────────────┐
│  ctir_sync_state   │   (1 linha por feed_url — sem FK, chave natural)
└────────────────────┘
```

### 1.2 Domínio Vulnerabilidades

```text
┌──────────────┐   match lógico    ┌────────────────────────┐  trigger  ┌────────────────────────────┐
│ nvd_watchlist│◄─── uuid[] ───────│ nvd_vulnerabilities    │──────────►│ nvd_vulnerability_history  │
│ id (PK)      │ matched_watch_ids │ cve_id (PK)            │           │ cve_id, field, old, new    │
│ kind, value  │                   │ cvss_score, severity   │           └────────────────────────────┘
└──────────────┘                   └────────────────────────┘
```

`matched_watch_ids` é um array de UUIDs (sem FK física) para permitir remoção de itens da watchlist sem perder o histórico da CVE.

### 1.3 Domínio Hypervisores

```text
┌────────────────────────┐ 1   N ┌─────────────────────┐ 1   N ┌──────────────────┐
│ monitored_environments │──────►│ hypervisor_hosts    │──────►│ hypervisor_vms   │
└──────────┬─────────────┘       └─────────────────────┘       └──────────────────┘
           │ 1:N                          
           ├────────► hypervisor_failure_points
           ├────────► hypervisor_agent_status
           └────────► hypervisor_agent_logs
```

### 1.4 Domínio Agentes

```text
                       ┌────────────┐
                       │   agents   │
                       └─────┬──────┘
        ┌───────────┬────────┼─────────┬─────────────┐
        ▼ 1:1       ▼ 1:N    ▼ 1:N     ▼ 1:N
 agent_profiles  agent_skills  agent_channels  agent_executions

 skill_catalog_settings  (catálogo global, sem FK — casado por skill_name)
```

### 1.5 Domínio Plataforma

```text
audit_logs        (append-only, user_id lógico)
sync_alerts       (source: ctir | nvd | hypervisor)
export_jobs       (user_id = auth.uid(), storage_path → bucket ctir-exports)
ai_conversations  (user_id = auth.uid())
incidents         (stage: funil NIST; environment textual)
clusters          (inventário multi-cloud)
```

---

## 2. Cardinalidades

| Relação | Cardinalidade | Regra |
| --- | --- | --- |
| advisory → assessments | 1:N | um assessment por ambiente monitorado |
| environment → assessments | 1:N | criados automaticamente em novo advisory |
| environment → hosts | 1:N | `ON DELETE` bloqueado enquanto houver hosts |
| host → vms | 1:N | VMs sintomáticas apenas |
| agent → profile | 1:1 | perfil obrigatório para ativar o agente |
| agent → skills / channels / executions | 1:N | |
| user → roles | 1:N | um usuário pode acumular papéis |
| user → export_jobs | 1:N | isolado por RLS |

---

## 3. Integridade referencial

| FK | Ação |
| --- | --- |
| `advisory_environment_assessments.advisory_id` | `ON DELETE CASCADE` |
| `advisory_environment_assessments.environment_id` | `ON DELETE CASCADE` |
| `hypervisor_*.environment_id` | `ON DELETE SET NULL` |
| `hypervisor_vms.host_id` | `ON DELETE CASCADE` |
| `agent_*.agent_id` | `ON DELETE CASCADE` |
| `user_roles.user_id` | `ON DELETE CASCADE` (→ `auth.users`) |

---

## 4. Chaves naturais de idempotência

| Tabela | Chave usada no upsert |
| --- | --- |
| `ctir_advisories` | `code` |
| `nvd_vulnerabilities` | `cve_id` |
| `ctir_sync_state` | `feed_url` |
| `nvd_watchlist` | `lower(value)` |
| `advisory_environment_assessments` | `(advisory_id, environment_id)` |
| `user_roles` | `(user_id, role)` |
