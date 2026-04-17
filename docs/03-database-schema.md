# 03 — Database Schema

> 6 tabelas, 5 enums, 3 funções, RLS em todas. Schema PostgreSQL 15 hospedado em **Lovable Cloud**.

---

## 1. Diagrama Entidade-Relacionamento (ER)

```
┌──────────────────────────────────────────────────────────────────┐
│                    auth.users  (Supabase managed)                │
│                    ────────────                                  │
│                    id (uuid PK)                                  │
│                    email                                         │
│                    encrypted_password                            │
└──────────────────────────────────────────────────────────────────┘
            │                      │                       │
            │ 1:1                  │ 1:N                   │ 1:N
            ▼                      ▼                       ▼
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│     profiles       │   │     user_roles     │   │  ai_conversations  │
│  ────────────      │   │  ────────────      │   │  ────────────      │
│  id (uuid PK)      │   │  id (uuid PK)      │   │  id (uuid PK)      │
│  user_id (uniq)    │   │  user_id           │   │  user_id           │
│  display_name      │   │  role: app_role    │   │  model             │
│  email             │   │  created_at        │   │  messages (jsonb)  │
│  avatar_url        │   │  UNIQUE(user_id,   │   │  tokens_used       │
│  department        │   │         role)      │   │  created_at        │
│  mfa_enabled       │   └────────────────────┘   │  updated_at        │
│  created_at        │                            └────────────────────┘
│  updated_at        │
└────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       Tabelas operacionais                       │
└──────────────────────────────────────────────────────────────────┘

┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│     incidents      │   │      clusters      │   │    audit_logs      │
│  ────────────      │   │  ────────────      │   │  ────────────      │
│  id (uuid PK)      │   │  id (uuid PK)      │   │  id (uuid PK)      │
│  title             │   │  name              │   │  user_id (nullable)│
│  description       │   │  provider:         │   │  action            │
│  severity:         │   │   cluster_provider │   │  resource_type     │
│   incident_severity│   │  environment       │   │  resource_id       │
│  status:           │   │  status:           │   │  ip_address        │
│   incident_status  │   │   cluster_status   │   │  details (jsonb)   │
│  environment       │   │  region            │   │  created_at        │
│  service           │   │  api_endpoint      │   └────────────────────┘
│  source            │   │  node_count        │
│  assigned_to       │   │  kubernetes_version│   ↑ Append-only,
│  resolved_at       │   │  created_by        │     LGPD compliance
│  mttr_minutes      │   │  created_at        │
│  created_by        │   │  updated_at        │
│  created_at        │   └────────────────────┘
│  updated_at        │
└────────────────────┘
```

---

## 2. Enums (USER-DEFINED types)

### 2.1 `app_role`
| Valor      | Descrição                                       |
| ---------- | ----------------------------------------------- |
| `admin`    | Acesso total + administração + RLS bypass       |
| `operator` | SRE — pode criar/editar incidentes e clusters   |
| `viewer`   | Somente leitura                                 |
| `auditor`  | Acesso aos logs de auditoria + leitura          |

### 2.2 `incident_severity`
| Valor      | SLA resposta | SLA resolução |
| ---------- | ------------ | ------------- |
| `critical` | 5 min        | 1h            |
| `high`     | 15 min       | 4h            |
| `medium`   | 1h           | 24h           |
| `low`      | 4h           | 72h           |

### 2.3 `incident_status`
| Valor           | Significado                                  |
| --------------- | -------------------------------------------- |
| `open`          | Recém-criado, aguardando triagem             |
| `investigating` | Em análise pela equipe                       |
| `mitigating`    | Ação de remediação em curso                  |
| `resolved`      | Solução aplicada, monitorando                |
| `closed`        | Confirmado, RCA documentada                  |

### 2.4 `cluster_provider`
`eks`, `gke`, `aks`, `cce`, `oke`, `openshift`, `openshift_local`, `okd`, `rancher`

### 2.5 `cluster_status`
`active`, `inactive`, `provisioning`, `error`, `maintenance`

---

## 3. Tabelas — detalhamento

### 3.1 `profiles`
**Propósito:** dados públicos de usuário (não sensíveis).

| Coluna         | Tipo                       | Default              | Notes                |
| -------------- | -------------------------- | -------------------- | -------------------- |
| `id`           | uuid PK                    | `gen_random_uuid()`  |                      |
| `user_id`      | uuid NOT NULL              | -                    | FK lógica → `auth.users.id` |
| `display_name` | text                       | NULL                 |                      |
| `email`        | text                       | NULL                 |                      |
| `avatar_url`   | text                       | NULL                 |                      |
| `department`   | text                       | NULL                 | Ex: "TI / SRE"       |
| `mfa_enabled`  | boolean NOT NULL           | `false`              |                      |
| `created_at`   | timestamptz NOT NULL       | `now()`              |                      |
| `updated_at`   | timestamptz NOT NULL       | `now()`              | Trigger auto-update  |

> ⚠️ **NUNCA armazenar `role` aqui** — usar `user_roles` para evitar privilege escalation.

### 3.2 `user_roles`
**Propósito:** RBAC isolado, consultado por `has_role()` e `has_any_role()`.

| Coluna       | Tipo            | Default              |
| ------------ | --------------- | -------------------- |
| `id`         | uuid PK         | `gen_random_uuid()`  |
| `user_id`    | uuid NOT NULL   | -                    |
| `role`       | `app_role`      | -                    |
| `created_at` | timestamptz     | `now()`              |
| **UNIQUE**   | `(user_id, role)` |                    |

