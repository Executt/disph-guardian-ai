# 02 — Arquitetura da Aplicação

---

## 1. Visão Geral (C4 — Nível 1)

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUÁRIOS                                │
│  Admin · Operador SRE · Auditor · Visualizador                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (HTTPS + MFA TOTP)
┌─────────────────────────────────────────────────────────────────┐
│                  DISPH-AIOPS (Frontend SPA)                     │
│        React 18 + Vite 5 + TypeScript + TailwindCSS             │
│              [Top Nav · 7 Páginas · 40+ Componentes]            │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Lovable Cloud   │ │  Edge Function   │ │   Integrações    │
│   (Supabase)     │ │   ai-chat        │ │   externas       │
│                  │ │   (Deno)         │ │                  │
│ • PostgreSQL 15  │ │  ↓ proxy         │ │ • Zabbix / Graf. │
│ • RLS por tabela │ │  Lovable AI GW   │ │ • GitLab / Argo  │
│ • Auth + MFA     │ │  (Gemini, GPT-5) │ │ • SonarQube/Quay │
│ • Realtime       │ │                  │ │ • LDAP / SMTP    │
└──────────────────┘ └──────────────────┘ │ • SEI / GLPI     │
                                          └──────────────────┘
```

---

## 2. Stack Técnica

### 2.1 Frontend

| Camada            | Tecnologia            | Versão  | Função                                    |
| ----------------- | --------------------- | ------- | ----------------------------------------- |
| Framework         | React                 | 18.3    | UI declarativa                            |
| Build             | Vite                  | 5.4     | Dev server + bundler ESM                  |
| Linguagem         | TypeScript            | 5.5     | Tipagem estática                          |
| Estilo            | TailwindCSS           | 3.4     | Utility-first CSS                         |
| Componentes       | shadcn/ui + Radix     | latest  | Primitivos acessíveis                     |
| Routing           | react-router-dom      | 6.30    | SPA routing                               |
| Estado servidor   | @tanstack/react-query | 5.83    | Cache + sync                              |
| Forms             | react-hook-form + zod | 7.61 / 3.25 | Validação tipada                       |
| Charts            | recharts              | 2.15    | Gráficos SVG                              |
| Markdown          | react-markdown        | 9.1     | Render no chat IA                         |
| Animação          | framer-motion         | 12.x    | Transições                                |
| Ícones            | lucide-react          | 0.462   | SVG icon set                              |
| Toast             | sonner                | 1.7     | Notificações                              |

### 2.2 Backend

| Componente        | Tecnologia              | Hospedagem        |
| ----------------- | ----------------------- | ----------------- |
| Banco de dados    | PostgreSQL 15           | Lovable Cloud     |
| Autenticação      | Supabase Auth + TOTP    | Lovable Cloud     |
| Edge Functions    | Deno + TS               | Supabase Edge     |
| AI Gateway        | Lovable AI Gateway      | `ai.gateway.lovable.dev` |
| Storage           | Supabase Storage        | (não usado ainda) |
| Realtime          | Supabase Realtime       | WebSocket         |

### 2.3 Sidecar opcional (Python)

`disph-aiops-backend/` — FastAPI com skills de automação (Ansible, GitLab, K8s, ITSM). Pode rodar em ambiente on-prem para ações que não cabem em Edge Functions (ex.: kubectl exec).

---

## 3. Estrutura de Diretórios

```
disph-aiops/
│
├── docs/                            ← 📚 Documentação técnica (11 arquivos .md)
│
├── public/                          ← Assets estáticos
│   ├── placeholder.svg
│   └── robots.txt
│
├── src/
│   ├── components/                  ← UI compartilhada
│   │   ├── ui/                      ← shadcn/ui (40+ primitivos)
│   │   ├── AppLayout.tsx            ← Shell com TopNav + Outlet
│   │   ├── TopNav.tsx               ← Navegação horizontal (Grafana-style)
│   │   ├── ProtectedRoute.tsx       ← Guard de rota por role
│   │   ├── AIChatConsole.tsx        ← Console IA flutuante
│   │   ├── EnvironmentFilter.tsx    ← Filtro Prod/Hml/Dev
│   │   ├── MetricCard.tsx           ← KPI card padrão
│   │   ├── StatusBadge.tsx          ← Badge de status
│   │   ├── NavLink.tsx              ← Link nav reutilizável
│   │   └── AppSidebar.tsx           ← (legado — substituído por TopNav)
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx          ← Mock Keycloak + MFA + roles
│   │
│   ├── hooks/
│   │   ├── useRealtimeData.ts       ← Subscription Supabase Realtime
│   │   ├── use-toast.ts             ← Toast wrapper
│   │   └── use-mobile.tsx           ← Breakpoint < 768
│   │
│   ├── pages/                       ← 7 rotas principais
│   │   ├── Index.tsx                ← Dashboard consolidado
│   │   ├── IncidentsPage.tsx        ← Lista + detalhes de incidentes
│   │   ├── InfrastructurePage.tsx   ← Inventário multi-cloud
│   │   ├── DevSecOpsPage.tsx        ← Pipelines + segurança
│   │   ├── AuditPage.tsx            ← Logs LGPD
│   │   ├── AdminPage.tsx            ← Centro de administração
│   │   ├── SettingsPage.tsx         ← Preferências do usuário
│   │   ├── LoginPage.tsx            ← Login + MFA
│   │   └── NotFound.tsx             ← 404
│   │
│   ├── integrations/supabase/       ← 🔒 Auto-gerado, NÃO EDITAR
│   │   ├── client.ts
│   │   └── types.ts
│   │
│   ├── lib/
│   │   └── utils.ts                 ← cn() helper
│   │
│   ├── App.tsx                      ← Router + providers
│   ├── main.tsx                     ← Entry
│   └── index.css                    ← Design tokens
│
├── supabase/
│   ├── config.toml                  ← Project ref
│   ├── functions/
│   │   └── ai-chat/index.ts         ← Edge Function — proxy Lovable AI
│   └── migrations/                  ← 🔒 SQL versionado
│
├── disph-aiops-backend/             ← Sidecar Python (opcional)
│   ├── app/
│   │   ├── api/                     ← Routes FastAPI
│   │   ├── services/                ← LLM, embedding, ITSM, notifications
│   │   └── skills/                  ← Ansible, GitLab, K8s, monitoring
│   └── requirements.txt
│
├── README.md
├── package.json
├── tailwind.config.ts
├── vite.config.ts
└── tsconfig.json
```

---

## 4. Rotas da Aplicação

| Rota              | Página              | Roles permitidas              | Função                            |
| ----------------- | ------------------- | ----------------------------- | --------------------------------- |
| `/login`          | `LoginPage`         | público                       | Auth + MFA TOTP                   |
| `/`               | `Index`             | autenticado                   | Dashboard consolidado             |
| `/incidents`      | `IncidentsPage`     | autenticado                   | Gestão de incidentes              |
| `/infrastructure` | `InfrastructurePage`| `admin`, `operator`           | Inventário multi-cloud            |
| `/devsecops`      | `DevSecOpsPage`     | `admin`, `operator`           | Pipelines + segurança             |
| `/audit`          | `AuditPage`         | `admin`, `auditor`            | Logs de auditoria                 |
| `/admin`          | `AdminPage`         | `admin`                       | LDAP, SMTP, SEI, RBAC, integrações |
| `/settings`       | `SettingsPage`      | autenticado                   | Preferências do usuário           |
| `*`               | `NotFound`          | público                       | 404                               |

Rotas protegidas usam `<ProtectedRoute requiredRoles={[...]}>` em `src/App.tsx`.

---

## 5. Fluxo de Dados

### 5.1 Leitura (queries)

```
Componente
  ↓ useQuery
