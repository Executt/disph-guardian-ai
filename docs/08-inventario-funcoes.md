# 08 — Inventário de Funções

> Catálogo completo dos artefatos de software entregues: **7 páginas, 1 edge function, 5 hooks, 40+ componentes UI, 3 funções de banco**.

---

## 1. Páginas (Routes) — 7

| #  | Rota              | Componente            | Roles               | Função-resumo                                    |
| -- | ----------------- | --------------------- | ------------------- | ------------------------------------------------ |
| 1  | `/`               | `Index`               | autenticado         | Dashboard com KPIs, gráficos e AI chat           |
| 2  | `/incidents`      | `IncidentsPage`       | autenticado         | Tabela de incidentes + criação + remediação      |
| 3  | `/infrastructure` | `InfrastructurePage`  | admin, operator     | Inventário multi-cloud de clusters e nós         |
| 3b | `/hypervisors`    | `HypervisorsPage`     | admin, operator, viewer | Hosts VMware/Hyper-V, VMs em risco e pontos de falha (mock) |
| 4  | `/devsecops`      | `DevSecOpsPage`       | admin, operator     | Pipelines GitLab, scans SonarQube/Quay           |
| 5  | `/audit`          | `AuditPage`           | admin, auditor      | Logs de auditoria filtrados (LGPD)               |
| 6  | `/admin`          | `AdminPage`           | admin               | **Centro de Administração** (ver doc 11)         |
| 7  | `/settings`       | `SettingsPage`        | autenticado         | Preferências do usuário (perfil, MFA, idioma)    |
| +  | `/login`          | `LoginPage`           | público             | Auth + MFA TOTP                                  |
| +  | `*`               | `NotFound`            | público             | 404                                              |

---

## 2. Edge Functions — 1

| Function    | Path                                | Auth | Streaming | Função                                |
| ----------- | ----------------------------------- | ---- | --------- | ------------------------------------- |
| `ai-chat`   | `supabase/functions/ai-chat/index.ts` | JWT | SSE       | Proxy Lovable AI + contexto operacional |

---

## 3. Hooks customizados — 5

| Hook                  | Arquivo                       | Função                                          |
| --------------------- | ----------------------------- | ----------------------------------------------- |
| `useAuth`             | `src/contexts/AuthContext.tsx`| `user`, `roles`, `login`, `logout`, MFA         |
| `useRealtimeData`     | `src/hooks/useRealtimeData.ts`| Subscription Supabase Realtime                  |
| `useToast`            | `src/hooks/use-toast.ts`      | Wrapper sonner com variants                     |
| `useIsMobile`         | `src/hooks/use-mobile.tsx`    | breakpoint < 768                                |
| `useNavigate` (+rrd)  | `react-router-dom`            | Navegação programática (não custom mas central) |

---

## 4. Componentes Compartilhados — 11 + 40 UI

### 4.1 Componentes de aplicação (11)

| Componente            | Arquivo                                   | Função                                |
| --------------------- | ----------------------------------------- | ------------------------------------- |
| `AppLayout`           | `src/components/AppLayout.tsx`            | Shell: TopNav + Outlet                |
| `TopNav`              | `src/components/TopNav.tsx`               | Nav horizontal Grafana-style          |
| `AppSidebar`          | `src/components/AppSidebar.tsx`           | (legado, mantido para fallback)       |
| `ProtectedRoute`      | `src/components/ProtectedRoute.tsx`       | Guard de rota por role                |
| `AIChatConsole`       | `src/components/AIChatConsole.tsx`        | Chat IA flutuante com streaming       |
| `EnvironmentFilter`   | `src/components/EnvironmentFilter.tsx`    | Toggle Prod/Hml/Dev                   |
| `MetricCard`          | `src/components/MetricCard.tsx`           | KPI card padrão                       |
| `StatusBadge`         | `src/components/StatusBadge.tsx`          | Badge colorido por status             |
| `NavLink`             | `src/components/NavLink.tsx`              | Link nav reutilizável                 |

### 4.2 shadcn/ui primitivos (40+)

