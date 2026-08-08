# 07 — APIs e Integrações

## 1. Camadas de API

| Camada | Uso | Autenticação |
| --- | --- | --- |
| PostgREST (Data API) | CRUD direto das tabelas via `supabase-js` | JWT do usuário + RLS |
| Edge Functions (Deno) | Orquestração, integrações externas, IA | JWT ou chave de serviço |
| Sidecar FastAPI | Skills que exigem rede interna (kubectl, Ansible, WinRM) | token interno do órgão |

Cliente único no frontend: `import { supabase } from "@/integrations/supabase/client"`.

---

## 2. Edge Functions

| Função | `verify_jwt` | Gatilho | Responsabilidade |
| --- | --- | --- | --- |
| `ai-chat` | sim | UI (assistente lateral) | Proxy para o AI Gateway com contexto operacional; resposta SSE |
| `sync-ctir-advisories` | não | `pg_cron` + botão na UI | Coleta incremental de alertas/recomendações do CTIR |
| `sync-nvd-vulnerabilities` | não | `pg_cron` | Coleta de CVEs da NVD conforme watchlist |
| `ar-audit` | sim | UI `/ar` aba Auditoria | Dados de auditoria de ordenação com filtros e paginação |
| `notify-sync-failure` | não | chamada por jobs de sync | Notificação Teams/WhatsApp com dedup e rate limit |
| `create-itsm-ticket` | não | `notify-sync-failure` e UI | Abertura de chamado GLPI/Jira |
| `hypervisor-ingest` | sim (chave do agente) | agente on-prem | Recebe hosts, VMs, pontos de falha, status e logs |
| `hypervisor-collect` | sim | UI `/hypervisors` | Dispara coleta sob demanda |

### 2.1 `sync-ctir-advisories`

**Entrada:** `{ force?: boolean, years?: number[] }`

**Algoritmo:**
1. Monta a lista de feeds (alertas e recomendações do ano corrente e dos dois anteriores).
2. Para cada feed, faz `GET` com `If-None-Match`/`If-Modified-Since` obtidos de `ctir_sync_state` e User-Agent de navegador (o portal bloqueia agentes genéricos com 403).
3. `304` → registra cache hit e encerra o feed.
4. `200` → tenta parse RSS; se vier vazio ou inválido, aplica o **fallback de HTML Plone** por expressão regular sobre a listagem institucional do GSI.
5. Upsert por `code`; cria `advisory_environment_assessments` `pending` para todo ambiente monitorado.
6. Atualiza `ctir_sync_state` (ETag, Last-Modified, `last_item_published_at`, `items_seen`).
7. Erros HTTP/parse passam por `withRetry` (backoff exponencial com jitter). Esgotadas as tentativas, grava `sync_alerts` e chama `notify-sync-failure` com o detalhamento por feed.

**Saída:** `{ ok, feeds: [{ url, status, inserted, updated, cached, error }], duration_ms }`

### 2.2 `sync-nvd-vulnerabilities`

Consulta a API NVD 2.0 por `keywordSearch`/`cpeName` para cada item habilitado de `nvd_watchlist`, com janela incremental sobre `lastModStartDate`. Respeita rate limit da NVD (pausa entre páginas), faz upsert por `cve_id` e preenche `matched_watch_ids`. O trigger `nvd_vuln_track_changes` registra diffs em `nvd_vulnerability_history`.

### 2.3 `ar-audit`

`POST { years?: number[], sources?: string[], only_divergent?: boolean, page, page_size }` → `{ rows, total, page, page_size }`. Ordenação determinística por `(ano_extraído_do_code DESC, code DESC)`, expondo qual campo foi usado (`code`, `published_at`, `fallback`) para auditoria.

### 2.4 `notify-sync-failure`

- **Deduplicação:** mesma assinatura de falha em 30 minutos não gera nova notificação.
- **Rate limit:** máximo de 5 notificações por hora por fonte.
- **Canais:** Microsoft Teams (webhook), WhatsApp (Z-API/Evolution) e, opcionalmente, abertura de chamado via `create-itsm-ticket`.
- Registra em `sync_alerts.notified_channels` e `ticket_ref`.