### 3.3 `incidents`
**Propósito:** registros operacionais com SLA e MTTR.

| Coluna          | Tipo                  | Default                |
| --------------- | --------------------- | ---------------------- |
| `id`            | uuid PK               | `gen_random_uuid()`    |
| `title`         | text NOT NULL         |                        |
| `description`   | text                  | NULL                   |
| `severity`      | `incident_severity`   | `'medium'`             |
| `status`        | `incident_status`     | `'open'`               |
| `environment`   | text NOT NULL         | `'production'`         |
| `service`       | text                  | NULL                   |
| `source`        | text NOT NULL         | `'manual'`             |
| `assigned_to`   | uuid                  | NULL                   |
| `created_by`    | uuid                  | NULL                   |
| `resolved_at`   | timestamptz           | NULL                   |
| `mttr_minutes`  | integer               | NULL (calculado ao resolver) |
| `created_at`    | timestamptz NOT NULL  | `now()`                |
| `updated_at`    | timestamptz NOT NULL  | `now()`                |

### 3.4 `clusters`
**Propósito:** inventário multi-cloud Kubernetes.

| Coluna               | Tipo               | Default              |
| -------------------- | ------------------ | -------------------- |
| `id`                 | uuid PK            | `gen_random_uuid()`  |
| `name`               | text NOT NULL      |                      |
| `provider`           | `cluster_provider` |                      |
| `environment`        | text NOT NULL      | `'production'`       |
| `status`             | `cluster_status`   | `'active'`           |
| `region`             | text               | NULL                 |
| `api_endpoint`       | text               | NULL                 |
| `node_count`         | integer            | `0`                  |
| `kubernetes_version` | text               | NULL                 |
| `created_by`         | uuid               | NULL                 |
| `created_at`         | timestamptz        | `now()`              |
| `updated_at`         | timestamptz        | `now()`              |

### 3.5 `audit_logs`
**Propósito:** trilha LGPD/SISP. **Append-only** (sem UPDATE/DELETE policies).

| Coluna          | Tipo            | Default              | Exemplo               |
| --------------- | --------------- | -------------------- | --------------------- |
| `id`            | uuid PK         | `gen_random_uuid()`  |                       |
| `user_id`       | uuid            | NULL                 | autor da ação         |
| `action`        | text NOT NULL   |                      | `INCIDENT_CREATED`    |
| `resource_type` | text NOT NULL   |                      | `incidents`           |
| `resource_id`   | text            | NULL                 | uuid do recurso       |
| `ip_address`    | text            | NULL                 | `200.10.20.30`        |
| `details`       | jsonb           | `'{}'`               | metadata da ação      |
| `created_at`    | timestamptz     | `now()`              |                       |

### 3.6 `ai_conversations`
**Propósito:** histórico de chat IA por usuário.

| Coluna         | Tipo            | Default                              |
| -------------- | --------------- | ------------------------------------ |
| `id`           | uuid PK         | `gen_random_uuid()`                  |
| `user_id`      | uuid NOT NULL   |                                      |
| `model`        | text NOT NULL   | `'google/gemini-2.5-flash'`          |
| `messages`     | jsonb NOT NULL  | `'[]'`                               |
| `tokens_used`  | integer         | `0`                                  |
| `created_at`   | timestamptz     | `now()`                              |
| `updated_at`   | timestamptz     | `now()`                              |

---

## 4. Funções de Banco

### 4.1 `update_updated_at_column()` — trigger function
Atualiza `updated_at = now()` antes de cada UPDATE. Aplicado a: `profiles`, `incidents`, `clusters`, `ai_conversations`.

### 4.2 `has_role(_user_id uuid, _role app_role) → boolean`
**SECURITY DEFINER** + `STABLE` — evita recursão RLS. Usada em todas as policies.

```sql
SELECT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = _user_id AND role = _role
)
```

### 4.3 `has_any_role(_user_id uuid, _roles app_role[]) → boolean`
Versão batch para verificar múltiplas roles em uma chamada.

---

## 5. Triggers

| Tabela              | Trigger                           | Função                          |
| ------------------- | --------------------------------- | ------------------------------- |
| `profiles`          | `BEFORE UPDATE` row-level         | `update_updated_at_column()`    |
| `incidents`         | `BEFORE UPDATE` row-level         | `update_updated_at_column()`    |
| `clusters`          | `BEFORE UPDATE` row-level         | `update_updated_at_column()`    |
| `ai_conversations`  | `BEFORE UPDATE` row-level         | `update_updated_at_column()`    |

---

## 6. Índices recomendados (futuro)

```sql
CREATE INDEX idx_incidents_status_severity ON incidents(status, severity)
  WHERE status NOT IN ('resolved', 'closed');

CREATE INDEX idx_incidents_created_at ON incidents(created_at DESC);

CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
```

---

## 7. Realtime

Tabelas habilitadas para `postgres_changes`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
```

Consumido em `src/hooks/useRealtimeData.ts`.

---

## 8. Backup & Retenção

- **Snapshot diário** automático pela Lovable Cloud (retenção 7 dias).
- **`audit_logs`:** retenção mínima **5 anos** (exigência SISP/LGPD).
- **`ai_conversations`:** retenção 90 dias (configurável).
- **`incidents` resolvidos:** arquivamento após 1 ano.
