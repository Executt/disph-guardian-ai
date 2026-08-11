# 14 — Configuração LDAP/AD

## 1. Objetivo

Autenticar usuários do órgão pelo diretório corporativo (Active Directory ou OpenLDAP) e derivar papéis da aplicação a partir de grupos do diretório, mantendo `public.user_roles` como **única** fonte de autorização no banco.

---

## 2. Topologia

```
Navegador ──▶ SPA ──▶ Auth da plataforma (e-mail/senha)
                          ▲
                          │ provisionamento
Sidecar FastAPI ──▶ LDAP/AD (LDAPS 636)
```

- O navegador **nunca** fala com o LDAP.
- O sidecar (rede interna) consulta o diretório e sincroniza usuários e grupos.
- A sessão do usuário continua sendo o JWT da plataforma; RLS não muda.

---

## 3. Parâmetros de conexão

| Parâmetro | Exemplo | Observação |
| --- | --- | --- |
| `LDAP_URL` | `ldaps://dc01.orgao.gov.br:636` | TLS obrigatório |
| `LDAP_BIND_DN` | `CN=svc-disph,OU=Servicos,DC=orgao,DC=gov,DC=br` | Conta de serviço somente leitura |
| `LDAP_BIND_PASSWORD` | *(segredo)* | Nunca em código ou banco |
| `LDAP_BASE_DN` | `DC=orgao,DC=gov,DC=br` | Raiz da busca |
| `LDAP_USER_FILTER` | `(&(objectClass=user)(sAMAccountName={login}))` | AD |
| `LDAP_GROUP_FILTER` | `(&(objectClass=group)(member={dn}))` | Grupos do usuário |
| `LDAP_CA_BUNDLE` | `/etc/ssl/certs/orgao-ca.pem` | Validação da cadeia |
| `LDAP_TIMEOUT_MS` | `5000` | Falha rápida |

Todos são segredos de plataforma no sidecar, com prefixo `DISPH_`.

---

## 4. Atributos mapeados

| Atributo LDAP | Campo interno |
| --- | --- |
| `sAMAccountName` / `uid` | `username` |
| `displayName` / `cn` | `profiles.display_name` |
| `mail` | e-mail de login |
| `department` | `profiles.department` |
| `memberOf` | origem dos papéis |
| `userAccountControl` | conta desabilitada → revogar papéis |

---

## 5. Mapa de grupos → papéis

| Grupo no diretório | `app_role` |
| --- | --- |
| `CN=DISPH-Admins` | `admin` |
| `CN=DISPH-Operacao` | `operator` |
| `CN=DISPH-Auditoria` | `auditor` |
| `CN=DISPH-Consulta` | `viewer` |

Regras:

1. Um usuário pode receber vários papéis (uma linha por papel em `user_roles`).
2. Sem grupo correspondente → **nenhum** papel (acesso zero, por omissão).
3. Papel concedido manualmente fora do diretório é sobrescrito na próxima sincronização — exceções devem virar grupo no AD.
4. `admin` e `auditor` exigem MFA TOTP (doc 13).

---

## 6. Sincronização

| Item | Definição |
| --- | --- |
| Periodicidade | A cada 30 min (agendador do sidecar) |
| Escopo | Usuários dos quatro grupos mapeados |
| Modo | Incremental por `whenChanged` (AD) ou `modifyTimestamp` (LDAP) |
| Escrita | `service_role`, apenas em `profiles` e `user_roles` |
| Remoção | Conta desabilitada ou fora de todos os grupos → `DELETE` das linhas em `user_roles` |
| Registro | Cada execução gera evento em `audit_logs` (`ldap_sync`) |

Pseudocódigo do ciclo:

```python
for entry in ldap.search(base_dn, user_filter, attrs):
    profile = upsert_profile(entry)
    roles = map_groups(entry["memberOf"])
    reconcile_roles(profile.id, roles)   # insere faltantes, remove excedentes
```

---

## 7. Falhas e contingência

| Falha | Comportamento |
| --- | --- |
| Diretório indisponível | Mantém papéis vigentes; alerta em `sync_alerts`; notifica Teams |
| Bind inválido | Interrompe o ciclo, não altera papéis, severidade alta |
| Certificado expirado | Falha explícita — **nunca** cair para LDAP sem TLS |
| Grupo renomeado | Usuários perdem papel; exige atualização do mapa e nova execução |

Nenhuma falha de LDAP concede papel. A degradação é sempre para menos privilégio.

---

## 8. Testes de aceite

- [ ] Bind com conta de serviço em LDAPS válido
- [ ] Usuário de `DISPH-Admins` recebe `admin` e é obrigado a MFA
- [ ] Usuário removido do grupo perde o papel no ciclo seguinte
- [ ] Conta desabilitada perde todos os papéis
- [ ] Falha de rede não altera `user_roles`
- [ ] Cada execução aparece em `audit_logs`
