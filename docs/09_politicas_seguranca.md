# 09 — Políticas de Segurança (RBAC e RLS)

## 1. Modelo de papéis

Papéis vivem **exclusivamente** em `public.user_roles` (enum `app_role`). Guardar papel em `profiles` ou em armazenamento do navegador é proibido — abre caminho para escalonamento de privilégio.

| Papel | Descrição | Alcance |
| --- | --- | --- |
| `admin` | Administração plena | Todas as tabelas e configurações |
| `operator` | Operação SRE/SOC | Incidentes, ambientes, agentes, infraestrutura |
| `auditor` | Auditoria independente | Somente leitura de trilhas e catálogos |
| `viewer` | Consulta | Leitura de painéis operacionais |

### 1.1 Função canônica

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

`has_any_role(_user_id, _roles app_role[])` segue o mesmo padrão para conjuntos. `SECURITY DEFINER` evita recursão de RLS ao consultar `user_roles` dentro de políticas.

---

## 2. Princípios

1. **RLS habilitada em toda tabela de `public`** — sem exceção.
2. **`GRANT` explícito** por papel de banco (`authenticated`, `service_role`, e `anon` só quando existir política para ele).
3. **Negação por omissão** — ausência de política significa acesso zero.
4. **Escrita de telemetria só por `service_role`** — o app nunca insere em tabelas alimentadas por agentes.
5. **Trilhas são append-only** — sem `UPDATE` nem `DELETE`.
6. **Isolamento por usuário** em dados pessoais (`profiles`, `ai_conversations`, `export_jobs`).

---

## 3. Políticas por tabela

### 3.1 Catálogo CTIR e conformidade

| Tabela | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `ctir_advisories` | autenticado | admin, operator | admin, operator | admin |
| `monitored_environments` | autenticado | admin, operator | admin, operator | admin |
| `advisory_environment_assessments` | autenticado | admin, operator | admin, operator | admin |
| `ctir_sync_state` | admin, auditor, operator | service_role | service_role | — |

```sql
CREATE POLICY "advisories legíveis por autenticados"
ON public.ctir_advisories FOR SELECT TO authenticated USING (true);

CREATE POLICY "advisories editáveis por admin/operator"
ON public.ctir_advisories FOR UPDATE TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[]));
```

### 3.2 Vulnerabilidades

| Tabela | Regras |
| --- | --- |
| `nvd_vulnerabilities` | SELECT autenticado; escrita apenas `service_role` |
| `nvd_watchlist` | SELECT autenticado; CRUD para `admin`, `operator` |
| `nvd_vulnerability_history` | SELECT `admin`, `auditor`; sem INSERT/UPDATE/DELETE pelo app |

### 3.3 Operação

| Tabela | Regras |
| --- | --- |
| `incidents` | SELECT autenticado; INSERT/UPDATE `admin`, `operator`; DELETE `admin` |
| `clusters` | SELECT autenticado; CRUD `admin`, `operator` |

### 3.4 Hypervisores

Todas as cinco tabelas: **SELECT** para `admin`, `operator`, `viewer`; `INSERT`/`UPDATE`/`DELETE` negados a `authenticated` — escrita exclusiva da Edge Function `hypervisor-ingest` com `service_role`.

### 3.5 Agentes

| Tabela | Regras |
| --- | --- |
| `agents`, `agent_profiles`, `agent_skills`, `agent_channels` | SELECT autenticado; CRUD `admin`, `operator` |
| `agent_executions` | SELECT autenticado; INSERT `admin`, `operator` e `service_role`; sem DELETE |
| `skill_catalog_settings` | SELECT autenticado; UPDATE `admin`, `operator` |

### 3.6 Plataforma

| Tabela | Regras |
| --- | --- |
| `profiles` | SELECT/UPDATE apenas do próprio `auth.uid()`; INSERT no cadastro; **DELETE negado** |
| `user_roles` | SELECT do próprio usuário e de `admin`; INSERT/DELETE somente `admin` |
| `audit_logs` | SELECT `admin`, `auditor`; INSERT autenticado; **UPDATE e DELETE negados** |
| `sync_alerts` | SELECT `admin`, `auditor`, `operator`; INSERT/DELETE negados ao app |
| `export_jobs` | Todas as operações restritas a `user_id = auth.uid()` |
| `ai_conversations` | Todas as operações restritas a `user_id = auth.uid()` |

```sql
CREATE POLICY "jobs do próprio usuário"
ON public.export_jobs FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

---

## 4. Storage

Bucket **privado** `ctir-exports`:

- Caminho obrigatório `<auth.uid()>/<jobId>.<ext>`.
- Política de `SELECT`/`INSERT`/`DELETE` compara `(storage.foldername(name))[1] = auth.uid()::text`.
- Nenhum objeto é público; o download usa URL assinada de **60 segundos**.
- Remover um job apaga também o objeto correspondente.

---

## 5. Autenticação

| Controle | Definição |
| --- | --- |
| MFA | TOTP obrigatório para `admin` e `auditor` |
| Cadastro anônimo | desabilitado |
| Confirmação de e-mail | habilitada |
| Sessão | JWT com renovação automática; expiração curta |
| Provedores | e-mail/senha institucional; LDAP/AD (doc 14); Keycloak em roadmap |
| Redirect OAuth | sempre `window.location.origin` — nunca uma rota protegida |

---

## 6. Antipadrões proibidos

- Verificar `isAdmin` a partir de `localStorage`/`sessionStorage`.
- Guardar `role` em `profiles` ou em claim editável pelo cliente.
- Criar tabela sem `GRANT` (retorna erro de permissão em runtime).
- Usar `USING (true)` em `UPDATE`/`DELETE`.
- Expor bucket de exportação como público.
- Chamar a API do banco com chave de serviço a partir do navegador.

---

## 7. Revisão

Política de RLS é revisada a cada nova tabela e trimestralmente por amostragem, com evidência registrada em `/system-audit`. O linter de banco é executado a cada migration; avisos remanescentes são justificados por escrito.
