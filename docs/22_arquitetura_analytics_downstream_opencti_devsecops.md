# 22 — Analytics Downstream, OpenCTI e DevSecOps

## 1. Camadas de dados

```
Operacional (PostgreSQL/RLS)  ──▶  Downstream analítico  ──▶  Painéis e relatórios
        │                                   │
        └──▶ OpenCTI (threat intel)         └──▶ SIEM do órgão
```

| Camada | Papel | Latência |
| --- | --- | --- |
| Operacional | Fonte de verdade, RLS, transacional | tempo real |
| Downstream | Agregação, histórico longo, junções pesadas | 15 min – 1 h |
| Apresentação | `/security-overview`, relatórios, exportações | sob demanda |

Regra: **nenhuma consulta analítica pesada roda sobre a base operacional em horário de pico**.

---

## 2. Modelo downstream

Esquema em estrela, materializado por job agendado.

| Objeto | Grão | Origem |
| --- | --- | --- |
| `fato_assessment` | advisory × ambiente × dia | `advisory_environment_assessments` |
| `fato_vulnerabilidade` | CVE × dia | `nvd_vulnerabilities` + histórico |
| `fato_execucao_agente` | execução | `agent_executions` |
| `fato_sync` | execução de job | `sync_alerts` + `ctir_sync_state` |
| `fato_infra` | host/VM × coleta | tabelas de hypervisor |
| `dim_ambiente`, `dim_severidade`, `dim_tempo`, `dim_skill` | dimensões | catálogos |

Materialização incremental por marca temporal; reprocessamento completo apenas em mudança de regra.

### 2.1 Métricas canônicas

| Métrica | Fórmula |
| --- | --- |
| Postura de segurança | `compliant ponderado por severidade / total avaliado` |
| Taxa de falha de sync | `execuções com falha / execuções totais` na janela |
| Tempo médio de sync | média de `duração` das execuções bem-sucedidas |
| MTTR de incidente | média de `closed_at − created_at` |
| Cobertura de avaliação | `avaliações concluídas / (advisories × ambientes)` |

Uma métrica, uma definição — a UI e o relatório usam a mesma fórmula.

---

## 3. Integração com OpenCTI

| Direção | Conteúdo | Mecanismo |
| --- | --- | --- |
| DISPH → OpenCTI | Advisories CTIR, CVEs relevantes, ativos afetados | Conector STIX 2.1 |
| OpenCTI → DISPH | IoC, campanhas, TTPs (ATT&CK) | Coleta horária (doc 20) |

Mapeamento STIX:

| Entidade DISPH | Objeto STIX |
| --- | --- |
| Advisory CTIR | `report` |
| CVE | `vulnerability` |
| Ambiente monitorado | `identity` / `infrastructure` |
| Ponto de falha | `observed-data` |
| Incidente | `incident` |

Restrições: autenticação por token dedicado, respeito ao TLP por objeto, e nenhum dado pessoal exportado para o OpenCTI.

---

## 4. DevSecOps

### 4.1 Pipeline

```
commit → lint + typecheck → testes (Vitest) → SAST → SCA (dependências)
       → build → scan de imagem → assinatura → deploy → smoke test → DAST agendado
```

| Etapa | Ferramenta típica | Critério de bloqueio |
| --- | --- | --- |
| Lint / typecheck | ESLint, TypeScript | qualquer erro |
| Testes | Vitest + Testing Library | qualquer falha |
| SAST | Semgrep / CodeQL | severidade alta |
| SCA | scan de dependências | severidade crítica |
| Segredos | Gitleaks | qualquer achado |
| Imagem | Trivy / Clair | severidade crítica |
| IaC | Checkov | política obrigatória violada |
| DAST | ZAP (agendado) | vulnerabilidade alta confirmada |

### 4.2 Portões de qualidade

- Cobertura de testes não pode cair entre releases.
- Nenhuma migration sem `GRANT` + RLS + política.
- Linter de banco executado a cada migration; aviso remanescente exige justificativa escrita.
- Build reprodutível garantido por `bun.lockb` versionado.

### 4.3 Cadeia de suprimentos

- SBOM (CycloneDX) gerado a cada build e arquivado com o artefato.
- Imagens assinadas; runtime só aceita imagem assinada do registry interno.
- Atualização imediata para severidade crítica; 30 dias para alta.

---

## 5. Governança de dados analíticos

| Regra | Detalhe |
| --- | --- |
| Minimização | Downstream não recebe PII; usuário é referenciado por UUID |
| Anonimização | Relatórios agregam por ambiente e órgão, nunca por pessoa |
| Retenção | 5 anos para fatos de conformidade; 2 anos para operacionais |
| Acesso | Somente `admin` e `auditor`; RLS replicada na camada analítica |
| Rastreabilidade | Toda métrica publicada aponta para a consulta e a versão que a gerou |

---

## 6. Critérios de aceite

- [ ] Métricas do painel e do relatório batem com a mesma fórmula
- [ ] Materialização incremental com marca temporal e reprocessamento controlado
- [ ] Conector OpenCTI autenticado, respeitando TLP, sem PII
- [ ] Pipeline bloqueia em SAST/SCA crítico e em segredo detectado
- [ ] SBOM arquivado por release
- [ ] Camada analítica com acesso restrito a `admin` e `auditor`
