# 06 — Segurança

> Modelo de **defesa em profundidade** do DISPH-AIOPS, alinhado a LGPD, SISP, ISO 27001 e NIST CSF.

---

## 1. Modelo de Ameaças (resumido)

| Ameaça                           | Mitigação                                                  |
| -------------------------------- | ---------------------------------------------------------- |
| Roubo de credenciais             | MFA TOTP obrigatório para admin/operator                   |
| Privilege escalation             | Roles em tabela isolada + `SECURITY DEFINER` functions     |
| SQL Injection                    | PostgREST + parameterized queries (Supabase SDK)           |
| XSS                              | React escape automático + CSP headers                      |
| CSRF                             | JWT em Authorization header (não cookie)                   |
| Data exfiltration                | RLS em todas as tabelas                                    |
| Replay de tokens                 | JWT exp = 1h + refresh token rotation                      |
| Man-in-the-middle                | HTTPS strict + LDAPS para diretório                        |
| Secret leakage                   | Secrets em vault Supabase, **nunca** no `.env` do front    |
| AI prompt injection              | Guardrails na Edge Function ai-chat                        |
| Supply chain                     | Bun lockfile + `npm audit` semanal                         |

---

## 2. Autenticação

### 2.1 Fluxo atual (mock + futuro real)

```
LoginPage
  ↓ usuário/senha
[Mock Keycloak ou supabase.auth.signInWithPassword]
  ↓ JWT recebido
LoginPage step "MFA"
  ↓ código TOTP (123456 em demo)
AuthContext.user populado
  ↓ session persistida (localStorage)
ProtectedRoute libera /
```

### 2.2 MFA TOTP

- **Algoritmo:** RFC 6238 (TOTP / SHA-1 / 6 dígitos / 30s)
- **Janela:** ±1 step (90s tolerance)
- **Obrigatório para:** roles `admin` e `operator`
- **Armazenamento do secret:** futuro — `auth.mfa_factors` (Supabase nativo)

### 2.3 LDAP / Active Directory

Configurado em **Admin → LDAP**:

| Setting          | Valor exemplo                                          |
| ---------------- | ------------------------------------------------------ |
| URL              | `ldaps://ldap.corp.gov.br:636`                         |
| Base DN          | `dc=corp,dc=gov,dc=br`                                 |
| Bind DN          | `cn=disph-svc,ou=services,dc=corp,dc=gov,dc=br`        |
| User filter      | `(&(objectClass=person)(memberOf=cn=disph-users,...))` |
| TLS              | obrigatório (porta 636)                                |
| Sync interval    | 30 min                                                 |

**Mapeamento grupo → role:**
| LDAP group                          | App role   |
| ----------------------------------- | ---------- |
| `cn=disph-admins,ou=groups`         | `admin`    |
| `cn=disph-operators,ou=groups`      | `operator` |
| `cn=disph-viewers,ou=groups`        | `viewer`   |
| `cn=disph-auditors,ou=groups`       | `auditor`  |

---

## 3. Autorização

Camadas (em ordem de execução):

1. **Frontend** — `ProtectedRoute requiredRoles=[...]` esconde UI (UX, não segurança)
2. **Edge Function** — valida JWT e role antes de processar
3. **PostgreSQL RLS** — autoridade final (ver `docs/05-rls-policies.md`)
4. **Audit log** — registra a ação independentemente do resultado

> 🚨 **Frontend NÃO é a camada de segurança** — qualquer DevTools quebra checks de UI. RLS é a verdade.

---

## 4. Criptografia

| Em trânsito                   | Em repouso                                |
| ----------------------------- | ----------------------------------------- |
| HTTPS 1.3 (TLS) obrigatório   | AES-256 no PostgreSQL (Supabase managed)  |
| LDAPS para diretório          | Backups criptografados                    |
| WebSocket WSS                 | Senhas: bcrypt cost 12 (auth.users)       |
| SMTP STARTTLS / SMTPS         | Secrets em Supabase Vault (KMS)           |

---

## 5. Auditoria (LGPD / SISP)

### 5.1 Eventos registrados em `audit_logs`

