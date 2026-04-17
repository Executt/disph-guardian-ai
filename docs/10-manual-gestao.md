# 10 — Manual de Gestão do Sistema

> Guia operacional para administradores e gestores da plataforma DISPH-AIOPS.

---

## 1. Papéis e Responsabilidades

| Papel              | Responsabilidades principais                                 |
| ------------------ | ------------------------------------------------------------ |
| **Admin**          | Configurar plataforma, gerir usuários, RBAC, integrações     |
| **Operador SRE**   | Triagem e resolução de incidentes, manutenção de clusters    |
| **Auditor**        | Revisar logs, gerar relatórios LGPD/SISP                     |
| **Visualizador**   | Acompanhar dashboards, sem alterar dados                     |
| **Gestor de TI**   | Aprovar mudanças críticas, revisar SLA mensalmente           |

---

## 2. Operação Diária

### 2.1 Ronda matinal (08h – 30 min)

1. Abrir **Dashboard** (`/`) — verificar:
   - SLA atual (alvo > 97%)
   - MTTR média do dia anterior (alvo < 30 min)
   - Disponibilidade por ambiente (alvo > 99.5%)
2. Abrir **Incidentes** (`/incidents`) — filtrar status ≠ resolved/closed
3. Confirmar atribuição dos abertos
4. Verificar **Infraestrutura** — clusters em `error` ou `inactive`
5. Validar **AI Chat**: pergunta-padrão "Resuma incidentes das últimas 24h"

### 2.2 Acompanhamento contínuo

- Toast de novo incidente `critical` → acionar plantonista em **5 min**
- Sincronização LDAP automática a cada **30 min** (validar última sync em Admin)

### 2.3 Fechamento diário (18h)

1. Revisar incidentes ainda abertos → escalar se necessário
2. Atualizar status para `mitigating` se solução já em curso
3. Conferir **Auditoria** — eventos críticos do dia

---

## 3. Operação Semanal

### Segunda — Análise de tendências
- Exportar relatório de incidentes da semana anterior
- Reunião de 30 min com equipe SRE para revisar RCAs

### Quarta — Revisão de configuração
- **Admin → LDAP**: validar mapeamento de grupos, testar conexão
- **Admin → Notificações**: verificar entregas (Teams/WhatsApp/SMTP)
- **Admin → Clusters**: validar inventário vs realidade

### Sexta — Compliance
- **Auditoria**: revisar `LOGIN_FAILED` excessivos
- Verificar contas `locked` aguardando reset
- Backup snapshot manual antes do fim de semana

---

## 4. Operação Mensal

### Primeiro dia útil
- Gerar **Relatório de SLA** do mês anterior (futuro: PDF automatizado)
- Apresentar ao gestor de TI: SLA, MTTR, top-5 serviços com mais incidentes
- Revisar contagem de Pontos de Função (se houve incremento)

### Meio do mês
- Auditoria de roles: usuários com `admin`/`operator` ainda ativos?
- Rotação de secrets se necessário (LOVABLE_API_KEY a cada 90d)

### Fim do mês
- Snapshot de configuração da plataforma exportado para repositório seguro
- Limpeza de `ai_conversations` > 90 dias

---

## 5. Backup & Recuperação

### 5.1 Backup automático (Lovable Cloud)

- **Frequência:** diária às 03h BRT
- **Retenção:** 7 dias rolling
- **Tipo:** snapshot consistente do PostgreSQL
- **Localização:** região do projeto

### 5.2 Backup manual (DR)

Exportar via SQL:

```sql
-- Snapshot completo (admin via psql/pgadmin)
COPY incidents TO '/backup/incidents.csv' CSV HEADER;
COPY clusters  TO '/backup/clusters.csv'  CSV HEADER;
COPY profiles  TO '/backup/profiles.csv'  CSV HEADER;
COPY user_roles TO '/backup/user_roles.csv' CSV HEADER;
-- audit_logs SEMPRE com data range, nunca tudo
COPY (SELECT * FROM audit_logs WHERE created_at > now() - interval '30 days')
  TO '/backup/audit_30d.csv' CSV HEADER;
```

### 5.3 Restore (cenário de DR)

1. Provisionar projeto novo na Lovable Cloud
2. Aplicar `supabase/migrations/*.sql` em ordem
3. Restaurar dump via `psql -f backup.sql`
4. Atualizar variáveis em frontend (`.env` auto)
5. Verificar RLS: rodar checklist de `docs/05-rls-policies.md` §6

### 5.4 RTO / RPO

| Métrica       | Alvo   | Real (medido) |
| ------------- | ------ | ------------- |
| RPO           | 24h    | -             |
| RTO           | 4h     | -             |
| Tempo de reprovisão completo | 8h | - |

---

## 6. Monitoramento da Plataforma

