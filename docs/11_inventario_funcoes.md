# 11 — Inventário de Funções

Mapa de todo o código funcional: páginas, componentes, hooks, bibliotecas, Edge Functions e skills do sidecar.

---

## 1. Páginas (`src/pages/`)

| Arquivo | Rota | Responsabilidade |
| --- | --- | --- |
| `Index.tsx` | `/` | Dashboard consolidado: KPIs, incidentes recentes, saúde geral |
| `LoginPage.tsx` | `/login` | Autenticação e desafio TOTP |
| `SecurityOverviewPage.tsx` | `/security-overview` | Funil NIST de 5 estágios e medidor de conformidade CTIR |
| `CtirSyncAuditPage.tsx` | `/security-overview/ctir-audit` | Auditoria de sincronização: KPIs, execuções, alertas, árvore de causa-raiz, exportação |
| `ARPage.tsx` | `/ar` | Alertas e Recomendações: análise cruzada, catálogo, cobertura, sincronização, auditoria de ordenação |
| `VulnerabilitiesPage.tsx` | `/vulnerabilities` | Lista de CVEs, filtros e CRUD da watchlist |
| `CveDetailPage.tsx` | `/vulnerabilities/:cveId` | Detalhe de CVE: vetor CVSS, referências, histórico |
| `IncidentsPage.tsx` | `/incidents` | Gestão de incidentes com Realtime |
| `InfrastructurePage.tsx` | `/infrastructure` | Inventário multi-cloud e clusters |
| `HypervisorsPage.tsx` | `/hypervisors` | Saúde de hosts, VMs sintomáticas, pontos de falha |
| `AgentsPage.tsx` | `/agents` | Lista e criação de agentes |
| `AgentDetailPage.tsx` | `/agents/:id` | Perfil, skills, canais e histórico de execuções |
| `AgentStatusPage.tsx` | `/agents/status` | Heartbeat e logs do agente on-prem |
| `SkillsCatalogPage.tsx` | `/skills-catalog` | Catálogo global de skills com busca e filtros |
| `DevSecOpsPage.tsx` | `/devsecops` | Pipelines, qualidade e segurança de esteira |
| `AuditPage.tsx` | `/audit` | Trilha de auditoria LGPD |
| `SystemAuditPage.tsx` | `/system-audit` | Achados técnicos com evidências e status |
| `AdminPage.tsx` | `/admin` | LDAP, SMTP, RBAC e integrações |
| `SettingsPage.tsx` | `/settings` | Preferências e modelo de IA padrão |
| `NotFound.tsx` | `*` | 404 |

---

## 2. Componentes (`src/components/`)

| Componente | Função |
| --- | --- |
| `AppLayout.tsx` | Shell: TopNav, `Outlet`, assistente lateral com backdrop |
| `TopNav.tsx` | Navegação horizontal agrupada, filtrada por papel |
| `NavLink.tsx` | Item de navegação com estado ativo |
| `ProtectedRoute.tsx` | Guarda de rota por sessão, MFA e papel |
| `AIChatConsole.tsx` | Console do assistente com streaming e markdown |
| `EnvironmentFilter.tsx` | Seletor de ambiente (Prod/Hml/Dev) |
| `MetricCard.tsx` | Cartão de KPI padronizado |
| `StatusBadge.tsx` | Badge semântico de status/severidade |
| `SyncStatusPanel.tsx` | Status da última sincronização CTIR/NVD |
| `SyncCauseTree.tsx` | Árvore de causa-raiz estilo Wazuh com busca e deep-link |
| `ExportJobsPanel.tsx` | Fila de exportação: progresso, download assinado, remoção |
| `ui/*` | Primitivos shadcn/ui (40+) |

---

## 3. Hooks (`src/hooks/`)

| Hook | Função |
| --- | --- |
| `useRealtimeData.ts` | Assinatura de Postgres Changes com invalidação de cache |
| `useSyncProgress.ts` | Progresso da sincronização via WebSocket, reconexão e fallback para polling |
| `useExportQueue.ts` | Fila de exportação: fatiamento de 250 linhas, upload ao bucket privado, URL assinada |
| `useWindowedRows.ts` | Virtualização semântica de tabela com linhas-espaçadoras |
| `use-toast.ts` | Wrapper de notificações |
| `use-mobile.tsx` | Breakpoint < 768px |

