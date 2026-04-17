# 11 — Administração (Centro de Parametrização)

> O módulo **Admin** (`/admin`) centraliza **todas** as configurações da plataforma. Layout inspirado em Grafana Settings: sidebar de tabs vertical à esquerda, conteúdo à direita.

---

## 1. Visão geral do módulo

```
┌──────────────────────────────────────────────────────────┐
│  ADMIN  ·  Centro de Parametrização                      │
├────────────────┬─────────────────────────────────────────┤
│ ⊕ Visão Geral  │                                         │
│ 👥 Usuários    │       [conteúdo da seção ativa]         │
│ 🔑 LDAP / AD   │                                         │
│ ✉ SMTP         │                                         │
│ 📄 SEI / ITSM  │                                         │
│ 🔔 Notificações│                                         │
│ ☸ Clusters     │                                         │
│ 🔌 Integrações │                                         │
│ 🤖 IA / LLM    │                                         │
│ 🛡 Segurança   │                                         │
│ 📋 Auditoria   │                                         │
└────────────────┴─────────────────────────────────────────┘
```

Todas as seções têm o mesmo padrão visual: header + cards + form com botões `Testar` e `Salvar`.

---

## 2. Visão Geral (overview)

KPIs do estado da plataforma:
- Total de usuários · ativos · LDAP · com MFA
- Status LDAP (conectado/sincronizando/desconectado)
- Status SMTP, Teams, WhatsApp (testes recentes)
- Clusters ativos por provedor
- Última sincronização LDAP, última auditoria

---

## 3. Usuários

CRUD de contas com tabela searchable.

### 3.1 Campos
| Campo          | Notas                                        |
| -------------- | -------------------------------------------- |
| Username       | único, sem espaços                           |
| Display name   | nome completo                                |
| Email          | obrigatório, formato válido                  |
| Roles          | multi-select: admin, operator, viewer, auditor |
| Source         | `ldap` (não editável) ou `local`             |
| Status         | `active`, `inactive`, `locked`               |
| MFA            | toggle                                       |

### 3.2 Operações
- **Adicionar** (botão direito da busca)
- **Editar** (ícone lápis)
- **Excluir** (ícone lixeira — só local; LDAP via AD)
- **Desbloquear** conta `locked`

### 3.3 Auditoria
Toda mudança gera `audit_logs` com action `USER_*`.

---

## 4. LDAP / Active Directory

### 4.1 Configuração

| Campo          | Exemplo                                                    |
| -------------- | ---------------------------------------------------------- |
| URL            | `ldaps://ldap.corp.gov.br:636`                             |
| Base DN        | `dc=corp,dc=gov,dc=br`                                     |
| Bind DN        | `cn=disph-svc,ou=services,dc=corp,dc=gov,dc=br`            |
| Bind password  | (vault)                                                    |
| User filter    | `(&(objectClass=person)(memberOf=cn=disph-users,...))`     |
| Group filter   | `(objectClass=groupOfNames)`                               |
| TLS/SSL        | obrigatório                                                |
| Sync interval  | 30 min (padrão)                                            |

### 4.2 Mapeamento Grupo → Role

| LDAP Group                          | Role       |
| ----------------------------------- | ---------- |
| `cn=disph-admins,ou=groups`         | `admin`    |
| `cn=disph-operators,ou=groups`      | `operator` |
| `cn=disph-viewers,ou=groups`        | `viewer`   |
| `cn=disph-auditors,ou=groups`       | `auditor`  |

### 4.3 Passo a passo
1. **Testar Conexão** — valida bind antes de salvar
2. **Salvar Configuração**
3. **Sincronizar Agora** — força full sync
4. Verificar `audit_logs` action `LDAP_SYNC` para resultado

---

## 5. SMTP (Email)

Para envio de notificações por email (incidentes, recuperação de senha, MFA inicial).

### 5.1 Configuração
| Campo            | Valor exemplo                          |
| ---------------- | -------------------------------------- |
| Servidor SMTP    | `smtp.corp.gov.br`                     |
| Porta            | `587` (STARTTLS) ou `465` (SMTPS)      |
| Encryption       | `STARTTLS` / `SSL/TLS` / `None`        |
| Usuário          | `noreply@disph.gov.br`                 |
| Senha            | (vault)                                |
| From name        | `DISPH-AIOPS`                          |
| From email       | `noreply@disph.gov.br`                 |
| Reply-to         | `suporte@disph.gov.br`                 |
| Timeout (s)      | 30                                     |

### 5.2 Templates suportados
- `incident_critical_alert.html`
- `incident_resolved.html`
- `mfa_setup.html`
- `password_reset.html`
- `report_compliance.html`

### 5.3 Testar
Botão **"Enviar email de teste"** envia para o admin atual usando todas as configs.

### 5.4 Quotas e logs
- Quota diária recomendada: 5.000 mensagens
- Log de envio em `audit_logs` action `EMAIL_SENT`

---

## 6. SEI (Sistema Eletrônico de Informações — gov.br)

Integração com SEI para abertura automática de processos administrativos.

### 6.1 Configuração
| Campo            | Valor exemplo                                |
| ---------------- | -------------------------------------------- |
| URL base         | `https://sei.gov.br/sei/controlador_ws.php`  |
| Token API        | (vault — solicitar ao gestor SEI da unidade) |
| Sigla unidade    | `COTI`                                       |
| Tipo processo    | `Solicitação de Alteração — TI`              |
| Tipo documento   | `Despacho`                                   |
| Nível sigilo     | `público` / `restrito`                       |

