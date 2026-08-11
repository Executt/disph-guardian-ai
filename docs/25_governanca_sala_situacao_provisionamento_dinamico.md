# 25 — Governança, Sala de Situação e Provisionamento Dinâmico

## 1. Governança

| Instância | Composição | Periodicidade | Decide sobre |
| --- | --- | --- | --- |
| Comitê Gestor | Gestor do contrato, CISO, TI | Mensal | Prioridades, orçamento, riscos aceitos |
| Comitê Técnico | Arquiteto, SRE, SOC | Quinzenal | Arquitetura, roadmap, dívida técnica |
| Sala de Situação | Operação + SOC + fornecedor | Sob demanda (crise) | Contenção e comunicação |
| Auditoria | Auditor independente | Trimestral | Conformidade, trilhas, RLS |

Papéis do sistema (`admin`, `operator`, `auditor`, `viewer`) espelham essa governança e vivem exclusivamente em `user_roles`.

---

## 2. Sala de Situação

Ativada quando: incidente Sev 1, advisory CTIR crítico com exposição confirmada, ou indisponibilidade de coleta > 24 h.

### 2.1 Painel operacional

Fonte única de verdade durante a crise, composto pelas telas existentes:

| Bloco | Origem |
| --- | --- |
| Postura de conformidade | `/security-overview` |
| Funil de estágios (Identificado → Contido → Erradicado → Recuperado → Encerrado) | `incidents.stage` |
| Advisories críticos e ambientes afetados | `/ar` |
| CVEs relevantes | `/vulnerabilities` |
| Saúde de infraestrutura | `/hypervisors` |
| Execuções de agentes e aprovações | `/agents` |
| Auditoria de coleta em tempo real | `/security-overview/ctir-audit` |

### 2.2 Ritual

| Momento | Ação |
| --- | --- |
| T+0 | Ativação, designação do coordenador, abertura de incidente |
| T+15 min | Situação inicial: escopo, ativos, severidade |
| A cada 1 h | Atualização de status nos canais e no ticket |
| Contenção | Registro da ação e do responsável em `agent_executions`/`audit_logs` |
| Encerramento | Relatório de lições aprendidas em `/system-audit` |

Toda decisão da sala vira registro rastreável — nada fica apenas em conversa de canal.

### 2.3 Comunicação

| Público | Canal | Conteúdo |
| --- | --- | --- |
| Operação | Teams | Detalhe técnico e ações |
| Gestão | E-mail + resumo | Impacto, prazo, risco |
| Plantão | WhatsApp | Convocação e escalada |
| Órgão externo / CTIR | Ofício formal | Conforme rito institucional |

---

## 3. Provisionamento dinâmico

Capacidade de criar e ajustar recursos conforme demanda, sem intervenção manual.

### 3.1 O que é provisionado

| Recurso | Gatilho | Mecanismo |
| --- | --- | --- |
| Novo ambiente monitorado | Cadastro em `monitored_environments` | Fan-out automático de avaliações `pending` para todos os advisories vigentes |
| Novo órgão (tenant) | Contrato | Canais, cotas de storage e papéis provisionados por template |
| Agente de hypervisor | Registro do host | Token dedicado emitido, coleta inicia no próximo ciclo |
| Skill de agente | Habilitação no catálogo | Parâmetros padrão aplicados a partir de `skill_catalog_settings` |
| Escala do sidecar | Uso de CPU/fila | HPA no OpenShift, min 2 / max 10 réplicas |
| Watchlist NVD | Nova tecnologia no inventário | Keyword/CPE sugerida para aprovação |

### 3.2 Princípios

1. **Idempotência** — provisionar duas vezes produz o mesmo estado.
2. **Template por perfil** — nada é configurado à mão; cada tipo de recurso tem um molde versionado.
3. **Menor privilégio na origem** — recurso nasce com o mínimo e é ampliado por decisão registrada.
4. **Reversibilidade** — todo provisionamento tem desprovisionamento correspondente e testado.
5. **Rastreabilidade** — criação, alteração e remoção geram evento em `audit_logs`.

### 3.3 Desprovisionamento

| Recurso | Regra |
| --- | --- |
| Ambiente removido | Avaliações preservadas para auditoria; ambiente marcado inativo, nunca apagado |
| Agente descomissionado | Token revogado imediatamente; histórico mantido |
| Usuário desligado | Papéis removidos no ciclo LDAP; trilha preservada |
| Órgão encerrado | Exportação final de trilhas antes do bloqueio de acesso |

Trilha nunca é apagada por desprovisionamento (doc 15).

---

## 4. Gestão de risco

| Risco | Probabilidade | Impacto | Mitigação |
| --- | --- | --- | --- |
| Mudança na estrutura do portal CTIR | Alta | Alto | Fallback HTML + alerta de parse + runbook RB-01 |
| Rate limit da API NVD | Média | Médio | Backoff, coleta incremental, janela diária |
| Agente on-prem indisponível | Média | Alto | Alerta L4, snapshot com marca de idade |
| Escalonamento de privilégio | Baixa | Crítico | Papéis só em `user_roles`, RLS, MFA |
| Vazamento por exportação | Baixa | Alto | Bucket privado, URL de 60 s, isolamento por `auth.uid()` |
| Dependência de fornecedor | Média | Médio | Documentação completa, sem lógica não versionada |

---

## 5. Indicadores de governança

| Indicador | Meta |
| --- | --- |
| Decisões da sala de situação registradas | 100% |
| Ambientes com avaliação em dia | ≥ 95% |
| Provisionamentos por template (sem ajuste manual) | ≥ 90% |
| Achados de auditoria trimestral corrigidos no prazo | 100% |
| Tempo médio de ativação da sala de situação | < 30 min |

---

## 6. Critérios de aceite

- [ ] Ativação da sala tem coordenador, incidente aberto e canal definido
- [ ] Novo ambiente gera avaliações automaticamente
- [ ] Todo provisionamento é idempotente e reversível
- [ ] Desprovisionamento preserva trilha
- [ ] Riscos revisados e registrados a cada comitê