---

## 4. Contextos e bibliotecas

| Arquivo | Função |
| --- | --- |
| `contexts/AuthContext.tsx` | Sessão, MFA, papéis e helpers de autorização |
| `lib/aiModels.ts` | Fonte única de modelos de IA disponíveis |
| `lib/agentSkills.ts` | Catálogo de skills espelhando o backend Python |
| `lib/ctirAuditExport.ts` | `buildCsvBlob` / `buildPdfBlob` e exportação síncrona de fallback |
| `lib/utils.ts` | `cn()` |
| `integrations/supabase/client.ts` | Cliente do backend (**auto-gerado, não editar**) |
| `integrations/supabase/types.ts` | Tipos do schema (**auto-gerado, não editar**) |

---

## 5. Edge Functions (`supabase/functions/`)

| Função | Descrição resumida |
| --- | --- |
| `ai-chat` | Proxy do AI Gateway com contexto operacional e streaming |
| `sync-ctir-advisories` | Coleta incremental CTIR com conditional GET, fallback HTML e retry |
| `sync-nvd-vulnerabilities` | Coleta NVD 2.0 conforme watchlist |
| `ar-audit` | API de auditoria de ordenação com filtros e paginação |
| `notify-sync-failure` | Notificação com deduplicação (30min) e rate limit (5/h) |
| `create-itsm-ticket` | Abertura de chamado GLPI/Jira |
| `hypervisor-ingest` | Ingestão do agente on-prem (service role) |
| `hypervisor-collect` | Coleta sob demanda pela UI |

---

## 6. Sidecar Python (`disph-aiops-backend/`)

| Módulo | Conteúdo |
| --- | --- |
| `app/main.py` | Aplicação FastAPI e registro de rotas |
| `app/api/rag.py` | Busca semântica |
| `app/api/skills.py` | Listagem e execução de skills |
| `app/api/incidents.py` | Correlação de incidentes |
| `app/api/notifications.py` | Envio multicanal |
| `app/services/llm.py` | Cliente de modelo |
| `app/services/embedding.py` | Vetores para RAG |
| `app/services/guardrails.py` | Limites de risco e aprovação humana |
| `app/services/itsm/client.py` | Cliente ITSM por provider |
| `app/services/notifications/{teams,whatsapp,dispatcher}.py` | Canais |
| `app/skills/registry.py` | Registry por decorator (`name`, `risk_level`, `required_role`, `parameters_schema`) |
| `app/skills/ansible_skills.py` | Execução de playbooks |
| `app/skills/gitlab_skills.py` | Pipelines e merge requests |
| `app/skills/kubernetes_skills.py` | Diagnóstico e ações em cluster |
| `app/skills/monitoring_skills.py` | Consultas a Zabbix/Prometheus |
| `app/skills/itsm_skills.py` | `create_ticket` e notificações (Slack/Discord) |
| `app/skills/notification_skills.py` | Mensageria direta |
| `agents/hypervisor_agent.py` | Coletor on-prem vSphere/Hyper-V |

---

## 7. Testes

| Arquivo | Cobertura |
| --- | --- |
| `src/pages/__tests__/ARPage.integration.test.tsx` | Persistência e render do módulo AR com sessão autenticada |
| `src/pages/__tests__/CtirSyncAuditPage.integration.test.tsx` | KPIs, tabela de execuções e alertas |
| `src/pages/__tests__/CtirSyncAuditExport.integration.test.tsx` | Exportação CSV/PDF com filtros e paginação |
| `src/hooks/__tests__/useSyncProgress.test.tsx` | Queda de transporte, reconexão e fallback |
| `src/test/example.test.ts` | Sanidade do ambiente |

Execução: `bunx vitest run`.

---

## 8. Totais

| Categoria | Quantidade |
| --- | --- |
| Páginas | 20 |
| Rotas registradas | 20 |
| Componentes próprios | 12 (+40 primitivos) |
| Hooks | 6 |
| Edge Functions | 8 |
| Tabelas | 25 |
| Skills backend | 6 módulos |
| Suítes de teste | 5 |