### 6.2 Quando o sistema abre processo SEI?
- Mudança de configuração crítica (LDAP, RBAC) → processo informativo
- Incidente `critical` com impacto cidadão → processo de notificação
- Solicitação de exclusão LGPD → processo formal

### 6.3 Mapeamento DISPH → SEI

| DISPH                   | SEI                          |
| ----------------------- | ---------------------------- |
| `incident.title`        | objeto                       |
| `incident.description`  | corpo do despacho            |
| `incident.severity`     | grau de urgência             |
| `created_by`            | interessado                  |
| `audit_logs.details`    | anexo JSON                   |

### 6.4 Testar
Botão **"Validar credenciais SEI"** chama endpoint de teste sem criar processo.

---

## 7. ITSM (GLPI / Jira / ServiceNow / CITSmart / Azure DevOps)

Provedor selecionável (radio). Cada provedor expõe:

| Campo            | Notas                                  |
| ---------------- | -------------------------------------- |
| URL base         | da API do ITSM                         |
| API token / key  | vault                                  |
| Categoria padrão | mapeada a severity                     |
| Project / Queue  | onde tickets são abertos               |
| Sync bidirecional| toggle                                 |

Ver `docs/09-regras-de-negocio.md` §8 para regras.

---

## 8. Notificações

### 8.1 Microsoft Teams (Incoming Webhook)
- URL completa do webhook
- Canal padrão por severidade
- Mensagem template (Adaptive Card)

### 8.2 WhatsApp (Z-API / Evolution)
- URL da instância
- Token instância
- Lista de números do plantão
- Template de mensagem aprovada (Meta)

### 8.3 Slack (futuro)
- Webhook + channel

### 8.4 Quiet hours (silêncio)
- Janela: HH:MM–HH:MM
- Severidades suprimidas: `low`, `medium`

---

## 9. Clusters Kubernetes

Ver inventário em **/infrastructure**. Aqui apenas defaults globais:

- Provedor padrão para novos cadastros
- Ambiente padrão (`production`, `homologation`, `development`)
- Health-check interval (segundos)
- Timeout API (segundos)

---

## 10. Integrações de Infraestrutura

Cards de status para:
- Red Hat ACM
- Zabbix Server
- GitLab
- Grafana
- ArgoCD
- Quay Registry
- SonarQube
- Prometheus / Loki / Tempo

Cada card: URL · token · status (online/offline) · botão "Testar".

---

## 11. IA / LLM

### 11.1 Modelos cadastrados
Lista dos 9 modelos do Lovable AI Gateway com toggle on/off:
- `google/gemini-3-flash-preview` (padrão)
- `google/gemini-3.1-pro-preview`
- `google/gemini-3-pro-image-preview`
- `google/gemini-3.1-flash-image-preview`
- `google/gemini-2.5-flash`
- `google/gemini-2.5-flash-lite`
- `google/gemini-2.5-pro`
- `openai/gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5.2`

### 11.2 Configurações
- Modelo padrão do chat
- Temperature (0–1)
- Max output tokens
- Reasoning mode (toggle)
- Embedding dimensions (1536 padrão)
- Guardrails ativos (toggle)

### 11.3 Provedor adicional (opcional)
- Open-source local (Ollama) — endpoint + modelo
- Azure OpenAI — endpoint + key + deployment
- Custom OpenAI-compatible — endpoint + key

### 11.4 Testar
Botão **"Testar Gateway AI"** envia prompt fixo `"ping"` e mede latência.

---

## 12. Segurança

### 12.1 Política de senhas (futuro auth real)
- Comprimento mínimo: 12
- Complexidade: maiúscula + minúscula + número + especial
- Histórico: últimas 5 senhas bloqueadas
- Expiração: 90 dias
- HIBP check: on

### 12.2 MFA
- Obrigatório para roles: admin, operator (toggle)
- Algoritmo: TOTP (RFC 6238)
- Janela de validação: ±1 step

### 12.3 Sessão
- JWT exp: 1 hora
- Refresh token rotation: on
- Idle timeout: 30 min

### 12.4 CSP / Headers
- Política CSP visível (somente leitura)
- HSTS preload (toggle)

---

## 13. Auditoria

Visualização e exportação de `audit_logs` (também acessível via `/audit`).

Aqui na seção Admin: configurar
- Retenção (dias) — padrão 1825 (5 anos SISP)
- Categorias de eventos a capturar (toggle por tipo)
- Webhook de SIEM externo (futuro — envia logs para Splunk/Elastic)

---

## 14. Salvamento e Validação

Padrão em todas as seções:

1. Botões **Cancelar** e **Salvar Configuração**
2. Botão **Testar** (quando aplicável) antes de salvar
3. Toast de sucesso/erro
4. Audit log automático com diff antes/depois
5. Persistência: tabela `app_settings` (futura) ou Supabase Vault para secrets

---

## 15. Permissões

- Apenas `admin` acessa `/admin` (rota protegida com `requiredRoles=['admin']`)
- Logs de tudo via `audit_logs.action='SETTINGS_CHANGED'`
- Mudanças críticas (LDAP, RBAC, MFA obrigatório) podem exigir confirmação MFA recente (futuro)

---

## 16. Roadmap

- [ ] Persistir configurações em tabela `app_settings` com RLS
- [ ] Vault Supabase para todos os secrets sensíveis
- [ ] Webhook outbound para SIEM
- [ ] Backup/restore de configurações em arquivo JSON
- [ ] UI de templates de email (WYSIWYG)
- [ ] Histórico visual de mudanças com rollback 1-clique
