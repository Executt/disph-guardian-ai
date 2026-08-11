# 17 — ZeroOps, Alertas e Cotas de Storage por Órgão

## 1. Princípio ZeroOps

A plataforma deve operar sem intervenção rotineira. Toda tarefa recorrente é agendada, monitorada e auto-recuperável; a intervenção humana existe para exceção, não para operação.

| Tarefa | Automação |
| --- | --- |
| Coleta CTIR | `pg_cron` diário 06:00 UTC → `sync-ctir-advisories` |
| Coleta NVD | `pg_cron` diário → `sync-nvd-vulnerabilities` |
| Coleta de hypervisores | Agente on-prem em intervalo fixo → `hypervisor-ingest` |
| Purga de séries | `pg_cron` diário conforme doc 15 |
| Expiração de exportações | Remoção de objetos com mais de 7 dias |
| Notificação de falha | `notify-sync-failure` com dedupe e rate limit |

Autorrecuperação: cada job usa `withRetry` com backoff exponencial e jitter; só após esgotar as tentativas o evento vira alerta humano.

---

## 2. Escada de alertas

| Nível | Gatilho | Destino | Prazo |
| --- | --- | --- | --- |
| L0 — informativo | Execução com cache hit (304) | Apenas `ctir_sync_state` | — |
| L1 — atenção | Falha transitória recuperada por retry | `sync_alerts` | — |
| L2 — falha | Job falhou após todas as tentativas | Teams + `sync_alerts` | 4 h |
| L3 — crítico | Duas execuções consecutivas falhas ou fonte vazia inesperada | Teams + WhatsApp + ticket ITSM | 1 h |
| L4 — indisponibilidade | Agente sem heartbeat > 30 min em ambiente produtivo | Teams + WhatsApp + ticket + plantão | 30 min |

### 2.1 Antisspam

- **Deduplicação**: mesma assinatura (`job` + `feed` + `motivo`) suprimida por 30 minutos.
- **Rate limit**: máximo de 5 notificações por hora por canal.
- Mensagem suprimida ainda é gravada em `sync_alerts` — nada se perde, apenas não é reenviado.

---

## 3. Multi-órgão

Cada órgão é um **tenant lógico** representado por `monitored_environments.org` (ou tabela `orgs` quando houver mais de um contrato).

| Aspecto | Regra |
| --- | --- |
| Dados operacionais | Filtrados por ambiente/órgão em toda consulta da UI |
| Catálogo CTIR/NVD | Compartilhado — é informação pública federal |
| Avaliações (`advisory_environment_assessments`) | Sempre por ambiente, nunca globais |
| Exportações | Isoladas por `auth.uid()` no bucket privado |
| Notificações | Canal e webhook configurados por órgão em `agent_channels` |

Isolamento é reforçado por RLS; o filtro da UI é conveniência, não controle.

---

## 4. Cotas de storage

| Recurso | Cota padrão por órgão | Ação ao atingir |
| --- | --- | --- |
| Exportações (`ctir-exports`) | 2 GB | Bloqueia nova exportação até purga |
| Objetos por usuário | 50 arquivos | Remove o mais antigo (FIFO) |
| Tamanho máximo por arquivo | 50 MB | Rejeita geração e sugere filtro mais estreito |
| Retenção | 7 dias | Purga automática diária |

Verificação antes de enfileirar o job:

```
uso_atual + tamanho_estimado > cota  →  job marcado como `rejected`
                                        motivo exibido no ExportJobsPanel
```

O usuário vê consumo e limite no painel de exportações; ao atingir 80% recebe aviso na própria UI.

---

## 5. Indicadores de ZeroOps

| Indicador | Meta |
| --- | --- |
| Execuções automáticas sem intervenção | ≥ 98% |
| Falhas recuperadas por retry | ≥ 80% das falhas transitórias |
| Alertas L3/L4 por mês | ≤ 4 |
| Tempo médio de sincronização CTIR | < 90 s |
| Exportações concluídas sem erro | ≥ 99% |

Todos são exibidos em `/security-overview` e `/security-overview/ctir-audit`.

---

## 6. Critérios de aceite

- [ ] Todo job recorrente tem agendamento declarado e registro de execução
- [ ] Nenhuma notificação duplicada dentro da janela de dedupe
- [ ] Cota de storage bloqueia exportação antes de estourar o bucket
- [ ] Purga diária de exportações em funcionamento
- [ ] Falta de heartbeat gera alerta L4 em até 30 min
