# 13 — Segurança e Hardening

## 1. Superfícies de ataque

| Superfície | Controle principal |
| --- | --- |
| SPA no navegador | CSP, sem segredos no bundle, sem decisão de autorização no cliente |
| Data API (PostgREST) | JWT + RLS em todas as tabelas |
| Edge Functions | `verify_jwt` quando expostas ao usuário; validação de payload |
| Bucket de exportação | Privado, isolado por `auth.uid()`, URL assinada de 60s |
| Agente on-prem | Chave dedicada, saída unidirecional (push), sem porta de entrada |
| Sidecar FastAPI | Rede interna, token próprio, sem exposição pública |

---

## 2. Autenticação e sessão

- MFA TOTP obrigatório para `admin` e `auditor`.
- Cadastro anônimo desabilitado; confirmação de e-mail habilitada.
- JWT de vida curta com renovação automática; logout invalida a sessão local.
- Redirect de OAuth sempre para `window.location.origin` — nunca para rota protegida.
- Bloqueio progressivo após tentativas malsucedidas.

---

## 3. Autorização

Três camadas, na ordem de autoridade:

1. **RLS no banco** — decisão final, baseada em `has_role`/`has_any_role`.
2. **Edge Function** — revalida papel antes de operações sensíveis.
3. **UI (`ProtectedRoute`, TopNav)** — apenas experiência de uso.

Proibido: verificar papel a partir de armazenamento do navegador, guardar `role` em `profiles`, ou confiar em claim editável pelo cliente.

---

## 4. Cabeçalhos e política de conteúdo

| Cabeçalho | Valor recomendado |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `X-Frame-Options` | `DENY` |

---

## 5. Entrada e saída de dados

- Validação com **zod** em todo formulário; o servidor revalida.
- Consultas parametrizadas — jamais concatenação de SQL.
- Sanitização do markdown do assistente de IA (sem HTML bruto).
- Upload restrito a artefatos gerados pelo próprio sistema.
- Respostas de erro sem stack trace nem detalhe de infraestrutura.

---

## 6. Segredos

| Regra | Detalhe |
| --- | --- |
| Armazenamento | Segredos da plataforma; nunca em código, banco em texto claro ou logs |
| Rotação | Semestral ou imediata em suspeita de vazamento |
| Escopo | Uma credencial por integração, com menor privilégio |
| Chave de serviço e senha do banco | Não acessíveis à aplicação; nunca registradas nem retornadas |
| Chave publicável (anon) | Pode constar no cliente |

---

## 7. Registro e monitoramento

| Evento | Destino |
| --- | --- |
| Login, logout, falha de MFA | `audit_logs` |
| Alteração de papel ou integração | `audit_logs` |
| Execução de skill de risco ≥ 3 | `agent_executions` + `audit_logs` |
| Falha de sincronização | `sync_alerts` + Teams/WhatsApp + ITSM |
| Exportação de auditoria | `export_jobs` |

Nada de PII em log de aplicação. Logs de agente têm retenção de 90 dias; trilhas, 5 anos.

---

## 8. Dependências

- Verificação de vulnerabilidades a cada release e semanalmente no agendamento.
- Atualização imediata para severidade crítica; janela de 30 dias para alta.
- Sem dependência não mantida ou sem origem verificável.
- `bun.lockb` versionado garante build reprodutível.

---

## 9. Hardening de banco

- RLS habilitada em 100% das tabelas de `public`, com `GRANT` explícito.
- `SECURITY DEFINER` apenas em `has_role`/`has_any_role`, sempre com `SET search_path = public`.
- Trilhas append-only via ausência de política de `UPDATE`/`DELETE`.
- Schemas gerenciados (`auth`, `storage`, `realtime`, `vault`) intocados.
- Linter de banco executado a cada migration; avisos remanescentes justificados por escrito.

---

## 10. Resposta a incidentes de segurança do próprio sistema

1. Registrar como `incidents` com severidade e estágio `identified`.
2. Conter: revogar credencial, desabilitar integração ou agente afetado.
3. Erradicar: corrigir causa e aplicar migration/deploy.
4. Recuperar: revalidar dados e reabilitar serviço.
5. Encerrar: registrar lições em `/system-audit` e atualizar esta documentação.

Incidentes com dado pessoal seguem o rito da LGPD (doc 08).

---

## 11. Checklist antes de publicar

- [ ] Nenhuma tabela nova sem `GRANT` + RLS + política
- [ ] Nenhum segredo no bundle ou no repositório
- [ ] Linter de banco sem erro
- [ ] Testes de integração passando
- [ ] Rotas sensíveis protegidas por papel na UI **e** no banco
- [ ] Bucket de exportação privado e com URL assinada curta
- [ ] Cabeçalhos de segurança aplicados
- [ ] Retenção e purga configuradas