### 2.5 `hypervisor-ingest`

Recebe lote assinado do agente on-prem: `{ environment_id, platform, hosts[], vms[], failure_points[], agent_status, logs[] }`. Escreve com `service_role`; as tabelas são somente leitura para o app.

---

## 3. Acesso direto via PostgREST

| Recurso | Operações típicas |
| --- | --- |
| `ctir_advisories` | `select` com filtros de ano, severidade e tipo |
| `advisory_environment_assessments` | `select` + `update` de status e plano de remediação |
| `monitored_environments` | CRUD (admin/operator) |
| `nvd_watchlist` | CRUD com validação de duplicidade e formato de CPE |
| `incidents` | CRUD + Realtime |
| `agents` e tabelas filhas | CRUD (admin/operator) |
| `export_jobs` | insert/select/update do próprio usuário |
| `sync_alerts`, `audit_logs` | somente leitura |

---

## 4. Realtime

| Canal | Tabela | Consumidor |
| --- | --- | --- |
| incidentes | `incidents` | `/incidents`, `/` |
| progresso de sync | `sync_alerts` | `useSyncProgress` em `/security-overview/ctir-audit` |
| status do agente | `hypervisor_agent_status` | `/agents/status` |

`useSyncProgress` usa WebSocket com reconexão automática e **fallback para polling** quando o canal cai; a UI exibe o transporte ativo em um badge.

---

## 5. Sidecar FastAPI

Base: `disph-aiops-backend/`.

| Rota | Descrição |
| --- | --- |
| `GET /health` | Liveness |
| `/api/v1/rag/*` | Busca semântica sobre base de conhecimento |
| `/api/v1/skills/*` | Lista e executa skills do registry |
| `/api/v1/incidents/*` | Correlação e enriquecimento |
| `/api/v1/notifications/*` | Envio por Teams/WhatsApp/Slack |
| `/api/docs`, `/api/redoc` | OpenAPI |

Skills registradas por decorator (`app/skills/registry.py`) com `name`, `description`, `risk_level` (1–5), `required_role` e `parameters_schema`: módulos Ansible, GitLab, Kubernetes, monitoring, ITSM e notificações.

---

## 6. Integrações externas suportadas

| Categoria | Sistemas |
| --- | --- |
| Fontes oficiais | CTIR Gov (RSS + HTML), NVD 2.0 |
| Observabilidade | Zabbix, Grafana, Prometheus, Loki |
| Source control / CD | GitLab, GitHub, ArgoCD |
| Qualidade / registry | SonarQube, Quay, Harbor |
| Kubernetes | EKS, GKE, AKS, OKE, CCE, OpenShift, OKD, Rancher |
| ITSM | GLPI, Jira, ServiceNow, CITSmart, Freshservice, Azure DevOps, Zendesk |
| Notificação | Microsoft Teams, WhatsApp, Slack, Discord, Telegram, SMTP |
| Identidade | LDAP/AD (LDAPS), Keycloak (roadmap SAML/OIDC) |
| Virtualização | VMware vSphere (pyVmomi), Microsoft Hyper-V (WinRM) |

> **SEI** foi removido do escopo ativo — permanece apenas como item de roadmap.

---

## 7. Segredos

Credenciais de integração ficam em segredos da plataforma, nunca no código nem no banco em texto claro. A chave de serviço e a senha do banco não são acessíveis pela aplicação. Chaves publicáveis (anon) podem constar no cliente.

---

## 8. Contrato de erro

Todas as Edge Functions retornam:

```json
{ "ok": false, "error": "mensagem legível", "code": "PARSE_ERROR", "details": { } }
```

Códigos usados: `HTTP_ERROR`, `PARSE_ERROR`, `RATE_LIMIT`, `EMPTY_RESULT`, `TIMEOUT`, `UNAUTHORIZED`, `VALIDATION_ERROR`.
