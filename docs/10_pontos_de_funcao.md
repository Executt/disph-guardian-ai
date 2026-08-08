# 10 — Pontos de Função

Contagem pelo padrão **IFPUG CPM 4.3.1**, referente à versão auditada de junho/2026.

---

## 1. Fronteira da aplicação

Dentro da fronteira: SPA React, banco PostgreSQL gerenciado, Edge Functions e bucket de exportação.
Fora da fronteira: CTIR Gov, NVD, Zabbix/Grafana, GitLab/ArgoCD, ITSM, LDAP/AD, Teams/WhatsApp, vSphere/Hyper-V, AI Gateway.

---

## 2. Arquivos Lógicos Internos (ALI)

| ALI | DER (aprox.) | RLR | Complexidade | PF |
| --- | --- | --- | --- | --- |
| Advisories CTIR | 16 | 1 | Baixa | 7 |
| Ambientes monitorados | 11 | 1 | Baixa | 7 |
| Avaliações de conformidade | 13 | 1 | Baixa | 7 |
| Estado de sincronização | 10 | 1 | Baixa | 7 |
| Watchlist NVD | 9 | 1 | Baixa | 7 |
| Vulnerabilidades NVD | 13 | 2 | Média | 10 |
| Histórico de vulnerabilidades | 6 | 1 | Baixa | 7 |
| Incidentes | 15 | 1 | Baixa | 7 |
| Clusters | 12 | 1 | Baixa | 7 |
| Hosts/VMs/pontos de falha | 30 | 3 | Média | 10 |
| Status e logs do agente | 22 | 2 | Média | 10 |
| Agentes (agent + profile + skills + channels) | 45 | 4 | Alta | 15 |
| Execuções de agentes | 14 | 1 | Baixa | 7 |
| Catálogo de skills | 9 | 1 | Baixa | 7 |
| Perfis e papéis | 14 | 2 | Baixa | 7 |
| Trilha de auditoria | 8 | 1 | Baixa | 7 |
| Alertas de sincronização | 11 | 1 | Baixa | 7 |
| Jobs de exportação | 17 | 1 | Baixa | 7 |
| Conversas de IA | 7 | 1 | Baixa | 7 |
| **Subtotal ALI** | | | | **160** |

---

## 3. Arquivos de Interface Externa (AIE)

| AIE | Complexidade | PF |
| --- | --- | --- |
| Feeds CTIR (RSS + HTML institucional) | Baixa | 5 |
| API NVD 2.0 | Média | 7 |
| Observabilidade (Zabbix/Grafana/Prometheus) | Baixa | 5 |
| Esteira (GitLab/ArgoCD/SonarQube) | Baixa | 5 |
| ITSM (GLPI/Jira/ServiceNow/demais) | Média | 7 |
| Diretório LDAP/AD | Baixa | 5 |
| vSphere / Hyper-V | Média | 7 |
| AI Gateway | Baixa | 5 |
| **Subtotal AIE** | | **46** |

---

## 4. Entradas Externas (EE)

| EE | Complexidade | PF |
| --- | --- | --- |
| Login + validação MFA | Média | 4 |
| CRUD de ambiente monitorado (3 funções) | Baixa | 9 |
| Avaliar/atualizar conformidade de advisory | Média | 4 |
| Criar/editar/encerrar incidente (3) | Média | 12 |
| Avançar estágio do incidente | Baixa | 3 |
| CRUD de cluster (3) | Baixa | 9 |
| CRUD de watchlist NVD (3) | Média | 12 |
| CRUD de agente (3) | Média | 12 |
| Editar perfil do agente | Média | 4 |
| Habilitar/parametrizar skill do agente | Média | 4 |
| Configurar canal (Teams/WhatsApp/Telegram) | Média | 4 |
| Executar agente manualmente | Média | 4 |
| Aprovar execução pendente | Baixa | 3 |
| Salvar catálogo global de skills (lote) | Média | 4 |
| Disparar sync CTIR (normal e forçado) | Baixa | 6 |
| Disparar coleta de hypervisor | Baixa | 3 |
| Ingestão do agente on-prem | Alta | 6 |
| Enfileirar job de exportação | Média | 4 |
| Remover job de exportação | Baixa | 3 |
| Editar preferências do usuário | Baixa | 3 |
| Configurar integrações no Admin | Alta | 6 |
| Enviar mensagem ao assistente de IA | Média | 4 |
| **Subtotal EE** | | **123** |

