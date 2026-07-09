## Objetivo
Garantir persistência confiável dos alertas CTIR com execução automática diária, observabilidade completa das execuções, resiliência a falhas transitórias e cobertura por testes de integração autenticados.

## Escopo

### 1. Cron diário CTIR (banco)
- Habilitar `pg_cron` e `pg_net` (idempotente).
- `cron.schedule('sync-ctir-daily', '0 6 * * *', ...)` invocando `sync-ctir-advisories` via `net.http_post` com header `apikey` (anon) — SQL emitido via `supabase--insert` (dados do projeto, não migração).
- Registrar cada execução em `audit_logs` (já ocorre) + novo campo `trigger_source` no payload (`cron` | `manual`).

### 2. Retry com backoff (`sync-ctir-advisories`)
- Envolver `conditionalFetch` em helper `withRetry(fn, {attempts:3, baseMs:800})`: retentar em `5xx`, `429`, network errors e falhas de parse (0 items + status 200 quando esperado XML).
- Backoff exponencial + jitter. Registrar cada tentativa falha em `sync_alerts` com `kind='retry'`, `severity='warning'` e `details.attempt`.
- Motivo final da falha gravado em `ctir_sync_state.last_status` + `sync_alerts` com `details.reason`.

### 3. Página de auditoria `/security-overview/ctir-audit`
- Nova rota `CtirSyncAuditPage.tsx`:
  - Card resumo: total execuções (30d), sucesso/falha, MTTR.
  - Gráfico de barras (recharts): contagem de `sync_alerts` por dia (últimos 30d), agrupado por severity.
  - Tabela paginada: `audit_logs` filtrado por `action='sync_ctir_advisories'` com expand mostrando `details` (feeds, inserted, updated, errors, duration, retries).
  - Painel lateral: últimos 20 `sync_alerts` do CTIR com filtro por severity e status resolvido.
- Link a partir do `SyncStatusPanel` (botão "Ver auditoria").

### 4. Testes de integração (`src/pages/__tests__/ARPage.integration.test.tsx`)
- Mock do cliente Supabase (`vi.mock('@/integrations/supabase/client')`) retornando fixture de `ctir_advisories` + sessão autenticada mockada via `AuthContext`.
- Casos:
  1. Renderiza lista com ≥1 advisory após load.
  2. Botão "Sincronizar" chama `functions.invoke('sync-ctir-advisories')` e atualiza estado de loading.
  3. Estado vazio exibe placeholder quando fixture retorna `[]`.
  4. Falha do invoke exibe toast de erro.
- Rodar via `bunx vitest run`.

## Estrutura técnica
```text
supabase/functions/sync-ctir-advisories/index.ts   [edit: withRetry + retry alerts]
src/pages/CtirSyncAuditPage.tsx                    [new]
src/App.tsx                                        [route]
src/components/SyncStatusPanel.tsx                 [link auditoria]
src/pages/__tests__/ARPage.integration.test.tsx    [new]
+ supabase--insert: cron.schedule + extensions
```

## Fora de escopo
- Alterar schema (usa tabelas existentes: `audit_logs`, `sync_alerts`, `ctir_sync_state`).
- Cron do NVD (só CTIR nesta iteração).
- E2E Playwright (integração via Vitest + mocks).

## Perguntas
1. Horário do cron: **06:00 UTC** (03:00 BRT) OK, ou prefere outro?
2. Retentativas: **3 tentativas / base 800ms** OK?
