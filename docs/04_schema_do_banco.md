# 04 — Schema do Banco (Dicionário de Dados)

Convenções: todas as tabelas possuem `id uuid PK DEFAULT gen_random_uuid()` salvo indicação contrária, e `created_at`/`updated_at` em `timestamptz NOT NULL DEFAULT now()`.

---

## 1. AR / CTIR

### 1.1 `ctir_advisories`
Catálogo de alertas e recomendações oficiais.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `code` | text NOT NULL | chave natural, ex.: `CTIR-AL-2026-054` (única) |
| `kind` | `advisory_kind` NOT NULL | alert \| recommendation |
| `title` | text NOT NULL | |
| `description` | text | |
| `recommendation` | text | ação sugerida |
| `severity` | `advisory_severity` NOT NULL | |
| `category` | text | ex.: ransomware, ddos, patch |
| `cves` | text[] | CVEs citados |
| `source` | text NOT NULL | `ctir-rss`, `gsi-html`, `manual` |
| `source_url` | text | permalink |
| `published_at` | timestamptz | data do portal |
| `synced_at` | timestamptz NOT NULL | última coleta |
| `created_by` | uuid | autor manual |

### 1.2 `monitored_environments`
Ambientes sob monitoramento do órgão.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `name` | text NOT NULL | |
| `description` | text | |
| `type` | `environment_type` NOT NULL | |
| `criticality` | `environment_criticality` NOT NULL | |
| `total_assets` | integer NOT NULL | base do cálculo de cobertura |
| `owner` | text | responsável |
| `tags` | text[] | |
| `created_by` | uuid | |

### 1.3 `advisory_environment_assessments`
Análise cruzada N:N advisory × ambiente.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `advisory_id` | uuid NOT NULL → `ctir_advisories.id` | |
| `environment_id` | uuid NOT NULL → `monitored_environments.id` | |
| `status` | `compliance_status` NOT NULL | default `pending` |
| `affected_assets` | integer NOT NULL | ≤ `total_assets` do ambiente |
| `notes` | text | |
| `remediation_plan` | text | |
| `assessed_by` | uuid | |
| `assessed_at` | timestamptz | |
| `remediated_at` | timestamptz | preenchido ao virar `compliant` |

Único: `(advisory_id, environment_id)`.

### 1.4 `ctir_sync_state`
Estado incremental por feed.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `feed_url` | text NOT NULL | único |
| `etag`, `last_modified` | text | conditional GET |
| `last_status` | integer | HTTP da última tentativa (200/304/403/5xx) |
| `last_fetched_at` | timestamptz NOT NULL | |
| `last_item_published_at` | timestamptz | corte incremental |
| `items_seen` | integer NOT NULL | acumulado |

---

## 2. Vulnerabilidades

### 2.1 `nvd_watchlist`
| Coluna | Tipo | Notas |
| --- | --- | --- |
| `label` | text NOT NULL | nome legível |
| `kind` | text NOT NULL | `keyword` \| `cpe` |
| `value` | text NOT NULL | único case-insensitive |
| `category` | text | ex.: container, so, rede |
| `enabled` | boolean NOT NULL | participa do próximo cron |
| `severity_floor` | text NOT NULL | piso de severidade coletada |

### 2.2 `nvd_vulnerabilities`
| Coluna | Tipo | Notas |
| --- | --- | --- |
| `cve_id` | text **PK** | |
| `published_at`, `last_modified` | timestamptz | |
| `cvss_score` | numeric | 0–10 |
| `cvss_vector` | text | vetor v3.1 |
| `severity` | text | derivada do score |
| `summary` | text | |
| `cwe` | text | |
| `refs` | jsonb NOT NULL | referências |
| `cpe_matches` | jsonb NOT NULL | produtos afetados |
| `matched_watch_ids` | uuid[] NOT NULL | itens da watchlist que casaram |
| `synced_at` | timestamptz NOT NULL | |

### 2.3 `nvd_vulnerability_history`
Trilha imutável de mudanças (somente leitura pelo app).

| Coluna | Tipo |
| --- | --- |
| `cve_id` text NOT NULL, `changed_at` timestamptz NOT NULL, `field` text NOT NULL, `old_value` jsonb, `new_value` jsonb |

---

## 3. Operação