---

## 5. Saídas Externas (SE)

| SE | Complexidade | PF |
| --- | --- | --- |
| Dashboard consolidado | Alta | 7 |
| Security Posture Score | Média | 5 |
| Funil de estágios NIST | Média | 5 |
| Medidor circular de conformidade CTIR | Média | 5 |
| KPIs de auditoria CTIR (tempo médio, taxa de falha) | Alta | 7 |
| Gráfico de severidade por período | Média | 5 |
| Distribuição de motivos de falha | Média | 5 |
| Árvore de causa-raiz | Alta | 7 |
| Cobertura por ambiente | Média | 5 |
| Painel de saúde de hypervisores | Alta | 7 |
| Status/heartbeat do agente | Média | 5 |
| Exportação CSV da auditoria | Média | 5 |
| Exportação PDF da auditoria | Alta | 7 |
| Notificação Teams/WhatsApp de falha | Média | 5 |
| Abertura automática de chamado ITSM | Média | 5 |
| Resposta do assistente de IA (streaming) | Alta | 7 |
| **Subtotal SE** | | **92** |

---

## 6. Consultas Externas (CE)

| CE | Complexidade | PF |
| --- | --- | --- |
| Listar advisories com filtros | Média | 4 |
| Detalhar advisory | Baixa | 3 |
| Listar avaliações por ambiente | Média | 4 |
| Listar CVEs com busca e filtros | Média | 4 |
| Detalhar CVE (CVSS, refs, histórico) | Alta | 6 |
| Listar incidentes com filtros | Média | 4 |
| Listar clusters | Baixa | 3 |
| Listar hosts e VMs | Média | 4 |
| Listar logs do agente | Média | 4 |
| Listar agentes e execuções | Média | 4 |
| Buscar skills no catálogo | Média | 4 |
| Consultar trilha de auditoria | Média | 4 |
| Consultar auditoria de ordenação (`ar-audit`) | Alta | 6 |
| Listar execuções de sincronização | Média | 4 |
| Listar alertas de sincronização | Média | 4 |
| Buscar nós na árvore de causa-raiz | Média | 4 |
| Listar jobs de exportação | Baixa | 3 |
| Consultar status de sincronização por feed | Média | 4 |
| **Subtotal CE** | | **73** |

---

## 7. Totalização

| Tipo | PF |
| --- | --- |
| ALI | 160 |
| AIE | 46 |
| EE | 123 |
| SE | 92 |
| CE | 73 |
| **PF não ajustados** | **494** |

### 7.1 Fator de ajuste (VAF)

Características gerais relevantes: comunicação de dados (5), processamento distribuído (4), desempenho (4), configuração intensa (3), volume de transações (4), entrada online (5), eficiência do usuário final (4), atualização online (4), processamento complexo (4), reusabilidade (4), facilidade de instalação (3), facilidade operacional (4), múltiplos locais (3), facilidade de mudança (4).

`NIT = 55` → `VAF = 0,65 + (0,01 × 55) = 1,20`

**PF ajustados = 494 × 1,20 ≈ 593 PF**

---

## 8. Observações

- A contagem exclui itens de roadmap (SEI, SAML/OIDC, analytics downstream).
- Componentes de UI reutilizáveis não geram PF isoladamente; contam pela função de negócio que servem.
- Recontagem obrigatória a cada release que adicione tabela, Edge Function ou rota.
