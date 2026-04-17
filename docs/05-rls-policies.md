# 05 — Políticas de Segurança (RLS)

> Toda tabela em `public` tem **Row-Level Security ativa**. Sem RLS, qualquer cliente com a `anon key` lê tudo. Aqui mora a primeira camada de autorização.

---

## 1. Princípios

1. **Zero-trust no banco:** RLS sempre ON, mesmo em tabelas "públicas".
2. **Roles em tabela isolada** (`user_roles`) consultadas via `SECURITY DEFINER` — evita recursão.
3. **Append-only para auditoria** — `audit_logs` não permite UPDATE nem DELETE.
4. **Owner-scoped por padrão** — usuário só vê o que é dele, exceto se role superior.
5. **Admin não passa por RLS via service-role key** — apenas Edge Functions usam.

---

## 2. Funções auxiliares (SECURITY DEFINER)

```sql
public.has_role(_user_id uuid, _role app_role) → boolean
public.has_any_role(_user_id uuid, _roles app_role[]) → boolean
```

Características críticas:
- `SECURITY DEFINER` → executa com privilégios do owner, **não** do caller
- `STABLE` → cacheável dentro da query
- `SET search_path = public` → previne hijacking via schema malicioso

---

## 3. Políticas por tabela

### 3.1 `profiles`

| Policy                  | Comando | Roles  | Expressão                                    |
| ----------------------- | ------- | ------ | -------------------------------------------- |
| Users view own profile  | SELECT  | public | `auth.uid() = user_id`                       |
| Admins view all profiles| SELECT  | public | `has_role(auth.uid(), 'admin'::app_role)`    |
| Users insert own profile| INSERT  | public | `auth.uid() = user_id` (WITH CHECK)          |
| Users update own profile| UPDATE  | public | `auth.uid() = user_id`                       |

> ⚠️ **Sem DELETE** — perfis nunca devem ser apagados (LGPD: cascade vem de `auth.users`).

### 3.2 `user_roles`

| Policy             | Comando | Roles  | Expressão                                   |
| ------------------ | ------- | ------ | ------------------------------------------- |
| Users view own roles| SELECT | public | `auth.uid() = user_id`                      |
| Admins view all roles| SELECT| public | `has_role(auth.uid(), 'admin')`             |
| Admins manage roles | ALL    | public | `has_role(auth.uid(), 'admin')`             |

### 3.3 `incidents`

| Policy                         | Comando | Roles         | Expressão                                                          |
| ------------------------------ | ------- | ------------- | ------------------------------------------------------------------ |
| Authenticated view incidents   | SELECT  | authenticated | `true`                                                             |
| Admins operators create incidents | INSERT | authenticated | `has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[])` |
| Admins operators update incidents | UPDATE | authenticated | `has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[])` |
| Admins delete incidents        | DELETE  | authenticated | `has_role(auth.uid(), 'admin'::app_role)`                          |

### 3.4 `clusters`

Mesma matriz de `incidents`:

| Policy                         | Comando | Expressão                                                          |
| ------------------------------ | ------- | ------------------------------------------------------------------ |
| Authenticated view clusters    | SELECT  | `true`                                                             |
| Admins operators create clusters | INSERT | `has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[])` |
| Admins operators update clusters | UPDATE | `has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[])` |
| Admins delete clusters         | DELETE  | `has_role(auth.uid(), 'admin'::app_role)`                          |

### 3.5 `audit_logs`

| Policy                  | Comando | Roles         | Expressão                                                            |
| ----------------------- | ------- | ------------- | -------------------------------------------------------------------- |
| Authenticated insert logs | INSERT | authenticated | `true` (WITH CHECK)                                                  |
| Admins auditors view logs | SELECT | authenticated | `has_any_role(auth.uid(), ARRAY['admin','auditor']::app_role[])`     |

> ❌ **Sem UPDATE / DELETE** — append-only para conformidade LGPD/SISP.