TanStack Query cache (5min)
  ↓ miss
supabase.from('table').select()
  ↓ HTTPS
PostgREST (Lovable Cloud)
  ↓ RLS check
PostgreSQL → resposta JSON
```

### 5.2 Escrita (mutations)

```
Form (react-hook-form + zod)
  ↓ submit válido
useMutation
  ↓
supabase.from('table').insert/update()
  ↓ Auth header (JWT)
RLS verifica has_role(auth.uid(), 'admin')
  ↓ permitido
INSERT + trigger update_updated_at_column
  ↓
Realtime broadcast → outros clients
  ↓
Toast sucesso + queryClient.invalidate()
```

### 5.3 Chat IA

```
AIChatConsole
  ↓ POST { messages, model }
Edge Function ai-chat
  ↓ injeta OPERATIONAL_CONTEXT
Lovable AI Gateway
  ↓ stream SSE
Token-by-token render (react-markdown)
```

---

## 6. Estado da aplicação

| Tipo              | Onde mora                  | Exemplos                                |
| ----------------- | -------------------------- | --------------------------------------- |
| Estado servidor   | TanStack Query             | Lista de incidentes, clusters, logs     |
| Estado auth       | AuthContext (React)        | `user`, `roles`, `realm`                |
| Estado UI local   | `useState` no componente   | Modal aberto, filtros, busca            |
| Estado de form    | react-hook-form            | Inputs, validação, submit               |
| Tema              | CSS vars em `:root`        | (sem light theme — dark only)           |

---

## 7. Build & Deploy

| Stage     | Comando                  | Output                                  |
| --------- | ------------------------ | --------------------------------------- |
| Dev       | `bun run dev`            | http://localhost:5173 com HMR           |
| Lint      | `bun run lint`           | ESLint + TS                             |
| Build     | `bun run build`          | `dist/` minificado, code-splitting      |
| Preview   | `bun run preview`        | Serve `dist/` local                     |
| Deploy    | Lovable platform         | CDN edge + edge functions auto-deploy   |

Edge functions em `supabase/functions/` são deployadas automaticamente na publicação.

---

## 8. Conexões externas suportadas

Configuráveis via **Admin → Integrações**:

- **Observabilidade:** Zabbix, Grafana, Prometheus, Loki
- **Source Control:** GitLab, GitHub
- **CD:** ArgoCD
- **Quality:** SonarQube
- **Registry:** Quay, Harbor
- **Cluster:** kube-apiserver de EKS, GKE, AKS, OKE, CCE, OpenShift, OKD, Rancher
- **ITSM:** GLPI, Jira, ServiceNow, CITSmart, Azure DevOps, **SEI**
- **Notif:** Microsoft Teams (webhook), WhatsApp (Z-API/Evolution), SMTP
- **IDP:** LDAP/AD (LDAPS), Keycloak (futuro: SAML/OIDC)

---

## 9. Princípios arquiteturais

- **Separation of concerns:** UI ⇄ hooks ⇄ data layer (`@/integrations/supabase/client`).
- **Fail-fast com TS strict.**
- **No client-side admin checks:** sempre via RLS + `has_role()`.
- **Edge Functions stateless** — toda persistência via Postgres.
- **Realtime by default** para incidentes (Postgres Changes).
- **Internacionalização:** UI em pt-BR; pronto para i18n futuro.

---

## Atualização — Auditoria Jun/2026

**Rotas reais (12 páginas):** `/`, `/login`, `/incidents`, `/ar`, `/agents`, `/agents/:id`, `/skills-catalog`, `/devsecops`, `/infrastructure`, `/audit`, `/admin`, `/settings`.

**Roles por rota (corrigido):**
- `/audit` — `admin, auditor` (anteriormente só admin, era bug).
- `/agents`, `/agents/:id`, `/skills-catalog`, `/devsecops`, `/infrastructure` — `admin, operator`.
- `/admin`, `/settings` — `admin`.

**Componentes:**
- Navegação top-bar via `TopNav`. `AppSidebar` foi **removido** (era dead code).
- Toaster único (`sonner`); o `Toaster` shadcn duplicado foi removido de `App.tsx`.

**SEI (Sistema Eletrônico de Informações):** marcado como **roadmap / não implementado**. Removido das integrações ativas. Atual stack ITSM: GLPI, Jira, ServiceNow, CITSmart, Freshservice, Azure DevOps.

**Modelos de IA:** centralizados em `src/lib/aiModels.ts` (fonte única). `AIChatConsole`, `SettingsPage`, `AdminPage`, `AgentsPage`, `AgentDetailPage` consomem desta lib.