`accordion`, `alert-dialog`, `alert`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`, `input-otp`, `input`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toaster`, `toggle-group`, `toggle`, `tooltip`.

---

## 5. Contexts — 1

| Context        | Provê                                     |
| -------------- | ----------------------------------------- |
| `AuthContext`  | `user`, `roles`, `realm`, `login`, `logout`, `verifyMfa` |

---

## 6. Funções de Banco — 3

| Função                          | Tipo               | Uso principal               |
| ------------------------------- | ------------------ | --------------------------- |
| `update_updated_at_column()`    | trigger            | Atualiza `updated_at`       |
| `has_role(uuid, app_role)`      | SECURITY DEFINER   | RLS policies                |
| `has_any_role(uuid, app_role[])`| SECURITY DEFINER   | RLS multi-role              |

---

## 7. Tabelas — 6

(Detalhadas em `docs/03-database-schema.md`)

`profiles` · `user_roles` · `incidents` · `clusters` · `audit_logs` · `ai_conversations`

---

## 8. Enums — 5

`app_role` · `incident_severity` · `incident_status` · `cluster_provider` · `cluster_status`

---

## 9. Sidecar Python (opcional)

| Módulo                                      | Função                            |
| ------------------------------------------- | --------------------------------- |
| `app/api/incidents.py`                      | Endpoints REST de triagem         |
| `app/api/notifications.py`                  | Disparo de canais                 |
| `app/api/rag.py`                            | RAG sobre knowledge base          |
| `app/api/skills.py`                         | Execução de skills                |
| `app/services/llm.py`                       | Cliente OpenAI/Ollama             |
| `app/services/embedding.py`                 | Vector embeddings                 |
| `app/services/guardrails.py`                | Filtros de segurança              |
| `app/services/itsm/client.py`               | Adapter ITSM (GLPI/SEI/Jira)      |
| `app/services/notifications/teams.py`       | Webhook Teams                     |
| `app/services/notifications/whatsapp.py`    | Z-API/Evolution                   |
| `app/skills/ansible_skills.py`              | Run Ansible playbook              |
| `app/skills/gitlab_skills.py`               | Trigger pipeline                  |
| `app/skills/kubernetes_skills.py`           | kubectl ops                       |
| `app/skills/itsm_skills.py`                 | Open/close ticket                 |
| `app/skills/monitoring_skills.py`           | Query Zabbix/Prometheus           |
| `app/skills/notification_skills.py`         | Send notifications                |
| `app/skills/registry.py`                    | Skill registry/dispatch           |

---

## 10. Estatísticas

| Métrica                                  | Valor       |
| ---------------------------------------- | ----------- |
| Linhas de TypeScript (src/)              | ~6.500      |
| Linhas de SQL (migrations)               | ~280        |
| Linhas de Python (sidecar)               | ~2.100      |
| Componentes React totais                 | 51+         |
| Páginas com rota                         | 7 + 2       |
| Tabelas com RLS                          | 6/6 ✅      |
| Tabelas com realtime                     | 2           |
| Edge functions                           | 1           |
| Skills Python                            | 7           |
| Provedores de cluster suportados         | 9           |
| Provedores ITSM suportados               | 6 (+ SEI)   |
| Modelos LLM disponíveis                  | 9           |

---

## Atualização — Auditoria Jun/2026

**Páginas (12, não 7):** Index, LoginPage, IncidentsPage, ARPage, AgentsPage, AgentDetailPage, SkillsCatalogPage, DevSecOpsPage, InfrastructurePage, AuditPage, AdminPage, SettingsPage, NotFound.

**Hooks ativos:** `useAuth`, `useRealtimeData`, `use-toast`, `use-mobile`.

**Componentes removidos/consolidados:**
- `AppSidebar.tsx` — **deletado** (dead code, nunca importado).
- `Toaster` shadcn — removido de `App.tsx` (mantido apenas Sonner).

**Libs centrais:**
- `src/lib/aiModels.ts` — fonte única de modelos LLM.
- `src/lib/agentSkills.ts` — catálogo de skills (espelha registry do backend).
