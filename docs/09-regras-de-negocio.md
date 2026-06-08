# 09 — Regras de Negócio

> Regras operacionais que governam fluxos críticos do DISPH-AIOPS.

---

## 1. Gestão de Incidentes

### RN-INC-01 — Classificação automática por severidade

Toda fonte (`zabbix`, `grafana`, `manual`, `api`) deve mapear severidade segundo:

| Sintoma                                  | Severidade |
| ---------------------------------------- | ---------- |
| Serviço crítico down + impacto cidadão   | `critical` |
| Degradação significativa (>30% latência) | `high`     |
| Alerta sem impacto direto                | `medium`   |
| Informativo, métricas anômalas           | `low`      |

### RN-INC-02 — SLA por severidade

| Severidade | Resposta (T0) | Resolução (T1) | Penalidade SLA |
| ---------- | ------------- | -------------- | -------------- |
| `critical` | 5 min         | 1 hora         | 100% crédito   |
| `high`     | 15 min        | 4 horas        | 50% crédito    |
| `medium`   | 1 hora        | 24 horas       | 20% crédito    |
| `low`      | 4 horas       | 72 horas       | sem penalidade |

### RN-INC-03 — Cálculo de MTTR

```
MTTR (min) = (resolved_at - created_at) em minutos
```

Calculado **automaticamente** na transição `status → 'resolved'`. Persistido em `incidents.mttr_minutes`.

### RN-INC-04 — Status workflow obrigatório

```
open → investigating → mitigating → resolved → closed
                  ↘                ↗
                   (atalho de operator)
```

- Transição reversa **só permitida para `admin`**.
- `closed` é terminal — exige RCA preenchida em `description` (validação futura).

### RN-INC-05 — Atribuição

- Operadores podem atribuir/transferir entre operadores.
- Apenas admin pode atribuir a si mesmo um incidente já em `mitigating`.

### RN-INC-06 — Notificação obrigatória

Severidades `critical` e `high` disparam notificação **automática** em:
- Microsoft Teams (canal SRE)
- WhatsApp do plantonista (Z-API)
- Email (SMTP) para gestor de TI

Configuração em **Admin → Notificações**.

### RN-INC-07 — Escalonamento

- `critical` sem ação em **15 min** → escalar para coordenador
- `high` sem ação em **1h** → escalar para coordenador
- Sem resolução em 2× SLA → escalar para CIO

(Regra suportada por job futuro.)

---

## 2. Multi-cloud & Clusters

### RN-CLU-01 — Inventário obrigatório

Todo cluster em uso deve estar cadastrado em `clusters` com:
- `name`, `provider`, `environment`, `api_endpoint`, `status`

### RN-CLU-02 — Status sincronizado

Health-check periódico (job futuro):

| Resultado            | Status           |
| -------------------- | ---------------- |
| API responde 2xx     | `active`         |
| API down             | `inactive`       |
| Em provisionamento   | `provisioning`   |
| Erro persistente     | `error`          |
| Manutenção planejada | `maintenance`    |

### RN-CLU-03 — Provedores suportados

`eks`, `gke`, `aks`, `cce`, `oke`, `openshift`, `openshift_local`, `okd`, `rancher`. Outros exigem extensão do enum.

---

## 3. RBAC & Usuários

### RN-USR-01 — MFA obrigatório

Roles `admin` e `operator` **devem** ter `profiles.mfa_enabled = true`. Login bloqueia se ausente.

### RN-USR-02 — Origem de provisionamento

| Source | Quem cria                              | Pode mudar role?      |
| ------ | -------------------------------------- | --------------------- |
| `ldap` | Sincronização automática (group→role)  | Não (gerido no AD)    |
| `local`| Admin manual                           | Sim                   |

### RN-USR-03 — Mudança de role gera audit_log

Action `ROLE_ASSIGNED` ou `ROLE_REVOKED` com `details = { role, target_user_id }`.

### RN-USR-04 — Bloqueio de conta

3 falhas de MFA seguidas → status `locked` + audit `MFA_LOCKOUT`. Reset por admin.

---

## 4. Auditoria & LGPD

### RN-AUD-01 — Toda mutation registra log

Inserções, atualizações, exclusões em qualquer tabela operacional **devem** gerar `audit_logs` com:
- `user_id` (autor)
- `action` (verbo padronizado)
- `resource_type` + `resource_id`
- `ip_address`
- `details` (diff JSON)

### RN-AUD-02 — Append-only

Logs **nunca** são alterados ou apagados. Anonimização (LGPD esquecimento) substitui `user_id` por `NULL`, mas mantém o registro.

### RN-AUD-03 — Retenção

Mínimo **5 anos** (SISP) — purge automático após esse prazo (job futuro).

---

## 5. IA & Chat

### RN-AI-01 — Modelo padrão

`google/gemini-3-flash-preview` (rápido, custo baixo). Configurável por usuário.

### RN-AI-02 — Contexto injetado

Toda chamada inclui `OPERATIONAL_CONTEXT` com KPIs agregados (sem PII):
- Quantidade de incidentes por severidade nas últimas 24h
- SLA atual (%)
- MTTR médio (min)
- Clusters com status ≠ active

