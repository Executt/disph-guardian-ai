# 21 — Guia de Sustentação e Operação

## 1. Serviço e horários

| Item | Definição |
| --- | --- |
| Horário comercial | Seg–Sex, 08:00–18:00 (America/Sao_Paulo) |
| Plantão | 24×7 para severidade 1 e 2 |
| Janela de manutenção | Sábados, 22:00–02:00, com aviso de 48 h |
| Canal primário | Teams (`#disph-operacao`) |
| Canal de escalada | WhatsApp do plantonista + ticket no ITSM |

---

## 2. Severidade e SLA

| Sev | Definição | Resposta | Solução |
| --- | --- | --- | --- |
| 1 | Plataforma indisponível ou coleta parada > 24 h | 15 min | 4 h |
| 2 | Módulo crítico degradado (AR, vulnerabilidades, hypervisores) | 30 min | 8 h |
| 3 | Falha isolada com contorno | 4 h | 3 dias úteis |
| 4 | Dúvida, melhoria, cosmético | 1 dia útil | Backlog |

Disponibilidade alvo: **99,5%** mensal, excluída janela programada.

---

## 3. Rotina diária

| Horário | Verificação | Onde |
| --- | --- | --- |
| 08:00 | Execuções CTIR e NVD da madrugada | `/security-overview/ctir-audit` |
| 08:10 | Heartbeat dos agentes de hypervisor | `/agents/status` |
| 08:20 | Alertas abertos em `sync_alerts` | Aba Alertas |
| 08:30 | Avaliações `pending` de advisories | `/ar` |
| 17:30 | Fila de exportações e uso de cota | Painel de exportações |

Rotina semanal: revisão da watchlist NVD, conferência de papéis sincronizados do LDAP, atualização de assinaturas antimalware.
Rotina mensal: relatório de postura, revisão de RLS por amostragem, teste de restauração de backup.

---

## 4. Runbooks

### RB-01 — Sincronização CTIR não trouxe dados

1. Abrir `/security-overview/ctir-audit`, aba Execuções; identificar o feed e o motivo.
2. Motivo `http_403` → portal bloqueando: confirmar User-Agent e tentar "Forçar full".
3. Motivo `empty_feed` → RSS vazio: verificar se o fallback HTML institucional foi acionado na árvore de causa-raiz.
4. Motivo `parse_error` → estrutura do portal mudou: abrir tarefa de correção do parser (Sev 2).
5. Executar "Executar CTIR agora" e acompanhar o progresso em tempo real.
6. Registrar a conclusão no ticket.

### RB-02 — Agente de hypervisor sem heartbeat

1. Conferir `last_seen_at` em `/agents/status` e o log por ambiente.
2. Validar conectividade de saída do agente (push; não há porta de entrada).
3. Verificar validade do token do agente e rotação recente.
4. Reiniciar o serviço do agente no host on-prem.
5. Confirmar nova coleta e limpar o alerta.

### RB-03 — Notificações não chegaram

1. Checar se houve supressão por dedupe (30 min) ou rate limit (5/h) — a supressão é normal.
2. Validar o webhook do canal em `agent_channels`.
3. Testar o disparo manual; se falhar, revisar segredo do canal.

### RB-04 — Exportação travada ou rejeitada

1. Abrir o painel de exportações e ler o motivo do job.
2. `rejected` por cota → purgar arquivos antigos ou estreitar o filtro.
3. `failed` por sessão → reautenticar; a fila exige sessão válida para gravar no bucket.
4. URL assinada expira em 60 s — gerar novo link em vez de reutilizar.

### RB-05 — Usuário sem acesso após entrar

1. Confirmar papéis em `user_roles` (nunca em `profiles` ou no navegador).
2. Verificar grupo do usuário no diretório e a última execução do sync LDAP.
3. `admin`/`auditor` exigem MFA TOTP concluída.
4. Nunca conceder papel manualmente sem registrar o motivo no ticket.

### RB-06 — Lentidão em página de auditoria

1. Reduzir a janela (ano/mês) e a severidade no filtro.
2. Confirmar que a virtualização está ativa (datasets > 50 linhas).
3. Reduzir o tamanho de página para 20 ou 50.
4. Se persistir, avaliar índice por tempo nas tabelas de série (doc 15).

---

## 5. Escalonamento

```
N1 Service Desk ──▶ N2 Operação DISPH ──▶ N3 Engenharia da plataforma
                          │
                          └─▶ Segurança/SOC (incidente de segurança)
```

Sev 1 escala para N3 e para o gestor do contrato em 30 min sem solução.

---

## 6. Mudanças

- Toda mudança começa por especificação de até 15 linhas aprovada (doc 00).
- Migration de banco sempre com `GRANT` + RLS + política na mesma migração.
- Deploy em janela programada, exceto correção de Sev 1.
- Plano de retorno declarado antes da aplicação.
- Evidência da mudança registrada em `/system-audit`.

---

## 7. Continuidade

| Item | Definição |
| --- | --- |
| Backup do banco | Diário, retenção 35 dias |
| Teste de restauração | Trimestral, com evidência |
| RTO | 4 h |
| RPO | 15 min |
| Exportação de trilhas | Mensal para o bucket WORM (doc 16) |

---

## 8. Indicadores de sustentação

| Indicador | Meta |
| --- | --- |
| Chamados resolvidos no SLA | ≥ 95% |
| Reincidência em 30 dias | ≤ 5% |
| Execuções automáticas sem intervenção | ≥ 98% |
| Cobertura de runbook para alertas recorrentes | 100% |
| Backlog de avaliações `pending` > 7 dias | 0 |
