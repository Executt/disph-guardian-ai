# Checklist de Segurança e Desempenho (Go-Live)

Consolidado a partir da configuração vigente de RLS, autenticação, hardening e requisitos de desempenho. Cada item é verificável — sem evidência, o item não está atendido.

---

## 1. Banco de dados e RLS

- [ ] **Toda** tabela de `public` com `ENABLE ROW LEVEL SECURITY`
- [ ] Toda tabela nova segue a ordem `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY`
- [ ] `GRANT` explícito por papel; `anon` apenas onde existir política para ele
- [ ] Nenhuma política de `UPDATE`/`DELETE` com `USING (true)`
- [ ] Papéis exclusivamente em `public.user_roles` — nunca em `profiles` nem no navegador
- [ ] `has_role` / `has_any_role` como `SECURITY DEFINER` com `SET search_path = public`
- [ ] Trilhas append-only: `audit_logs`, `agent_executions`, `nvd_vulnerability_history` sem `UPDATE`/`DELETE` para `authenticated`
- [ ] Tabelas de telemetria de hypervisor graváveis apenas por `service_role`
- [ ] `export_jobs` e `ai_conversations` restritos a `user_id = auth.uid()`
- [ ] Auditoria CTIR (`sync_alerts`, `ctir_sync_state`) restrita a `admin`, `auditor`, `operator`
- [ ] Linter de banco sem erro; avisos remanescentes justificados por escrito
- [ ] Schemas gerenciados (`auth`, `storage`, `realtime`, `vault`) intocados

---

## 2. Autenticação e sessão

- [ ] Cadastro anônimo desabilitado
- [ ] Confirmação de e-mail habilitada
- [ ] MFA TOTP obrigatória para `admin` e `auditor`
- [ ] JWT de vida curta com renovação automática
- [ ] Redirect de OAuth sempre para `window.location.origin` — nunca rota protegida
- [ ] Bloqueio progressivo após tentativas malsucedidas
- [ ] Papéis do LDAP reconciliados; conta desabilitada perde todos os papéis
- [ ] Logout invalida a sessão local

---

## 3. Autorização na aplicação

- [ ] `ProtectedRoute` cobre todas as rotas sensíveis (incluindo auditoria CTIR)
- [ ] TopNav filtra itens por papel
- [ ] Edge Functions revalidam papel antes de operação sensível
- [ ] Nenhuma decisão de autorização baseada em `localStorage`/`sessionStorage`
- [ ] UI é experiência; o banco é a autoridade final

---

## 4. Edge Functions e APIs

- [ ] `verify_jwt = true` em funções expostas ao usuário (`ar-audit`)
- [ ] Funções de coleta com `verify_jwt = false` protegidas por segredo/agendador
- [ ] Payload validado no servidor; sem confiar no cliente
- [ ] Resposta de erro sem stack trace nem detalhe de infraestrutura
- [ ] `withRetry` com backoff exponencial + jitter nos jobs de coleta
- [ ] Falha definitiva registrada em `sync_alerts` e notificada

---

## 5. Storage e exportações

- [ ] Bucket `ctir-exports` **privado**
- [ ] Caminho obrigatório `<auth.uid()>/<jobId>.<ext>`
- [ ] Políticas comparando `(storage.foldername(name))[1] = auth.uid()::text`
- [ ] Download apenas por URL assinada de **60 s**
- [ ] Cota por órgão (2 GB) e retenção de 7 dias com purga diária
- [ ] Remoção de job apaga o objeto correspondente

---

## 6. Segredos

- [ ] Nenhum segredo no bundle, no repositório ou em log
- [ ] Chave publicável (anon) é o único material sensível admissível no cliente
- [ ] Chave de serviço e senha do banco nunca acessadas, registradas ou retornadas
- [ ] Uma credencial por integração, com menor privilégio
- [ ] Rotação semestral ou imediata em suspeita de vazamento

---

## 7. Entrada de dados