### 3.6 `ai_conversations`

| Policy                       | Comando | Roles  | Expressão               |
| ---------------------------- | ------- | ------ | ----------------------- |
| Users view own conversations | SELECT  | public | `auth.uid() = user_id`  |
| Users create own conversations | INSERT | public | `auth.uid() = user_id` (WITH CHECK) |
| Users update own conversations | UPDATE | public | `auth.uid() = user_id`  |
| Users delete own conversations | DELETE | public | `auth.uid() = user_id`  |

---

## 4. Matriz de permissões consolidada

|                        | viewer | auditor | operator | admin |
| ---------------------- | :----: | :-----: | :------: | :---: |
| `profiles` (próprio)   |   ✅   |   ✅    |    ✅    |  ✅   |
| `profiles` (todos)     |   ❌   |   ❌    |    ❌    |  ✅   |
| `user_roles` (próprio) |   ✅   |   ✅    |    ✅    |  ✅   |
| `user_roles` (gerir)   |   ❌   |   ❌    |    ❌    |  ✅   |
| `incidents` SELECT     |   ✅   |   ✅    |    ✅    |  ✅   |
| `incidents` INS/UPD    |   ❌   |   ❌    |    ✅    |  ✅   |
| `incidents` DELETE     |   ❌   |   ❌    |    ❌    |  ✅   |
| `clusters` SELECT      |   ✅   |   ✅    |    ✅    |  ✅   |
| `clusters` INS/UPD     |   ❌   |   ❌    |    ✅    |  ✅   |
| `clusters` DELETE      |   ❌   |   ❌    |    ❌    |  ✅   |
| `audit_logs` SELECT    |   ❌   |   ✅    |    ❌    |  ✅   |
| `audit_logs` INSERT    |   ✅   |   ✅    |    ✅    |  ✅   |
| `ai_conversations`     |   ✅ (próprias) | ✅ (próprias) | ✅ (próprias) | ✅ (próprias) |

---

## 5. Pontos de atenção

### 5.1 `auth.uid()` retorna NULL fora de contexto autenticado
Toda policy que compara com `auth.uid()` filtra anon automaticamente. ✅

### 5.2 Service Role key bypassa RLS
Usada **apenas em Edge Functions** (`SUPABASE_SERVICE_ROLE_KEY`). **Nunca expor ao frontend.**

### 5.3 INSERT sem `user_id`/`created_by` válido
- `profiles`: WITH CHECK `auth.uid() = user_id` força preenchimento.
- `incidents`/`clusters`: `created_by` é nullable, mas convenção é preencher com `auth.uid()` no insert.

### 5.4 Audit log sem RLS de SELECT para usuário comum
Decisão consciente: usuários **não** veem logs (só `auditor`/`admin`). Visibilidade do próprio histórico fica para feature futura via view.

---

## 6. Checklist de auditoria RLS (rodar trimestralmente)

```sql
-- 1. Toda tabela em public tem RLS habilitada?
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- Resultado esperado: 0 linhas

-- 2. Toda tabela tem ao menos uma policy?
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public' AND p.policyname IS NULL;
-- Resultado esperado: 0 linhas

-- 3. Funções SECURITY DEFINER têm search_path?
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND prosecdef = true
  AND (proconfig IS NULL OR NOT 'search_path=public' = ANY(proconfig));
-- Resultado esperado: 0 linhas
```

---

## 7. Testes de RLS

Cenários mínimos a testar (PRs novos):

1. **Usuário viewer** tenta INSERT em `incidents` → 403
2. **Usuário operator** tenta DELETE em `clusters` → 403
3. **Usuário comum** tenta SELECT em `audit_logs` → linhas vazias
4. **Anon** tenta SELECT qualquer tabela → 401
5. **Admin** consegue SELECT/INSERT/UPDATE/DELETE em tudo
6. **Auditor** lê `audit_logs`, mas não consegue UPDATE → 403
