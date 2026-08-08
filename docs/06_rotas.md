# 06 — Rotas da Aplicação

Roteamento SPA com `react-router-dom` 6, declarado em `src/App.tsx`. Todas as rotas autenticadas ficam sob o layout `AppLayout` (TopNav + `Outlet` + assistente lateral), envolvido por `ProtectedRoute`.

---

## 1. Tabela de rotas

| Rota | Página | Papéis exigidos | Função |
| --- | --- | --- | --- |
| `/login` | `LoginPage` | público | Autenticação + MFA TOTP |
| `/` | `Index` | autenticado | Dashboard consolidado |
| `/security-overview` | `SecurityOverviewPage` | autenticado | Funil NIST + compliance CTIR |
| `/security-overview/ctir-audit` | `CtirSyncAuditPage` | `admin`, `auditor` | Auditoria de sincronização CTIR |
| `/incidents` | `IncidentsPage` | autenticado | Gestão de incidentes |
| `/ar` | `ARPage` | autenticado | Alertas e Recomendações (CTIR) |
| `/vulnerabilities` | `VulnerabilitiesPage` | autenticado | CVEs da watchlist NVD |
| `/vulnerabilities/:cveId` | `CveDetailPage` | autenticado | Detalhe de CVE, CVSS e histórico |
| `/agents` | `AgentsPage` | `admin`, `operator` | Lista de agentes |
| `/agents/:id` | `AgentDetailPage` | `admin`, `operator` | Perfil, skills, canais, execuções |
| `/agents/status` | `AgentStatusPage` | `admin`, `operator`, `viewer` | Heartbeat e logs do agente on-prem |
| `/skills-catalog` | `SkillsCatalogPage` | `admin`, `operator` | Catálogo global de skills |
| `/devsecops` | `DevSecOpsPage` | `admin`, `operator` | Pipelines e segurança de esteira |
| `/infrastructure` | `InfrastructurePage` | `admin`, `operator` | Inventário multi-cloud |
| `/hypervisors` | `HypervisorsPage` | `admin`, `operator`, `viewer` | VMware/Hyper-V e pontos de falha |
| `/audit` | `AuditPage` | `admin`, `auditor` | Trilha de auditoria (LGPD) |
| `/system-audit` | `SystemAuditPage` | `admin`, `auditor` | Achados técnicos e evidências |
| `/admin` | `AdminPage` | `admin` | LDAP, SMTP, RBAC, integrações |
| `/settings` | `SettingsPage` | `admin` | Preferências e modelos de IA |
| `*` | `NotFound` | público | 404 |

> `/agents/status` é declarada após `/agents/:id`; a correspondência exata de `status` é garantida pela ordenação do router v6 (segmentos estáticos vencem dinâmicos).

---

## 2. Guarda de acesso

```tsx
<ProtectedRoute requiredRoles={["admin", "auditor"]}>
  <CtirSyncAuditPage />
</ProtectedRoute>
```

Comportamento de `src/components/ProtectedRoute.tsx`:

1. Sem sessão e sem MFA pendente → redireciona para `/login`.
2. MFA pendente → redireciona para `/login` (etapa TOTP).
3. Com sessão mas sem papel exigido → renderiza `AccessDenied` (ou `fallback`).
4. Caso contrário → renderiza os filhos.

**Importante:** essa guarda é apenas de experiência de uso. A autoridade real é a RLS do banco (doc 09) — nenhuma rota expõe dado que a política não permita.

---

## 3. Estado na URL

### 3.1 `/security-overview/ctir-audit`

| Parâmetro | Significado | Default |
| --- | --- | --- |
| `tab` | `runs` \| `alerts` \| `tree` | `runs` |
| `year`, `month` | período | `all` |
| `sev` | severidade | `all` |
| `kind` | tipo de falha | `all` |
| `ps` | itens por página (20/50/100/250) | `20` |
| `rp`, `ap` | página de execuções / alertas | `0` |
| `scope` | escopo da exportação (`all`/`page`) | `all` |
| `node` | nó aberto na árvore de causa-raiz | — |
| `run` | execução destacada | — |
| `y` | posição de scroll (debounce 300ms) | `0` |

Qualquer combinação é um deep-link reproduzível: compartilhar a URL restaura aba, filtros, paginação, seleção e scroll.

### 3.2 Outras páginas

| Página | Parâmetros |
| --- | --- |
| `/ar` | `tab` (cross/catalog/coverage/sync/audit), `env`, `severity`, `kind`, `year` |
| `/vulnerabilities` | `q`, `severity`, `watch`, `page` |
| `/hypervisors` | `env`, `platform` |
| `/agents` | `status`, `area`, `q` |
| `/skills-catalog` | `q`, `category`, `risk`, `role` |

---

## 4. Navegação

`TopNav` agrupa as rotas em blocos: **Visão Geral**, **Segurança** (AR, Vulnerabilidades, Security Overview), **Operação** (Incidentes, Infraestrutura, Hypervisores), **Automação** (Agentes, Skills, DevSecOps), **Governança** (Auditoria, Auditoria de Sistema, Admin). Itens sem papel compatível não são renderizados.

---

## 5. Códigos de resposta da SPA

| Situação | Resultado |
| --- | --- |
| Rota inexistente | `NotFound` (404 lógico) |
| Sessão expirada durante navegação | redireciona para `/login` preservando a rota pretendida |
| Papel insuficiente | `AccessDenied` na própria rota (sem vazar dado) |
| Falha de rede em query | estado de erro no componente + toast, com retry manual |