### 6.1 Health-checks que rodam continuamente

| Check                                | Frequência | Ação se falhar             |
| ------------------------------------ | ---------- | -------------------------- |
| Frontend disponível (HTTPS 200)      | 1 min      | Alerta Teams + email       |
| Edge function `ai-chat` responde     | 5 min      | Alerta + log em audit      |
| Banco aceita conexões                | 1 min      | Pager admin                |
| LDAP sync rodou nos últimos 60 min   | 1 min      | Alerta Teams               |

### 6.2 Métricas-chave

- **Tempo de resposta dashboard** (alvo < 2s)
- **Latência do AI chat** (TTFT — time to first token, alvo < 1.5s)
- **Tempo de query incidents** (alvo < 200ms p95)
- **% requests 5xx** (alvo < 0.1%)

---

## 7. Troubleshooting Rápido

### 7.1 "Não consigo fazer login"

| Sintoma                              | Causa provável                      | Ação                              |
| ------------------------------------ | ----------------------------------- | --------------------------------- |
| "Credenciais inválidas"              | Senha errada                        | Reset via admin                   |
| "MFA inválido"                       | Relógio do device fora de sincronia | Reset NTP / regenerar TOTP        |
| "Conta bloqueada"                    | 3+ falhas MFA                       | Admin: status → `active`          |
| Login OK mas sem permissão           | Sem `user_roles`                    | Admin atribui role                |

### 7.2 "Não vejo dados"

| Página             | Verificar                                   |
| ------------------ | ------------------------------------------- |
| Dashboard vazio    | Existem incidentes nas últimas 24h?         |
| Incidentes vazia   | Filtros aplicados? RLS bloqueou? (logout/login) |
| Clusters vazia     | Cadastrar via Admin → Infraestrutura        |
| Auditoria vazia    | Role tem `auditor` ou `admin`?              |

### 7.3 "AI Chat não responde"

1. Verificar **status Lovable AI Gateway** (Admin → IA → Testar Gateway)
2. Verificar saldo da conta Lovable (créditos AI)
3. Logs da edge function via dashboard Lovable Cloud
4. Trocar para outro modelo (Gemini Flash Lite — mais leve)

### 7.4 "Sync LDAP falhou"

1. Admin → LDAP → "Testar Conexão"
2. Verificar firewall/VPN para porta 636
3. Validar `bind_dn` e `bind_password`
4. Logs detalhados em `audit_logs` action `LDAP_SYNC`

---

## 8. Onboarding de Novos Usuários

### 8.1 Via LDAP (preferencial)
1. Adicionar usuário ao grupo correto no AD (`disph-operators` etc.)
2. Aguardar próxima sincronização (≤ 30 min) ou forçar em **Admin → LDAP → Sincronizar Agora**
3. Usuário recebe email com instruções
4. Primeiro login: configurar MFA TOTP
5. Confirmar acesso esperado

### 8.2 Local (exceção, ex: service account CI/CD)
1. Admin → Usuários → "Adicionar Usuário"
2. Preencher username, email, roles
3. Definir source = `local`, MFA conforme necessidade
4. Comunicar credencial inicial via canal seguro
5. Forçar troca no primeiro login (futuro)

---

## 9. Offboarding

1. Admin → Usuários → status `inactive` (preserva histórico)
2. Remover de grupos LDAP corporativos
3. Audit log registra `USER_DEACTIVATED`
4. Após 90 dias: opção de exclusão definitiva (LGPD esquecimento)
5. `audit_logs` mantém registros com `user_id = NULL` (anonimizado)

---

## 10. Atualizações da Plataforma

### 10.1 Patch (sem breaking change)
- Janela: imediata
- Aviso: log no Slack do time
- Validação: smoke-test no Dashboard

### 10.2 Minor (novas features)
- Janela: durante horário comercial após validação em HML
- Aviso: 24h antes via banner
- Treinamento: vídeo curto (< 5 min) anexado ao changelog

### 10.3 Major (mudanças estruturais)
- Janela: domingos 02h–06h
- Aviso: 7 dias antes
- Plano de rollback documentado
- Comunicação formal pelo gestor de TI

---

## 11. Contatos & Escalação

| Função                  | Canal                                   |
| ----------------------- | --------------------------------------- |
| Plantonista SRE         | WhatsApp + Teams                        |
| Coordenador de TI       | Teams + email                           |
| Gestor de Segurança     | seguranca@disph.gov.br                  |
| Lovable Cloud Suporte   | https://lovable.dev/support             |

---

## 12. Documentos relacionados

- [docs/06-seguranca.md](06-seguranca.md) — Políticas de segurança detalhadas
- [docs/09-regras-de-negocio.md](09-regras-de-negocio.md) — Regras de negócio
- [docs/11-administracao.md](11-administracao.md) — Configurações administrativas passo a passo