| Action                       | Resource type     | Detalhes capturados             |
| ---------------------------- | ----------------- | ------------------------------- |
| `LOGIN_SUCCESS`              | `auth`            | IP, user-agent, MFA usado       |
| `LOGIN_FAILED`               | `auth`            | IP, motivo                      |
| `MFA_ENABLED` / `MFA_DISABLED` | `auth`         | usuário                         |
| `INCIDENT_CREATED`           | `incidents`       | id, severity, source            |
| `INCIDENT_UPDATED`           | `incidents`       | diff de campos                  |
| `INCIDENT_RESOLVED`          | `incidents`       | mttr, resolução                 |
| `INCIDENT_DELETED`           | `incidents`       | snapshot completo               |
| `CLUSTER_CREATED/UPDATED/DEL`| `clusters`        | id, provider                    |
| `ROLE_ASSIGNED/REVOKED`      | `user_roles`      | target user, role               |
| `LDAP_SYNC`                  | `admin`           | qtd usuários, status            |
| `SETTINGS_CHANGED`           | `admin`           | chave alterada, valor anterior  |

### 5.2 Retenção

- **`audit_logs`:** mínimo **5 anos** (SISP)
- **Backup off-site:** retenção 7 anos (gov.br)
- **Tokens MFA:** sem persistência além da janela ativa

### 5.3 LGPD — direitos do titular

| Direito                       | Implementação                                     |
| ----------------------------- | ------------------------------------------------- |
| Acesso aos dados              | Endpoint `/profile/me` (futuro — exportação JSON) |
| Correção                      | UI Settings → editar perfil                       |
| Exclusão (esquecimento)       | Admin: cascade delete em `auth.users`             |
| Portabilidade                 | Export JSON de incidentes/conversas               |
| Anonimização                  | `audit_logs.user_id = NULL` após exclusão         |

---

## 6. Secrets Management

| Secret                       | Armazenamento                  | Rotação        |
| ---------------------------- | ------------------------------ | -------------- |
| `LOVABLE_API_KEY`            | Supabase Vault                 | 90 dias        |
| `SUPABASE_SERVICE_ROLE_KEY`  | Supabase Vault                 | sob demanda    |
| `SUPABASE_PUBLISHABLE_KEY`   | `.env` (público, OK)           | n/a            |
| `LDAP_BIND_PASSWORD`         | Admin (futuro: vault)          | 30 dias        |
| `SMTP_PASSWORD`              | Admin (futuro: vault)          | 90 dias        |
| `SEI_API_TOKEN`              | Admin (futuro: vault)          | 365 dias       |
| `TEAMS_WEBHOOK_URL`          | Admin                          | sob demanda    |

> ⚠️ **Nunca commitar secrets.** Frontend só usa keys publishable.

---

## 7. CSP & Headers (Lovable Cloud)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  frame-ancestors 'none';

Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## 8. AI Safety (Lovable AI Gateway)

Console de chat (`/functions/ai-chat`) aplica:

1. **System prompt fixo** com diretrizes operacionais.
2. **Context injection** restrito a métricas agregadas (sem PII).
3. **Output filtering** — refuta pedidos de execução remota.
4. **Token cap** por request (max 4096 output).
5. **Rate limit por usuário** — 60 req/min.
6. **Logs** de prompts em `audit_logs.action='AI_QUERY'` (sem persistir conteúdo sensível).

---

## 9. Compliance Mapping

| Controle                           | LGPD | SISP | ISO 27001 | NIST CSF |
| ---------------------------------- | :--: | :--: | :-------: | :------: |
| RLS por tabela                     |  ✅  |  ✅  | A.9.4.1   | PR.AC-4  |
| MFA obrigatório (admin/op)         |  ✅  |  ✅  | A.9.4.2   | PR.AC-7  |
| Audit log append-only              |  ✅  |  ✅  | A.12.4.1  | DE.AE-3  |
| Criptografia em trânsito           |  ✅  |  ✅  | A.13.1.1  | PR.DS-2  |
| Criptografia em repouso            |  ✅  |  ✅  | A.10.1.1  | PR.DS-1  |
| Backup automatizado                |  ✅  |  ✅  | A.12.3.1  | PR.IP-4  |
| Retenção 5+ anos audit             |  ✅  |  ✅  | —         | —        |
| LDAP corporativo                   |  -   |  ✅  | A.9.2.1   | PR.AC-1  |
| Direitos do titular (LGPD)         |  ✅  |  -   | —         | —        |

---

## 10. Incident Response (segurança)

Em caso de suspeita de breach:

1. **Conter:** rotacionar `SERVICE_ROLE_KEY` e revogar sessões (`supabase.auth.admin.signOut(uid)`)
2. **Investigar:** consultar `audit_logs` filtrando por IP suspeito + janela temporal
3. **Erradicar:** identificar vetor, bloquear conta, aplicar patch
4. **Recuperar:** restore de backup se necessário
5. **Lições:** RCA escrita + atualizar este documento

Contato emergencial: `seguranca@disph.gov.br` · MTTR alvo de contenção: **30 min**.
