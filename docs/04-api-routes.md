# 04 — Rotas de API

> Duas camadas: **Edge Functions** (Deno, serverless) e **REST PostgREST** (auto-gerado pelo Supabase).

---

## 1. Edge Functions (Deno · Lovable Cloud)

### 1.1 `POST /functions/v1/ai-chat`

**Função:** proxy para o Lovable AI Gateway com injeção de contexto operacional e streaming SSE.

| Aspecto             | Valor                                                  |
| ------------------- | ------------------------------------------------------ |
| Endpoint            | `https://<project>.functions.supabase.co/ai-chat`      |
| Método              | `POST`                                                 |
| Auth                | JWT do usuário (Bearer)                                |
| Resposta            | `text/event-stream` (SSE)                              |
| Modelos suportados  | `google/gemini-3-flash-preview`, `google/gemini-2.5-flash`, `google/gemini-2.5-flash-lite`, `google/gemini-2.5-pro`, `openai/gpt-5`, `openai/gpt-5-mini`, `openai/gpt-5-nano`, `openai/gpt-5.2`, `google/gemini-3.1-pro-preview` |

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "Resumo dos incidentes P1 hoje" }
  ],
  "model": "google/gemini-3-flash-preview"
}
```

**Stream chunks (SSE):**
```
data: {"choices":[{"delta":{"content":"Encontrei "}}]}

data: {"choices":[{"delta":{"content":"3 incidentes "}}]}

data: [DONE]
```

**Erros:**
| Código | Causa                          | Ação                                    |
| ------ | ------------------------------ | --------------------------------------- |
| 401    | JWT inválido                   | Re-login                                |
| 402    | Saldo Lovable AI insuficiente | Avisar admin para top-up                |
| 429    | Rate limit (model)             | Backoff exponencial                     |
| 500    | Erro upstream                  | Retry com fallback model                |

---

## 2. REST API (PostgREST — auto)

Base URL: `https://<project>.supabase.co/rest/v1`

Headers obrigatórios:
```
Authorization: Bearer <jwt>
apikey: <SUPABASE_PUBLISHABLE_KEY>
Content-Type: application/json
Prefer: return=representation
```

### 2.1 `incidents`

| Operação | Endpoint                                   | Roles                |
| -------- | ------------------------------------------ | -------------------- |
| Listar   | `GET /incidents?select=*&order=created_at.desc` | autenticados    |
| Detalhe  | `GET /incidents?id=eq.{uuid}`              | autenticados         |
| Filtro severidade | `GET /incidents?severity=eq.critical` | autenticados      |
| Criar    | `POST /incidents`                          | `admin`, `operator`  |
| Atualizar| `PATCH /incidents?id=eq.{uuid}`            | `admin`, `operator`  |
| Resolver | `PATCH /incidents?id=eq.{uuid}` (status='resolved', resolved_at, mttr_minutes) | `admin`, `operator` |
| Excluir  | `DELETE /incidents?id=eq.{uuid}`           | `admin`              |

**Exemplo criar:**
```bash
curl -X POST $URL/rest/v1/incidents \
  -H "Authorization: Bearer $JWT" \
  -H "apikey: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API gateway 503",
    "severity": "critical",
    "environment": "production",
    "service": "auth-svc",
    "source": "zabbix"
  }'
```

### 2.2 `clusters`

| Operação | Endpoint                                | Roles               |
| -------- | --------------------------------------- | ------------------- |
| Listar   | `GET /clusters`                         | autenticados        |
| Criar    | `POST /clusters`                        | `admin`, `operator` |
| Atualizar| `PATCH /clusters?id=eq.{uuid}`          | `admin`, `operator` |
| Excluir  | `DELETE /clusters?id=eq.{uuid}`         | `admin`             |

### 2.3 `profiles`

| Operação              | Endpoint                                | Regras                          |
| --------------------- | --------------------------------------- | ------------------------------- |
| Ver próprio           | `GET /profiles?user_id=eq.{me}`         | dono                            |
| Ver todos (admin)     | `GET /profiles`                         | role `admin`                    |
| Atualizar próprio     | `PATCH /profiles?user_id=eq.{me}`       | dono                            |
| Criar (signup)        | `POST /profiles`                        | dono (auto-criado pós-signup)   |

### 2.4 `user_roles`

| Operação | Endpoint                       | Regras                  |
| -------- | ------------------------------ | ----------------------- |
| Ver próprias | `GET /user_roles?user_id=eq.{me}` | dono              |
| Listar todas | `GET /user_roles`              | `admin`                |
| Adicionar    | `POST /user_roles`             | `admin`                |
| Remover      | `DELETE /user_roles?id=eq.{u}` | `admin`                |

### 2.5 `audit_logs`

