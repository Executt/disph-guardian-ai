# Plano — Observabilidade de Sync, Watchlist NVD, Detalhes CVE e Alertas

## 1. Status de sincronização (CTIR + NVD)
- Novo componente `SyncStatusPanel` reutilizável (props: `source: 'ctir' | 'nvd'`).
- Fonte de dados: view SQL `sync_health_v` sobre `ctir_sync_state` + `audit_logs` (`action in ('sync_ctir_advisories','sync_nvd_vulnerabilities')`) — retorna: última execução, duração, itens vistos/inseridos/atualizados, erros, feeds em 304 vs 200, feed em fallback.
- Exibir em `/security-overview` (CTIR) e `/vulnerabilities` (NVD) no topo: badge verde/amarelo/vermelho + timestamp relativo + botão "Sincronizar agora" (invoca a edge function).

## 2. CRUD de `nvd_watchlist`
- Nova aba em `/vulnerabilities` → **Watchlist** (tab "Vulnerabilidades" | "Watchlist" | "Sincronização").
- Tabela com: label, kind (`keyword|cpe|vendor|product`), value, severity_floor, enabled, updated_at.
- Diálogo criar/editar com validação client-side + server-side:
  - Duplicidade: unique index `(kind, lower(value))` via migration.
  - Formato CPE: regex `^cpe:2\.3:[aho]:` para `kind='cpe'`.
- Toggle enable/disable inline; deleção com confirm.
- Após salvar, invalida `ctir_sync_state` do watch (`feed_url = 'nvd:{id}'`) para forçar re-scan completo na próxima execução do cron.

## 3. Detalhes de CVE
- Nova rota `/vulnerabilities/:cveId` → `CveDetailPage`.
- Seções: cabeçalho (severidade, CVSS score/vector com breakdown AV/AC/PR/UI/S/C/I/A), sumário, CWE, watches que casaram, CPEs afetados (colapsável), referências (lista com favicon), histórico (nova tabela `nvd_vulnerability_history` populada por trigger `AFTER UPDATE` em `nvd_vulnerabilities` quando `cvss_score`, `severity`, `last_modified` ou `summary` mudam).
- Botão "Abrir no NVD" (https://nvd.nist.gov/vuln/detail/{id}).

## 4. Alertas de falha de sync
- Nova edge function `notify-sync-failure` que aceita `{source, kind, details}` e:
  - Grava em `sync_alerts` (nova tabela: source, kind, message, details jsonb, resolved_at, ticket_ref).
  - Envia para Teams via connector `microsoft_teams` (se conectado) e WhatsApp via connector GatewayAPI/Meta (se conectado) — degrada graciosamente se não houver connector.
  - Cria ticket via `create-itsm-ticket` (novo) que suporta GLPI (REST) e Jira (REST v3), com secrets `GLPI_URL/GLPI_APP_TOKEN/GLPI_USER_TOKEN` e `JIRA_URL/JIRA_EMAIL/JIRA_API_TOKEN/JIRA_PROJECT_KEY` (solicitados sob demanda quando o usuário ativar).
- Gatilhos dentro de `sync-ctir-advisories` e `sync-nvd-vulnerabilities`:
  - Feed vazio inesperado (≥3 execuções sem itens novos) → severity `warning`.
  - Timeout (>25s por feed) ou HTTP 5xx repetido → `error`.
  - Rate limit NVD (HTTP 403/429) → `warning`.
  - Erro fatal → `critical`.
- Nova aba **Sincronização** em `/vulnerabilities` mostra últimos alertas + botão "Resolver".

## 5. Banco (migração única)
- Tabelas: `nvd_vulnerability_history`, `sync_alerts`.
- Unique index `nvd_watchlist_unique_kind_value`.
- View `sync_health_v`.
- Trigger `nvd_vuln_history_tg`.
- GRANTs + RLS (leitura authenticated, mutação apenas admin/operator; service_role total).

## Ordem de execução
1. Migração (tabelas, view, trigger, unique index).
2. Edge functions: `notify-sync-failure`, `create-itsm-ticket`; instrumentar `sync-ctir-advisories` e `sync-nvd-vulnerabilities`.
3. Frontend: `SyncStatusPanel`, tabs em `/vulnerabilities`, `WatchlistManager`, `CveDetailPage`, rota nova.
4. Documentação em `docs/09-regras-de-negocio.md` (thresholds de alerta).

## Perguntas
1. ITSM: **GLPI**, **Jira**, ou ambos? (afeta quais secrets pedirei depois)
2. WhatsApp: usar connector **GatewayAPI** (já mencionado no contexto) ou Meta Cloud API direta?
3. Thresholds de "vazio inesperado" — mantenho 3 execuções consecutivas sem novos itens ou prefere outro valor?