- [ ] Validação com **zod** em todo formulário; servidor revalida
- [ ] Consultas parametrizadas — jamais concatenação de SQL
- [ ] Markdown do assistente de IA sanitizado, sem HTML bruto
- [ ] Upload de usuário: allowlist, magic bytes, limite de tamanho, antimalware (doc 18)
- [ ] Ingestão em lote com staging, validação e circuit breaker de volume (doc 20)

---

## 8. Cabeçalhos e navegador

- [ ] `Content-Security-Policy` aplicada
- [ ] `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] `X-Frame-Options: DENY` / `frame-ancestors 'none'`

---

## 9. Registro e monitoramento

- [ ] Login, logout e falha de MFA em `audit_logs`
- [ ] Alteração de papel ou integração em `audit_logs`
- [ ] Execução de skill risco ≥ 3 em `agent_executions` + `audit_logs`
- [ ] Falha de sincronização em `sync_alerts` + Teams/WhatsApp + ITSM
- [ ] Deduplicação (30 min) e rate limit (5/h) ativos nas notificações
- [ ] **Nenhuma PII** em log de aplicação
- [ ] Retenção: 90 dias para logs de agente; 5 anos para trilhas

---

## 10. Desempenho — frontend

| Métrica | Alvo | Status |
| --- | --- | --- |
| LCP | < 2,5 s | [ ] |
| INP | < 200 ms | [ ] |
| CLS | < 0,1 | [ ] |
| Bundle inicial (gzip) | < 300 KB | [ ] |

- [ ] Rotas com carregamento sob demanda
- [ ] Virtualização por janela ativa em tabelas > 50 linhas
- [ ] Exportação assíncrona em fatias — a UI não trava
- [ ] Filtros, aba, página e rolagem persistidos na URL
- [ ] Skeleton em vez de spinner solto; quatro estados por lista (carregando, vazio, erro, sem permissão)

---

## 11. Desempenho — backend e dados

- [ ] Índice por tempo nas tabelas de série (`created_at DESC`)
- [ ] Toda consulta de série com janela fechada + `LIMIT`
- [ ] `EXPLAIN` sem varredura sequencial em tabela grande no caminho crítico
- [ ] Coleta CTIR com conditional GET (ETag / Last-Modified) e cache hit contabilizado
- [ ] Coleta NVD incremental com cursor e respeito a rate limit
- [ ] Tempo médio de sincronização CTIR < 90 s
- [ ] Purga de séries executando conforme retenção

---

## 12. Acessibilidade

- [ ] WCAG 2.1 AA / eMAG nas telas principais
- [ ] Contraste ≥ 4,5:1 (texto) e ≥ 3:1 (gráfico)
- [ ] Navegação completa por teclado com foco visível
- [ ] `aria-label` em ícone-botão; tabela com marcação semântica
- [ ] Severidade comunicada por texto e ícone, não apenas por cor
- [ ] `prefers-reduced-motion` respeitado; utilizável a 200% de zoom

---

## 13. Pipeline e dependências

- [ ] Lint, typecheck e testes verdes
- [ ] SAST e SCA sem severidade crítica
- [ ] Detector de segredos sem achado
- [ ] Scan de imagem sem severidade crítica
- [ ] SBOM arquivado por release
- [ ] `bun.lockb` versionado (build reprodutível)
- [ ] Atualização imediata para crítico; 30 dias para alto

---

## 14. Continuidade

- [ ] Backup diário com retenção de 35 dias
- [ ] Restauração testada no trimestre, com evidência
- [ ] RTO 4 h / RPO 15 min verificados
- [ ] Rollback ensaiado antes do go-live
- [ ] Runbooks (doc 21) cobrindo 100% dos alertas recorrentes

---

## 15. Assinatura de go-live

| Papel | Nome | Data | Veredito |
| --- | --- | --- | --- |
| Arquiteto | | | |
| Segurança / CISO | | | |
| Operação / SRE | | | |
| Gestor do contrato | | | |

Go-live só é autorizado com **todos** os itens das seções 1 a 9 atendidos e sem pendência de severidade alta nas seções 10 a 14.