### RN-AI-03 — Rate limit

60 mensagens/min por usuário. Excedido → toast erro + cooldown 60s.

### RN-AI-04 — Sem ações destrutivas

IA **nunca** executa mutações no banco — apenas leitura/análise. Sugestões viram tasks de operator.

### RN-AI-05 — Persistência

Conversas armazenadas em `ai_conversations` (escopo do usuário). Retenção 90 dias.

---

## 6. Notificações

### RN-NOT-01 — Canais por severidade

| Severidade | Teams | WhatsApp | Email | SMS  |
| ---------- | :---: | :------: | :---: | :--: |
| `critical` |  ✅   |    ✅    |  ✅   |  ✅  |
| `high`     |  ✅   |    ✅    |  ✅   |  -   |
| `medium`   |  ✅   |    -     |  ✅   |  -   |
| `low`      |  ✅   |    -     |  -    |  -   |

### RN-NOT-02 — Quiet hours

Notificações `low`/`medium` suprimidas entre 22h–06h (configurável por equipe).

### RN-NOT-03 — Deduplicação

Mesmo incidente não notifica duas vezes em <5 min no mesmo canal.

---

## 7. Pipelines DevSecOps

### RN-DSO-01 — Quality gates

Pipeline NÃO promove para staging se:
- SonarQube: bugs críticos > 0
- SonarQube: vulnerabilidades > 0
- Quay scan: CVE crítico sem fix
- Cobertura de testes < 70%

### RN-DSO-02 — Aprovação para produção

Promoção HML → PROD requer:
1. Pipeline verde
2. Aprovação manual de `admin` ou `operator` com MFA recente (<10 min)
3. Janela de mudança ativa (CAB)

### RN-DSO-03 — Rollback automático

Se health-check pós-deploy falhar 3× consecutivas em 10 min → rollback ArgoCD + incidente `high` automático.

---

## 8. Integrações ITSM (incl. SEI)

### RN-ITS-01 — Sincronização bidirecional

Incidente criado no DISPH → ticket no ITSM (campo `external_ticket_id` futuro).
Mudança de status no ITSM → atualiza incidente local.

### RN-ITS-02 — SEI (gov.br)

Para ações administrativas com efeito legal (ex: mudança de configuração crítica), gerar processo no **SEI** com:
- Tipo: "Solicitação de Alteração — TI"
- Interessado: usuário solicitante
- Documento: snapshot da mudança em PDF

### RN-ITS-03 — Mapeamento de campos

| DISPH                | ITSM padrão        | SEI                       |
| -------------------- | ------------------ | ------------------------- |
| `incident.title`     | summary            | objeto do processo        |
| `incident.severity`  | priority           | grau de urgência          |
| `assigned_to`        | assignee           | responsável               |
| `created_at`         | createdDate        | data de autuação          |

---

## 9. Configurações & Parametrização

### RN-CFG-01 — Acesso

Todas as configurações da plataforma vivem em **Admin** (rota `/admin`) — agrupadas por:
- Identidade (LDAP, MFA, RBAC)
- Comunicação (SMTP, Teams, WhatsApp)
- Workflow (SEI, ITSM)
- Infraestrutura (Clusters, Endpoints)
- IA (Modelos LLM, Gateway, Embeddings)
- Segurança (CSP, retenção, audit)

### RN-CFG-02 — Histórico de mudanças

Toda alteração em settings dispara audit `SETTINGS_CHANGED` com diff antes/depois.

### RN-CFG-03 — Rollback

Settings sensíveis (LDAP, SMTP) suportam restore para configuração anterior via histórico.

---

## 10. Compliance e Disponibilidade

### RN-CMP-01 — SLA da plataforma

DISPH-AIOPS deve manter **99.5% de disponibilidade mensal** medida via:
- Uptime do frontend (CDN edge)
- Latência do banco < 200ms p95
- Edge function ai-chat < 3s p95

### RN-CMP-02 — RPO / RTO

| Métrica | Alvo    |
| ------- | ------- |
| RPO     | 24h     |
| RTO     | 4h      |

### RN-CMP-03 — Janela de manutenção

Domingos 02h–06h (BRT). Notificar 7 dias antes via banner + email para todos `admin`/`operator`.

---

## Atualização — Auditoria Jun/2026

**RN-ITS-02 (SEI):** marcada como **NÃO IMPLEMENTADA** (roadmap). Nenhum código de integração com SEI existe atualmente.

**Catálogo ITSM real** (RN-ITS-01): suporte ativo a 6 provedores via skill genérica `create_ticket(provider, ...)`:
- GLPI, Jira (Cloud/DC), ServiceNow, CITSmart, Freshservice, Azure DevOps Boards.

**Skills de alto risco (RN-SKL-01):** níveis 4-5 (`trigger_ansible_playbook`, `k8s_rollout_restart`, `k8s_cordon_node`, `k8s_rollback_deployment`, `create_change`) exigem role `operator`+ e devem ter confirmação UX (a implementar — ver `.lovable/plan.md`).

**Auditor (RN-AUD-01):** role `auditor` agora tem acesso correto a `/audit` (bug corrigido).