### 3.1 `incidents`
| Coluna | Tipo | Notas |
| --- | --- | --- |
| `title` | text NOT NULL | |
| `description` | text | |
| `severity` | `incident_severity` NOT NULL | |
| `status` | `incident_status` NOT NULL | ciclo operacional |
| `stage` | `incident_stage` NOT NULL | funil NIST 800-61 |
| `environment` | text NOT NULL | |
| `service` | text | |
| `source` | text NOT NULL | zabbix, manual, agente, ctir |
| `assigned_to` | uuid | |
| `resolved_at` | timestamptz | |
| `mttr_minutes` | integer | calculado no fechamento |
| `created_by` | uuid | |

### 3.2 `clusters`
`name`, `provider` (`cluster_provider`), `environment`, `region`, `status` (`cluster_status`), `api_endpoint`, `node_count`, `kubernetes_version`, `created_by`.

---

## 4. Hypervisores

| Tabela | Colunas principais |
| --- | --- |
| `hypervisor_hosts` | `environment_id` FK, `platform` (vmware/hyperv), `hostname`, `cluster`, `cpu_pct`, `ram_pct`, `datastore_pct`, `uptime_seconds`, `status`, `last_check_at` |
| `hypervisor_vms` | `host_id` FK, `name`, `symptom`, `severity`, `recommendation`, `last_check_at` |
| `hypervisor_failure_points` | `environment_id` FK, `category`, `title`, `severity`, `impact`, `detected_at` |
| `hypervisor_agent_status` | `environment_id`, `platform`, `agent_name`, `hostname`, `version`, `status`, `last_collect_at`, `last_success_at`, `last_error_at`, `last_error_message`, `error_count_24h` |
| `hypervisor_agent_logs` | `environment_id`, `platform`, `agent_name`, `level`, `message`, `details` jsonb |

Escrita exclusiva do agente via Edge Function `hypervisor-ingest` (`service_role`); o app tem apenas leitura.

---

## 5. Agentes de IA

| Tabela | Colunas principais |
| --- | --- |
| `agents` | `name`, `description`, `avatar_url`, `status`, `autonomy_level`, `area`, `tags[]`, `created_by` |
| `agent_profiles` | `agent_id` FK, `model`, `system_prompt`, `temperature`, `max_tokens`, `role_focus`, `risk_threshold`, `guardrails` jsonb |
| `agent_skills` | `agent_id` FK, `skill_name`, `category`, `enabled`, `parameters` jsonb, `risk_level` |
| `agent_channels` | `agent_id` FK, `channel_type`, `label`, `config` jsonb, `enabled`, `requires_approval` |
| `agent_executions` | `agent_id` FK, `triggered_by`, `triggered_by_user`, `channel_type`, `input`, `output`, `status`, `tokens_used`, `duration_ms`, `error`, `metadata` jsonb |
| `skill_catalog_settings` | `skill_name`, `category`, `enabled`, `default_parameters` jsonb, `notes`, `updated_by` |

---

## 6. Plataforma

| Tabela | Colunas principais | Observação |
| --- | --- | --- |
| `profiles` | `user_id`, `display_name`, `email`, `avatar_url`, `department`, `mfa_enabled` | sem DELETE |
| `user_roles` | `user_id`, `role` (`app_role`), único `(user_id, role)` | **nunca** guardar papel em `profiles` |
| `audit_logs` | `user_id`, `action`, `resource_type`, `resource_id`, `details` jsonb, `ip_address` | append-only (sem UPDATE/DELETE) |
| `sync_alerts` | `source`, `kind`, `severity`, `message`, `details` jsonb, `ticket_ref`, `notified_channels` jsonb, `resolved_at` | sem DELETE/INSERT pelo app |
| `export_jobs` | `user_id`, `source`, `tab`, `format`, `scope`, `filters` jsonb, `status`, `progress`, `row_count`, `storage_path`, `error`, `started_at`, `finished_at` | isolado por `auth.uid()` |
| `ai_conversations` | `user_id`, `model`, `messages` jsonb, `tokens_used` | isolado por usuário |

---

## 7. Storage

| Bucket | Visibilidade | Caminho | Retenção |
| --- | --- | --- | --- |
| `ctir-exports` | privado | `<uid>/<jobId>.<csv\|pdf>` | 30 dias; download por URL assinada de 60s |
