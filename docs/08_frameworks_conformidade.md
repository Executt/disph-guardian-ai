# 08 — Frameworks de Conformidade

## 1. Escopo regulatório

| Norma | Aplicabilidade | Onde aparece no sistema |
| --- | --- | --- |
| **LGPD** (Lei 13.709/2018) | Dados pessoais de servidores e usuários | `profiles`, `audit_logs`, política de retenção |
| **SISP** | Padrões de TI do governo federal | Arquitetura, documentação, contratação |
| **IN GSI/PR nº 1 e correlatas** | Segurança da informação na APF | Módulo AR, tratamento de incidentes |
| **NIST CSF 2.0** | Framework de referência | Mapeamento de módulos abaixo |
| **NIST SP 800-61r2** | Tratamento de incidentes | Funil `incident_stage` |
| **CIS Controls v8** | Controles técnicos | Hardening (doc 13) |
| **ISO/IEC 27001:2022** | SGSI | Trilha de auditoria e políticas |
| **OWASP ASVS / Top 10** | Segurança de aplicação | Doc 13 e checklist de go-live |

---

## 2. Mapeamento NIST CSF 2.0

| Função | Categoria | Implementação no DISPH-AIOPS |
| --- | --- | --- |
| **GOVERN** | Papéis e políticas | `user_roles`, RLS, `/admin`, docs 09 e 13 |
| **IDENTIFY** | Inventário de ativos | `monitored_environments`, `clusters`, `hypervisor_hosts` |
| **IDENTIFY** | Gestão de vulnerabilidades | `nvd_watchlist`, `nvd_vulnerabilities`, `/vulnerabilities` |
| **PROTECT** | Controle de acesso | MFA TOTP, RBAC por papel, RLS |
| **PROTECT** | Conscientização/processo | Recomendações CTIR com plano de remediação |
| **DETECT** | Monitoramento contínuo | Zabbix/Grafana, `/hypervisors`, `sync_alerts` |
| **DETECT** | Análise de eventos | Árvore de causa-raiz, `/security-overview` |
| **RESPOND** | Tratamento | `incidents` com estágios, agentes e skills |
| **RESPOND** | Comunicação | Teams, WhatsApp, ITSM, e-mail (doc 23) |
| **RECOVER** | Restauração | `stage = recovered`, MTTR, backup (doc 03) |

---

## 3. Ciclo NIST SP 800-61 no produto

```text
Identificado → Contido → Erradicado → Recuperado → Encerrado
```

Implementado no enum `incident_stage` e visualizado como funil em `/security-overview`. Cada transição é registrada em `audit_logs` com autor e horário; o tempo entre `identified` e `recovered` alimenta o MTTR.

---

## 4. Conformidade de ambientes frente ao CTIR

A análise cruzada do módulo AR materializa a exigência de tratar alertas oficiais:

| Estado | Significado operacional |
| --- | --- |
| `pending` | Advisory coletado, ainda não avaliado pelo órgão |
| `not_applicable` | Ambiente não usa a tecnologia afetada — exige justificativa em `notes` |
| `non_compliant` | Ambiente afetado sem tratamento |
| `partial` | Mitigação aplicada parcialmente; exige `remediation_plan` |
| `compliant` | Tratado; grava `remediated_at` |

O **Security Posture Score** é a razão entre ativos conformes e ativos avaliáveis, ponderada pela criticidade do ambiente (ver doc 12).

---

## 5. LGPD

| Requisito | Implementação |
| --- | --- |
| Minimização | `profiles` guarda apenas nome, e-mail institucional, departamento e avatar |
| Base legal | Execução de política pública e cumprimento de obrigação legal |
| Finalidade | Operação e auditoria de segurança — sem uso secundário |
| Rastreabilidade | `audit_logs` append-only com autor, ação, recurso, IP e horário |
| Retenção | 5 anos para trilhas; 90 dias para logs de agente |
| Direito do titular | Consulta e correção via `/settings`; exclusão de perfil bloqueada por dever legal de guarda |
| Transferência internacional | Somente metadados públicos (CVE/CTIR); nenhum dado pessoal sai do país |
| Incidente com dados pessoais | Registrado como `incidents` com marcação e comunicação à autoridade conforme prazo legal |

---

## 6. Evidências para auditoria

| Evidência | Fonte |
| --- | --- |
| Quem acessou o quê e quando | `audit_logs` |
| Histórico de mudança de CVE | `nvd_vulnerability_history` |
| Execuções de sincronização e falhas | `ctir_sync_state`, `sync_alerts`, `/security-overview/ctir-audit` |
| Decisões de conformidade por ambiente | `advisory_environment_assessments` |
| Ações automatizadas de agentes | `agent_executions` |
| Achados técnicos e correções | `/system-audit` |
| Exportações realizadas | `export_jobs` |

Todas exportáveis em CSV/PDF com filtros aplicados e download por link assinado de curta duração.

---

## 7. Matriz de responsabilidade (RACI resumida)

| Atividade | Admin | Operador | Auditor | Visualizador |
| --- | --- | --- | --- | --- |
| Cadastrar ambientes | R/A | C | I | I |
| Avaliar advisories | A | R | C | I |
| Tratar incidentes | A | R | I | I |
| Configurar agentes/skills | A | R | I | — |
| Ler trilhas de auditoria | A | I | R | — |
| Configurar integrações e LDAP | R/A | — | I | — |
| Exportar auditoria | A | — | R | — |
