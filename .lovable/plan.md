## Plano (spec-driven, ≤15 linhas)

**1. Correção CTIR (bloqueio da UI)**
- Verificar coluna `asset_count` em `monitored_environments`; se ausente, migração adiciona `asset_count int default 0`.
- Ajustar `SecurityOverviewPage` e `ARPage` para fallback `?? 0` sem quebrar.

**2. Fallback de fonte CTIR**
- `sync-ctir-advisories`: se feed primário (`/ctir/...`) retornar 0 itens ou 404, tentar `https://www.gov.br/gsi/pt-br/assuntos/ctir/alertas/{ano}/RSS` como secundário. Registrar em `ctir_sync_state.feed_url` real usado.

**3. Funil expandido em `/security-overview`**
- Migração: enum `incident_stage` com `identified|contained|eradicated|recovered|closed`; coluna `stage incident_stage default 'identified'` em `incidents`; backfill por `status`.
- `SecurityOverviewPage`: 5 estágios NIST com contagem por `stage`, conversão entre etapas e taxa MTTR simples.

**4. NVD 2.0 + Watchlist**
- Migração: `nvd_watchlist(id, label, kind[vendor|product|cpe|keyword], value, enabled, default_severity_floor)`, `nvd_vulnerabilities(cve_id pk, published_at, last_modified, cvss_score, severity, summary, cwe, references jsonb, matched_watch_ids uuid[], synced_at)`. GRANTs + RLS auth-only.
- Seed watchlist: Windows, Linux, Kubernetes, Docker, PostgreSQL, MySQL, Oracle DB, SQL Server, MongoDB, Supabase, Node.js, Python, Java, Go, React, WordPress, OpenShift/OKD, VMware, Cisco, Fortinet, OpenSSH, Apache, Nginx, Chrome, Firefox, Edge, Brave, LibreOffice, MS Office, Adobe Reader, Teams, Google Meet.
- Edge function `sync-nvd-vulnerabilities`: usa `services.nvd.nist.gov/rest/json/cves/2.0` com `keywordSearch`/`cpeName`, janela `lastModStartDate/EndDate` incremental (state em `ctir_sync_state` reaproveitado por `feed_url='nvd:{watchId}'`), sem API key (5 req/30s, sleep 6s entre chamadas). Se secret `NVD_API_KEY` existir, usa (50 req/30s).
- Página `/vulnerabilities` (nova aba dentro de `/ar` como sub-tab "NVD Watchlist") lista CVEs + gerenciamento de watchlist.

**5. Metodologia agentes**
- Copiar `.md` anexados para `docs/agents/` como referência (não vira skill executável).

Aprovar para eu executar em ordem: migrações → edge functions → UI.