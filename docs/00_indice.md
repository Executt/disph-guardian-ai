# 00 — Índice da Documentação DISPH-AIOPS

Plataforma AIOps para ambientes de missão crítica — Setor Público Brasileiro.

| Versão | Data | Escopo |
| --- | --- | --- |
| 3.0 | 2026-08-08 | Reestruturação completa da documentação (30 documentos) |

---

## 1. Como usar esta documentação

| Perfil | Comece por |
| --- | --- |
| Gestor / Fiscal de contrato | 00, 10, 12, 21 |
| Arquiteto / Tech Lead | 02, 03, 04, 05, 07, 22 |
| Desenvolvedor frontend | 01, 06, 24 |
| DBA / Engenheiro de dados | 03, 04, 05, 15 |
| Segurança / SOC | 08, 09, 13, 16, 18, 20 |
| SRE / Operação | 19, 21, 25, aws_deployment_guide, openshift_deployment_guide |

---

## 2. Mapa dos documentos

| # | Arquivo | Conteúdo |
| --- | --- | --- |
| 00 | `00_indice.md` | Este índice, glossário e convenções |
| 01 | `01_padronizacao_visual.md` | Design system, tokens, tipografia, componentes |
| 02 | `02_arquitetura.md` | C4, stack, estrutura de diretórios, fluxos |
| 03 | `03_banco_de_dados.md` | Estratégia de dados, extensões, jobs, migrations |
| 04 | `04_schema_do_banco.md` | Dicionário de dados tabela a tabela |
| 05 | `05_diagrama_er.md` | Diagrama ER e cardinalidades |
| 06 | `06_rotas.md` | Rotas SPA, guards por papel, parâmetros de URL |
| 07 | `07_apis_e_integracoes.md` | Edge Functions, PostgREST, sidecar FastAPI, conectores |
| 08 | `08_frameworks_conformidade.md` | LGPD, SISP, NIST CSF/800-61, CIS, ISO 27001 |
| 09 | `09_politicas_seguranca.md` | RLS, papéis, RBAC, políticas por tabela |
| 10 | `10_pontos_de_funcao.md` | Contagem APF (IFPUG) e estimativa |
| 11 | `11_inventario_funcoes.md` | Inventário de páginas, hooks, libs e funções |
| 12 | `12_regras_de_negocio.md` | RN-001..RN-0xx com fórmulas e critérios |
| 13 | `13_seguranca_hardening.md` | Hardening de app, banco, edge e navegador |
| 14 | `14_configuracao_ldap.md` | Integração LDAP/AD e mapeamento de papéis |
| 15 | `15_series_temporais_imutabilidade.md` | Séries temporais, retenção, WORM e trilha imutável |
| 16 | `16_seguranca_rosa_aws_logs.md` | ROSA/OpenShift na AWS e pipeline de logs |
| 17 | `17_zeroops_alertas_storage_por_orgao.md` | ZeroOps, multi-órgão, cotas de storage |
| 18 | `18_inspecao_antimalware_bloqueio_extensoes.md` | Antimalware em uploads e bloqueio de extensões |
| 19 | `19_simulacao_processo_end_to_end_producao.md` | Simulação E2E de um incidente em produção |
| 20 | `20_geoip_threat_intel_ingestao_lote_segura.md` | GeoIP, threat intel e ingestão em lote |
| 21 | `21_guia_sustentacao_operacao.md` | Runbooks, SLA, plantão, troubleshooting |
| 22 | `22_arquitetura_analytics_downstream_opencti_devsecops.md` | Analytics downstream, OpenCTI, DevSecOps |
| 23 | `23_sistema_de_relatorios_e_notificacoes_email.md` | Relatórios, e-mail, Teams, WhatsApp |
| 24 | `24_especificacao_frontend_gov_fiori.md` | Padrões Gov.br / Fiori aplicados ao frontend |
| 25 | `25_governanca_sala_situacao_provisionamento_dinamico.md` | Sala de situação e provisionamento dinâmico |
| — | `aws_deployment_guide.md` | Implantação em AWS |
| — | `openshift_deployment_guide.md` | Implantação em OpenShift/OKD |
| — | `security_and_performance_checklist.md` | Checklist de go-live |

---

## 3. Glossário

| Termo | Significado |
| --- | --- |
| **AR** | Alertas e Recomendações (CTIR Gov) |
| **CTIR Gov** | Centro de Tratamento e Resposta a Incidentes Cibernéticos de Governo |
| **NVD** | National Vulnerability Database (NIST) |
| **CVE / CPE** | Identificador de vulnerabilidade / de produto |
| **Advisory** | Alerta ou recomendação publicada por uma fonte oficial |
| **Assessment** | Avaliação de conformidade de um ambiente frente a um advisory |
| **Agente** | Perfil de automação (modelo + skills + canais + autonomia) |
| **Skill** | Ação executável por um agente (Ansible, K8s, ITSM, notificação) |
| **Sidecar** | Backend Python FastAPI opcional, on-prem |
| **Edge Function** | Função Deno serverless hospedada na nuvem do projeto |
| **RLS** | Row Level Security do PostgreSQL |
| **MTTR** | Mean Time To Repair |

---

## 4. Convenções

- Idioma da UI e da documentação: **pt-BR**.
- Datas: ISO-8601 (`YYYY-MM-DD`), fusos em UTC no banco, exibição em `America/Sao_Paulo`.
- Identificadores de banco em `snake_case`; componentes React em `PascalCase`; hooks em `camelCase` com prefixo `use`.
- Toda tabela nova em `public` exige: `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY`.
- Nenhuma cor literal em componentes: apenas tokens semânticos definidos em `src/index.css`.
- Especificação antes de código: todo PR inicia por um plano de até 15 linhas aprovado.
