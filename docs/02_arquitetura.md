# 02 — Arquitetura da Aplicação

## 1. Contexto (C4 — Nível 1)

```text
┌──────────────────────────────────────────────────────────────┐
│  USUÁRIOS: Admin · Operador SRE · Auditor · Visualizador     │
└──────────────────────────────────────────────────────────────┘
                    │ HTTPS + MFA TOTP
                    ▼
┌──────────────────────────────────────────────────────────────┐
│           DISPH-AIOPS — SPA React 18 + Vite 5 + TS           │
│      TopNav · 18 rotas · assistente IA lateral (slide-over)  │
└──────────────────────────────────────────────────────────────┘
       │                  │                      │
       ▼                  ▼                      ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│ Lovable Cloud│  │  Edge Functions  │  │ Integrações externas │
│ PostgreSQL 15│  │  (Deno, 8 fn)    │  │ CTIR Gov · NVD       │
│ RLS por tab. │  │  ai-chat         │  │ Zabbix/Grafana       │
│ Auth + MFA   │  │  sync-ctir       │  │ GitLab/ArgoCD        │
│ Realtime     │  │  sync-nvd        │  │ GLPI/Jira/ServiceNow │
│ Storage      │  │  ar-audit        │  │ Teams/WhatsApp/Slack │
│ pg_cron      │  │  hypervisor-*    │  │ vSphere/Hyper-V      │
└──────────────┘  │  notify-*, itsm  │  │ LDAP/AD · SMTP       │
                  └──────────────────┘  └──────────────────────┘
                            ▲
                            │ ingest autenticado
                  ┌──────────────────────┐
                  │ Sidecar FastAPI /    │
                  │ agente Python on-prem│
                  └──────────────────────┘
```

---

## 2. Stack

### 2.1 Frontend

| Camada | Tecnologia | Versão |
| --- | --- | --- |
| Framework | React | 18.3 |
| Build | Vite | 5.4 |
| Linguagem | TypeScript | 5.x |
| Estilo | TailwindCSS | 3.4 |
| Componentes | shadcn/ui + Radix | latest |
| Routing | react-router-dom | 6.30 |
| Estado servidor | @tanstack/react-query | 5.83 |
| Virtualização | @tanstack/react-virtual | 3.x |
| Forms | react-hook-form + zod | 7.61 / 3.x |
| Charts | recharts | 2.x |
| PDF/CSV | jspdf + jspdf-autotable | 4.x / 5.x |
| Markdown | react-markdown | 10.x |
| Ícones | lucide-react | 0.462 |
| Toast | sonner | 1.7 |
| Testes | vitest + Testing Library + Playwright | — |

### 2.2 Backend gerenciado

| Componente | Tecnologia |
| --- | --- |
| Banco | PostgreSQL 15 (Lovable Cloud) |
| Auth | Supabase Auth + TOTP |
| Serverless | Edge Functions (Deno) |
| Agendamento | `pg_cron` + `pg_net` |
| Storage | bucket privado `ctir-exports` |
| Realtime | Postgres Changes via WebSocket |
| IA | Lovable AI Gateway (sem chave do usuário) |

### 2.3 Sidecar opcional

`disph-aiops-backend/` — FastAPI com registry de skills (Ansible, GitLab, Kubernetes, monitoring, ITSM, notificações) e o agente `agents/hypervisor_agent.py` (pyVmomi/pywinrm) para coleta on-prem que não cabe em Edge Function.

---

## 3. Estrutura de diretórios

```text
disph-aiops/
├── docs/                              30 documentos
├── src/
│   ├── components/                    UI compartilhada + ui/ (shadcn)
│   ├── contexts/AuthContext.tsx       sessão, papéis, MFA
│   ├── hooks/                         useExportQueue, useSyncProgress,
│   │                                  useWindowedRows, useRealtimeData
│   ├── lib/                           aiModels, agentSkills,
│   │                                  ctirAuditExport, utils
│   ├── pages/                         18 páginas + NotFound
│   ├── integrations/supabase/         auto-gerado — NÃO EDITAR
│   ├── App.tsx / main.tsx / index.css
├── supabase/
│   ├── config.toml
│   ├── functions/                     8 Edge Functions
│   └── migrations/                    SQL versionado
└── disph-aiops-backend/               sidecar Python
```

---

## 4. Fluxos principais

### 4.1 Leitura

```text
Componente → useQuery → cache TanStack (5 min)
  → supabase.from(...).select() → PostgREST → RLS → PostgreSQL
```

### 4.2 Escrita

```text
Form (react-hook-form + zod) → useMutation
  → insert/update com JWT → RLS has_role(auth.uid(), ...)
  → trigger update_updated_at_column → Realtime broadcast
  → toast + queryClient.invalidateQueries
```

### 4.3 Sincronização CTIR

```text
pg_cron 06:00 UTC → pg_net → sync-ctir-advisories
  → conditional GET (ETag / If-Modified-Since) por feed
  → 304? encerra feed  |  200? parse RSS → fallback HTML Plone
  → upsert ctir_advisories → cria assessments pending por ambiente
  → grava ctir_sync_state e sync_alerts
  → falha após backoff → notify-sync-failure (Teams/WhatsApp + ticket)
```

### 4.4 Exportação assíncrona

```text
UI enfileira export_jobs (queued, filtros jsonb)
  → worker local processa em fatias de 250 linhas, cede event loop
  → progress 0→100 → upload em ctir-exports/<uid>/<jobId>.<ext>
  → download via URL assinada de 60s
  → falha → status=failed + error exibidos no painel
```

### 4.5 Chat IA

```text
Assistente lateral → POST { messages, model }
  → Edge Function ai-chat (injeta OPERATIONAL_CONTEXT)
  → Lovable AI Gateway → stream SSE → render token a token
```

---

## 5. Estado da aplicação

| Tipo | Onde mora | Exemplos |
| --- | --- | --- |
| Servidor | TanStack Query | advisories, incidentes, CVEs, hosts |
| Autenticação | `AuthContext` | `user`, `roles`, MFA pendente |
| UI compartilhável | Query params da URL | aba, filtros, página, scroll, nó da árvore |
| UI efêmera | `useState` | modais, buscas locais |
| Formulário | react-hook-form | inputs e validação |

---

## 6. Build e deploy

| Estágio | Comando | Saída |
| --- | --- | --- |
| Dev | `bun run dev` | HMR local |
| Lint | `bun run lint` | ESLint + TS |
| Testes | `bun run test` | Vitest |
| Build | `bun run build` | `dist/` com code-splitting |
| Deploy | plataforma Lovable | CDN + edge functions automáticas |

---

## 7. Princípios arquiteturais

1. **Separação de camadas** — UI ⇄ hooks ⇄ acesso a dados (`@/integrations/supabase/client`).
2. **Nenhuma checagem de papel no cliente como controle de acesso** — a autoridade é RLS + `has_role()`.
3. **Edge Functions stateless** — toda persistência em PostgreSQL.
4. **Idempotência em sincronizações** — upsert por chave natural (`code`, `cve_id`).
5. **Estado compartilhável na URL** — todo deep-link reproduz a tela.
6. **Degradação graciosa** — RSS → HTML; WebSocket → polling; fila → exportação síncrona.
7. **Observabilidade nativa** — cada job grava estado, alertas e trilha auditável.
