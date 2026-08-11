# 19 — Simulação de Processo End-to-End em Produção

## 1. Cenário

CTIR Gov publica o alerta **CTIR-AL-2026-054** sobre exploração ativa de uma falha crítica em um componente de virtualização presente em três ambientes monitorados do órgão.

Objetivo: percorrer o caminho completo — coleta, correlação, decisão, ação e encerramento — com os artefatos reais que a plataforma produz.

---

## 2. Linha do tempo

| T | Etapa | Componente | Resultado |
| --- | --- | --- | --- |
| T+0 | Publicação no portal | CTIR Gov | Item novo no feed |
| T+0h05 | Coleta agendada | `pg_cron` → `sync-ctir-advisories` | Conditional GET; feed alterado |
| T+0h05 | Parse e persistência | Edge Function | Linha em `ctir_advisories` |
| T+0h05 | Fan-out de avaliação | Edge Function | 1 linha `pending` por ambiente em `advisory_environment_assessments` |
| T+0h06 | Correlação de vulnerabilidade | `sync-nvd-vulnerabilities` | CVE vinculado, CVSS 9.8 |
| T+0h10 | Correlação de infraestrutura | `/hypervisors` | 12 hosts e 41 VMs afetados |
| T+0h12 | Exibição | `/ar` e `/security-overview` | Postura cai; funil ganha item em *Identificado* |
| T+0h20 | Triagem humana | Operador | Assessment → `non_compliant`, incidente aberto |
| T+0h25 | Ação do agente | Skill Ansible risco 3 | Requer aprovação (guardrail) |
| T+0h40 | Aprovação e execução | `admin` com MFA | `agent_executions` registra sucesso |
| T+2h00 | Verificação | Nova coleta de hypervisor | Pontos de falha zerados |
| T+2h10 | Encerramento | Operador | Assessment → `compliant`; incidente → `closed` |
| T+2h15 | Evidência | Exportação assíncrona | PDF assinado, 60 s de validade |

---

## 3. Etapa 1 — Coleta

```
GET /alertas/2026  (If-None-Match, If-Modified-Since)
→ 200 OK, ETag novo
→ RSS vazio? fallback para listagem HTML institucional (GSI)
→ withRetry: 3 tentativas, backoff exponencial + jitter
```

`ctir_sync_state` guarda `etag`, `last_modified`, `last_item_published_at` e `last_run_at` por feed. Cache hit (304) encerra sem escrita.

Falha após as tentativas → `sync_alerts` + `notify-sync-failure` (dedupe 30 min, teto 5/h).

---

## 4. Etapa 2 — Correlação cruzada

A avaliação por ambiente responde três perguntas:

1. O ambiente **contém** o produto/versão citado? (`monitored_environments` × CPE)
2. Existe **CVE** correspondente na base NVD com CVSS relevante?
3. Há **ponto de falha** ativo no inventário de hypervisores?

Resultado possível: `pending`, `compliant`, `non_compliant`, `not_applicable`. O score de postura em `/security-overview` deriva da proporção de `compliant` ponderada por severidade.

---

## 5. Etapa 3 — Decisão e guardrails

| Guardrail | Verificação |
| --- | --- |
| MFA | Exigida para papel `admin` na aprovação |
| Raio de alcance | Máximo de 3 serviços afetados por execução |
| Aprovação | Obrigatória para risco ≥ 3 |
| Papel mínimo | Definido por skill no catálogo |

Sem aprovação, o agente registra a intenção e para. Nada é executado por autonomia acima do risco permitido.

---

## 6. Etapa 4 — Ação e evidência

- Execução gravada em `agent_executions` com entrada, saída, duração e ator.
- Ticket criado no ITSM (`create-itsm-ticket`) com o número do alerta e a lista de ativos.
- Notificação no Teams com o link direto para `/ar?advisory=CTIR-AL-2026-054`.
- Trilha completa em `audit_logs`, append-only.

---

## 7. Etapa 5 — Auditoria posterior

Em `/security-overview/ctir-audit`:

- KPIs da janela: sucesso/falha, tempo médio, taxa de falhas.
- Árvore de causa-raiz: execução → feed → erro → alerta, com busca e deep-link.
- Exportação CSV/PDF respeitando filtros e paginação, gerada em fila e entregue por URL assinada.

---

## 8. Métricas do ciclo

| Métrica | Alvo | Simulação |
| --- | --- | --- |
| Tempo até detecção | < 24 h | 5 min |
| Tempo até correlação | < 1 h | 12 min |
| Tempo até contenção | < 4 h | 40 min |
| MTTR total | < 8 h | 2 h 10 min |
| Cobertura de ambientes avaliados | 100% | 100% |

---

## 9. Pontos de falha ensaiados

| Falha injetada | Comportamento esperado |
| --- | --- |
| Portal responde 403 | User-Agent real + retry; se persistir, fallback HTML e alerta L2 |
| RSS vazio para o ano corrente | Fallback para listagem institucional; alerta de "vazio inesperado" |
| API NVD com rate limit | Backoff e retomada incremental na próxima janela |
| Agente de hypervisor offline | Alerta L4 após 30 min; correlação usa último snapshot com marca de idade |
| Storage no limite de cota | Exportação rejeitada com motivo explícito na UI |
