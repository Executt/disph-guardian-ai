# DISPH-AIOPS — Guardian AI

> **Plataforma AIOps governamental para observabilidade, resposta a incidentes e automação SRE multi-cloud.**

[![Stack](https://img.shields.io/badge/stack-React%2018%20%7C%20Vite%205%20%7C%20TS-00B4D8)]() [![Backend](https://img.shields.io/badge/backend-Lovable%20Cloud-10B981)]() [![Compliance](https://img.shields.io/badge/compliance-LGPD%20%7C%20SISP-F59E0B)]() [![Design](https://img.shields.io/badge/UI-Grafana--inspired-EF4444)]()

---

## Visão Geral

O **DISPH-AIOPS** (Disponibilidade, Suporte, Performance e Hospedagem com Inteligência Artificial para Operações) é um produto de observabilidade e automação SRE projetado para órgãos públicos brasileiros. Centraliza:

- 📊 **Dashboard consolidado** de SLA, MTTR e disponibilidade por ambiente
- 🚨 **Gestão de incidentes** com classificação por severidade e remediação assistida por IA
- ☸️ **Inventário multi-cloud** de clusters Kubernetes (EKS, GKE, AKS, OpenShift, Rancher, OKE, CCE, OKD)
- 🤖 **Console de IA** (Lovable AI Gateway) para consultas em linguagem natural sobre dados operacionais
- 🛡️ **DevSecOps** com integração a SonarQube, Quay e ArgoCD
- 👥 **Administração centralizada** com LDAP/AD, SMTP, SEI, MFA e RBAC
- 📑 **Auditoria** completa em conformidade com LGPD e diretrizes SISP

---

## Quick Start

```bash
# 1. Instalar dependências
bun install        # ou: npm install

# 2. Rodar em modo desenvolvimento
bun run dev        # http://localhost:5173

# 3. Build de produção
bun run build
```

> O backend (banco, edge functions, autenticação) é provisionado automaticamente pela **Lovable Cloud** — não há `.env` para configurar manualmente.

### Acesso de teste (mock Keycloak)

| Usuário      | Senha    | Roles                       |
| ------------ | -------- | --------------------------- |
| `admin`      | `admin`  | admin, operator             |
| `operator`   | `op`     | operator                    |
| `auditor`    | `audit`  | auditor, viewer             |

MFA TOTP usa código fixo `123456` em modo demo.

---

## Estrutura do Repositório

```
disph-aiops/
├── docs/                       ← 📚 Toda a documentação técnica
│   ├── 01-padronizacao-visual.md
│   ├── 02-arquitetura.md
│   ├── 03-database-schema.md
│   ├── 04-api-routes.md
│   ├── 05-rls-policies.md
│   ├── 06-seguranca.md
│   ├── 07-pontos-de-funcao.md
│   ├── 08-inventario-funcoes.md
│   ├── 09-regras-de-negocio.md
│   ├── 10-manual-gestao.md
│   └── 11-administracao.md
├── src/
│   ├── components/             ← UI shared + AppLayout, TopNav, AIChatConsole
│   ├── pages/                  ← 7 páginas (Dashboard, Incidents, Infra, DevSecOps, Audit, Admin, Settings)
│   ├── contexts/               ← AuthContext (mock Keycloak + MFA)
│   ├── hooks/                  ← useRealtimeData, use-toast, use-mobile
│   └── integrations/supabase/  ← Cliente auto-gerado (NÃO EDITAR)
├── supabase/
│   ├── functions/ai-chat/      ← Edge Function — proxy para Lovable AI Gateway
│   └── migrations/             ← Schema versionado (6 tabelas + RLS)
└── disph-aiops-backend/        ← Sidecar Python opcional (skills, webhooks)
```

---

## Documentação Técnica

| # | Documento | Resumo |
| - | --- | --- |
| 01 | [Padronização Visual](docs/01-padronizacao-visual.md) | Cores, tipografia, espaçamento, ícones, motion, tokens |
| 02 | [Arquitetura](docs/02-arquitetura.md) | Stack, diretórios, rotas, fluxo de dados |
| 03 | [Database Schema](docs/03-database-schema.md) | 6 tabelas + ER + enums + triggers |
| 04 | [API Routes](docs/04-api-routes.md) | Edge Functions, REST PostgREST, contratos |
| 05 | [RLS Policies](docs/05-rls-policies.md) | Políticas por tabela e por role |
| 06 | [Segurança](docs/06-seguranca.md) | LGPD, SISP, MFA, mTLS, criptografia |
| 07 | [Pontos de Função](docs/07-pontos-de-funcao.md) | Contagem APF/SISP — **186 PF** |
| 08 | [Inventário de Funções](docs/08-inventario-funcoes.md) | 7 páginas, 1 edge, 5 hooks, 40+ componentes |
| 09 | [Regras de Negócio](docs/09-regras-de-negocio.md) | SLA, severidade, escalonamento, MTTR |
| 10 | [Manual de Gestão](docs/10-manual-gestao.md) | Operação diária, backup, troubleshooting |
| 11 | [Administração](docs/11-administracao.md) | LDAP, SMTP, SEI, RBAC, MFA passo a passo |

---

## Stack Técnica

**Frontend:** React 18 · Vite 5 · TypeScript 5 · TailwindCSS 3 · shadcn/ui · TanStack Query · React Router v6 · Recharts · Framer Motion · Lucide Icons

**Backend:** Lovable Cloud (Supabase) · PostgreSQL 15 · Row-Level Security · Deno Edge Functions · Lovable AI Gateway (Google Gemini, OpenAI GPT-5)

**Auth:** Mock Keycloak + TOTP MFA (produção: LDAP/AD via Admin)

**Observabilidade alvo:** Zabbix, Grafana, Prometheus, Loki, Tempo

**ITSM alvo:** GLPI, Jira, ServiceNow, CITSmart, Azure DevOps, **SEI** (Sistema Eletrônico de Informações — gov.br)

**Compliance:** LGPD · SISP · ISO 27001 · NIST CSF

---

## Identidade Visual

Tema **dark cybersecurity**, inspirado na densidade de informação do **Grafana**:

- **Primária:** `#00B4D8` (cyan) — ações, links, gráficos
- **Acento:** `#10B981` (green) — sucesso, status saudável
- **Alerta:** `#F59E0B` (amber) — atenção, MTTR alto
- **Erro:** `#EF4444` (red) — críticos, falhas
- **Tipografia:** Space Grotesk (heading), Inter (body), JetBrains Mono (code)
- **Layout:** Top navigation horizontal (sem sidebar), max-width 1600px, densidade alta

Detalhes completos em [`docs/01-padronizacao-visual.md`](docs/01-padronizacao-visual.md).

---

## Compliance & Segurança

- ✅ **LGPD:** logs de auditoria com IP, ação e responsável; direito ao esquecimento via cascade delete em `profiles`
- ✅ **SISP:** contagem de Pontos de Função documentada (**186 PF**)
- ✅ **MFA:** TOTP obrigatório para roles `admin` e `operator`
- ✅ **RBAC:** roles armazenadas em tabela isolada (`user_roles`) — sem privilege escalation
- ✅ **RLS:** todas as 6 tabelas têm Row-Level Security ativa
- ✅ **TLS:** HTTPS obrigatório; LDAP via LDAPS (porta 636)

Auditoria detalhada em [`docs/06-seguranca.md`](docs/06-seguranca.md).

---

## Contribuindo

Este projeto segue o padrão **Lovable AI**. Edições via:

1. **Lovable Editor** (recomendado): chat na plataforma com IA aplicando mudanças
2. **GitHub direto:** PRs respeitando lint (`bun run lint`) e tipos (`tsc --noEmit`)
3. **Local:** clone → `bun install` → `bun run dev`

---

## Licença

Software desenvolvido para uso governamental brasileiro. Todos os direitos reservados.

---

**URL do projeto:** https://disph-guardian-ai.lovable.app
**Versão:** 1.2.0 — abril/2026