| Operação | Endpoint                                  | Regras                           |
| -------- | ----------------------------------------- | -------------------------------- |
| Ler      | `GET /audit_logs?order=created_at.desc`   | `admin`, `auditor`               |
| Inserir  | `POST /audit_logs`                        | qualquer autenticado             |
| **UPDATE/DELETE: bloqueado** (LGPD append-only) | — | nenhuma role |

### 2.6 `ai_conversations`

| Operação | Endpoint                                       | Regras |
| -------- | ---------------------------------------------- | ------ |
| Listar   | `GET /ai_conversations?user_id=eq.{me}`        | dono   |
| Criar    | `POST /ai_conversations`                       | dono   |
| Atualizar| `PATCH /ai_conversations?id=eq.{uuid}`         | dono   |
| Excluir  | `DELETE /ai_conversations?id=eq.{uuid}`        | dono   |

---

## 3. RPC Functions (PostgREST)

| Função                              | Endpoint                              | Uso                              |
| ----------------------------------- | ------------------------------------- | -------------------------------- |
| `has_role(_user_id, _role)`         | `POST /rpc/has_role`                  | Verificação programática         |
| `has_any_role(_user_id, _roles[])`  | `POST /rpc/has_any_role`              | Verificação em batch             |

---

## 4. Realtime (WebSocket)

```ts
import { supabase } from '@/integrations/supabase/client';

const channel = supabase
  .channel('incidents-feed')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'incidents',
  }, (payload) => {
    console.log('Incident change:', payload);
  })
  .subscribe();
```

Tabelas com realtime ativo: `incidents`, `audit_logs`.

---

## 5. Filtros PostgREST úteis

| Operador      | Sintaxe                                      | Exemplo                           |
| ------------- | -------------------------------------------- | --------------------------------- |
| Igualdade     | `column=eq.value`                            | `severity=eq.critical`            |
| Diferente     | `column=neq.value`                           | `status=neq.closed`               |
| Maior que     | `column=gt.value`                            | `created_at=gt.2024-01-01`        |
| IN            | `column=in.(a,b,c)`                          | `severity=in.(critical,high)`     |
| LIKE          | `column=like.*term*`                         | `title=like.*timeout*`            |
| Order         | `order=col.desc`                             | `order=created_at.desc`           |
| Limit         | `limit=N`                                    | `limit=50`                        |
| Range         | header `Range: 0-49`                         | paginação                         |
| Embed         | `select=*,profiles(*)`                       | join                              |

---

## 6. Códigos de status

| Code | Significado                                          |
| ---- | ---------------------------------------------------- |
| 200  | OK (GET, PATCH com return=representation)            |
| 201  | Created (POST)                                       |
| 204  | No Content (DELETE)                                  |
| 401  | Não autenticado                                      |
| 403  | RLS bloqueou (sem permissão)                         |
| 404  | Recurso ou rota não encontrada                       |
| 409  | Conflito (duplicate UNIQUE)                          |
| 422  | Validação falhou (constraint, NOT NULL)              |
| 429  | Rate limit                                           |
| 500  | Erro do servidor                                     |

---

## 7. Sidecar Python (FastAPI — opcional)

Hospedado em `disph-aiops-backend/`. Endpoints internos (não expostos diretamente ao frontend):

| Endpoint                           | Função                                   |
| ---------------------------------- | ---------------------------------------- |
| `POST /api/incidents/triage`       | Classifica incidente via LLM             |
| `POST /api/skills/run`             | Executa skill (Ansible, kubectl)         |
| `POST /api/notifications/dispatch` | Dispara Teams/WhatsApp/SMTP              |
| `POST /api/rag/query`              | Consulta knowledge base com embeddings   |

Comunicação **frontend → sidecar** sempre passa por uma Edge Function como proxy autenticado.

---

## Atualização — Auditoria Jun/2026

**Edge Functions ativas:**
- `ai-chat` — proxy streaming SSE para Lovable AI Gateway (consumido por `AIChatConsole`).
- `sync-ctir-advisories` — pull dos boletins CTIR Gov.br (consumido por `ARPage`).

**Modelos de IA disponíveis** (fonte única em `src/lib/aiModels.ts`):
- Google: `gemini-3-flash-preview`, `gemini-2.5-flash` (padrão), `gemini-2.5-flash-lite`, `gemini-2.5-pro`, `gemini-3.1-pro-preview`.
- OpenAI: `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5.2`.

**Sidecar Python (`disph-aiops-backend`)** expõe `/skills` (registry), `/execute` (run skill), `/health`. Os nomes das skills agora coincidem com o catálogo frontend (`trigger_ansible_playbook`, `k8s_scale_deployment`, `create_gitlab_mr`, etc.).
