# 12 — Regras de Negócio

Identificadores `RN-xxx` são estáveis e citáveis em issues, testes e auditorias.

---

## 1. Alertas e Recomendações (CTIR)

| ID | Regra |
| --- | --- |
| RN-001 | A janela de correlação é o **ano corrente e os dois anteriores**. Advisories fora dela não entram no cálculo de conformidade. |
| RN-002 | O ano de um advisory é extraído do **código do boletim** (ex.: `CTIR-AL-2026-054`). `published_at` é usado só quando o código não traz ano; havendo divergência, a UI exibe badge de auditoria. |
| RN-003 | `code` é chave natural: reprocessar o mesmo boletim atualiza, nunca duplica. |
| RN-004 | Todo advisory novo gera automaticamente uma avaliação `pending` para **cada** ambiente monitorado ativo. |
| RN-005 | `affected_assets` nunca pode exceder `total_assets` do ambiente. |
| RN-006 | `not_applicable` exige justificativa em `notes`. |
| RN-007 | `partial` exige `remediation_plan` preenchido. |
| RN-008 | Ao mudar para `compliant`, o sistema grava `remediated_at = now()` e `assessed_by = auth.uid()`. |
| RN-009 | Advisory `critical` sem tratamento por mais de 72h é sinalizado como violação de SLA na análise cruzada. |

### 1.1 Security Posture Score

```text
peso(ambiente) = mission_critical:4 | high:3 | medium:2 | low:1
conformes  = Σ peso × (assessments compliant)
avaliáveis = Σ peso × (assessments ≠ not_applicable e ≠ pending)
Score = round(100 × conformes / avaliáveis)   // 100 quando avaliáveis = 0
```

| Faixa | Leitura |
| --- | --- |
| 90–100 | Adequado |
| 70–89 | Atenção |
| 50–69 | Risco |
| < 50 | Crítico |

---

## 2. Sincronização

| ID | Regra |
| --- | --- |
| RN-010 | A coleta é incremental: `If-None-Match`/`If-Modified-Since` a partir de `ctir_sync_state`; `304` encerra o feed como cache hit. |
| RN-011 | O portal rejeita agentes genéricos — a requisição usa User-Agent de navegador real. |
| RN-012 | RSS vazio ou inválido aciona o **fallback de HTML institucional**; só então a execução é considerada falha. |
| RN-013 | Falhas de HTTP e de parse são reprocessadas com backoff exponencial e jitter; esgotadas as tentativas, grava-se `sync_alerts`. |
| RN-014 | Resultado vazio inesperado é anomalia (`EMPTY_RESULT`), não sucesso. |
| RN-015 | Notificação de falha é deduplicada por 30 minutos e limitada a 5 por hora por fonte. |
| RN-016 | Falha `critical` persistente abre chamado no ITSM e grava `ticket_ref`. |
| RN-017 | O cron diário roda às 06:00 UTC; a execução manual ("Executar CTIR agora") usa o mesmo caminho de código. |
| RN-018 | "Forçar full" ignora ETag/Last-Modified, mas mantém o upsert idempotente. |

---

## 3. Vulnerabilidades (NVD)

| ID | Regra |
| --- | --- |
| RN-019 | Só são coletadas CVEs que casem com item **habilitado** da watchlist. |
| RN-020 | `value` da watchlist é único sem diferenciar maiúsculas/minúsculas. |
| RN-021 | Itens do tipo `cpe` são validados quanto ao formato antes de gravar. |
| RN-022 | `severity_floor` descarta CVEs abaixo do piso definido para aquele item. |
| RN-023 | Severidade deriva do CVSS: ≥9,0 crítica; 7,0–8,9 alta; 4,0–6,9 média; <4,0 baixa. |
| RN-024 | Alteração de score, vetor ou resumo gera linha em `nvd_vulnerability_history` — histórico é imutável. |
| RN-025 | Desabilitar item da watchlist não apaga CVEs já coletadas. |

---

## 4. Incidentes

| ID | Regra |
| --- | --- |
| RN-026 | O funil segue NIST 800-61: `identified → contained → eradicated → recovered → closed`. |
| RN-027 | Estágios não podem ser pulados para frente; regressão é permitida com registro em auditoria. |
| RN-028 | `closed` exige `resolved_at`; o MTTR é a diferença em minutos entre criação e `resolved_at`. |
| RN-029 | Incidente `critical` notifica os canais configurados na criação. |
| RN-030 | Incidente originado de advisory CTIR mantém referência ao `code` de origem. |
| RN-031 | Incidente que envolva dado pessoal é marcado para tratamento LGPD com prazo de comunicação. |

---

## 5. Hypervisores

| ID | Regra |
| --- | --- |
| RN-032 | Host sem coleta há mais de 15 minutos entra em estado `stale`. |
| RN-033 | CPU ou RAM acima de 90%, ou datastore acima de 85%, gera ponto de falha. |
| RN-034 | Só VMs com sintoma são persistidas — não há inventário completo de VMs. |
| RN-035 | O agente é a única origem de escrita; a UI apenas dispara coleta e lê. |
| RN-036 | `error_count_24h` acima de 5 marca o agente como degradado. |

---

## 6. Agentes de IA e skills

| ID | Regra |
| --- | --- |
| RN-037 | Agente só é ativado com perfil (modelo, prompt, limites) completo. |
| RN-038 | Skill com `risk_level` acima do `risk_threshold` do agente exige aprovação humana (`awaiting_approval`). |
| RN-039 | Autonomia `manual` sempre exige aprovação; `supervised` exige acima do limiar; `autonomous` executa dentro do limiar. |
| RN-040 | Skill desabilitada no catálogo global fica indisponível para todos os agentes, independentemente da configuração local. |
| RN-041 | Parâmetro definido no agente sobrepõe o `default_parameters` do catálogo. |
| RN-042 | Toda execução é registrada em `agent_executions` com entrada, saída, tokens, duração e erro — sem exclusão. |
| RN-043 | Canal com `requires_approval` só executa após confirmação humana na conversa. |
| RN-044 | Papel do usuário deve ser igual ou superior ao `required_role` da skill. |

---

## 7. Exportação e auditoria

| ID | Regra |
| --- | --- |
| RN-045 | A exportação respeita exatamente os filtros e o escopo (`todos filtrados` ou `página atual`) vigentes na UI. |
| RN-046 | A geração roda em fatias de 250 linhas, cedendo o event loop — a interface nunca trava. |
| RN-047 | O artefato é gravado em bucket privado sob `<uid>/<jobId>` e baixado por URL assinada de 60s. |
| RN-048 | Remover um job apaga também o objeto no storage. |
| RN-049 | Sem sessão ou fila disponível, o sistema faz exportação síncrona como fallback. |
| RN-050 | Trilhas de auditoria não admitem alteração nem exclusão. |
| RN-051 | Somente `admin` e `auditor` acessam e exportam a auditoria CTIR. |

---

## 8. Interface

| ID | Regra |
| --- | --- |
| RN-052 | Tabelas virtualizam acima de 50 linhas por página; abaixo disso renderizam integralmente. |
| RN-053 | Estado de aba, filtros, paginação, seleção e scroll é persistido na URL para deep-link. |
| RN-054 | Cores de severidade e conformidade seguem exclusivamente os tokens semânticos do design system. |
| RN-055 | Itens de menu sem papel compatível não são renderizados. |
