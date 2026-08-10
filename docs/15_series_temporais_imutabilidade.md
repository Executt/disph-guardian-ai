# 15 — Séries Temporais e Imutabilidade

## 1. Escopo

Dados que crescem por tempo e não por entidade: telemetria de hypervisores, execuções de agentes, alertas de sincronização, histórico de CVE e trilhas de auditoria.

| Tabela | Natureza | Chave temporal |
| --- | --- | --- |
| `hypervisor_agent_status` | heartbeat | `last_seen_at` |
| `hypervisor_vms` / `hypervisor_failure_points` | snapshot periódico | `collected_at` |
| `agent_executions` | evento | `created_at` |
| `sync_alerts` | evento | `created_at` |
| `nvd_vulnerability_history` | delta de campo | `changed_at` |
| `audit_logs` | trilha | `created_at` |
| `ctir_sync_state` | estado corrente (não série) | `last_run_at` |

---

## 2. Modelo de escrita

- **Append-only** para eventos: nenhuma política de `UPDATE`/`DELETE` para `authenticated`.
- **Snapshot com chave natural** para telemetria: `UPSERT` por `(environment, platform, external_id)` e histórico derivado por `collected_at`.
- **Delta por trigger** para CVE: `nvd_vuln_track_changes()` grava uma linha por campo alterado (`cvss_score`, `severity`, `last_modified`, `summary`).

---

## 3. Índices

```sql
CREATE INDEX ON public.sync_alerts (created_at DESC);
CREATE INDEX ON public.agent_executions (agent_id, created_at DESC);
CREATE INDEX ON public.nvd_vulnerability_history (cve_id, changed_at DESC);
CREATE INDEX ON public.audit_logs (created_at DESC);
```

Toda consulta de série usa filtro por intervalo fechado + `ORDER BY <coluna> DESC` + `LIMIT`. A UI pagina; nunca carrega a série inteira.

---

## 4. Retenção

| Dado | Retenção | Base |
| --- | --- | --- |
| Heartbeat e logs de agente | 90 dias | Operação |
| Snapshots de VMs / pontos de falha | 180 dias | Diagnóstico |
| `agent_executions` | 2 anos | Rastreio de automação |
| `sync_alerts` | 1 ano | Observabilidade |
| `nvd_vulnerability_history` | 5 anos | Conformidade |
| `audit_logs` | 5 anos | LGPD / SISP |
| Objetos em `ctir-exports` | 7 dias | Artefato transitório |

Purga por job `pg_cron` diário, sempre com `DELETE` limitado por lote:

```sql
DELETE FROM public.sync_alerts
WHERE created_at < now() - interval '1 year';
```

A purga roda como `service_role`; o app não apaga série temporal.

---

## 5. Imutabilidade (WORM lógico)

Três camadas:

1. **Ausência de política** de `UPDATE`/`DELETE` em `audit_logs`, `agent_executions` e `nvd_vulnerability_history` para `authenticated`.
2. **Revogação de privilégio**: `REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;`
3. **Encadeamento de integridade** (opcional, exigido em auditoria externa): coluna `prev_hash`/`row_hash` calculada na inserção sobre o conteúdo canônico da linha, permitindo detectar edição fora do caminho da aplicação.

```sql
row_hash = sha256(prev_hash || actor || action || target || created_at::text || payload::text)
```

A verificação percorre a cadeia por período e reporta a primeira quebra em `/system-audit`.

---

## 6. Agregações

Para painéis, evitar varrer a série crua:

- Contagem por dia/severidade calculada na consulta com `date_trunc('day', created_at)` e filtro de janela.
- Página `/security-overview/ctir-audit` limita a janela por ano/mês antes de agrupar.
- Volumes acima de 50 linhas na UI usam virtualização por janela (`useWindowedRows`).

---

## 7. Fuso e formato

- Armazenamento em `timestamptz`, sempre UTC.
- Exibição em `America/Sao_Paulo`.
- Exportação (CSV/PDF) grava ISO-8601 com offset explícito para evitar ambiguidade em auditoria.

---

## 8. Critérios de aceite

- [ ] Nenhuma tabela de trilha aceita `UPDATE` ou `DELETE` por usuário autenticado
- [ ] Jobs de purga executam e registram resultado
- [ ] Consultas de série usam índice por tempo (verificado em `EXPLAIN`)
- [ ] Exportações trazem timestamp com offset
- [ ] Quebra de cadeia de hash, quando habilitada, é detectada e reportada
