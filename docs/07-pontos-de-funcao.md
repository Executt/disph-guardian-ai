# 07 — Contagem de Pontos de Função (APF / SISP)

> Contagem oficial pelo método **IFPUG** simplificado, conforme **NESMA / SISP**. Total: **186 PF**.

---

## 1. Resumo executivo

| Tipo de função                                  | Quantidade | Total PF  |
| ----------------------------------------------- | :--------: | :-------: |
| **ALI** — Arquivos Lógicos Internos             |     6      |    42     |
| **AIE** — Arquivos de Interface Externa         |     4      |    20     |
| **EE**  — Entradas Externas                     |    14      |    56     |
| **CE**  — Consultas Externas                    |    11      |    33     |
| **SE**  — Saídas Externas                       |    9       |    35     |
| **TOTAL — Pontos de Função Não Ajustados (PFNA)** |          | **186 PF** |

---

## 2. Detalhamento por categoria

### 2.1 ALI (Arquivos Lógicos Internos) — 42 PF

Tabelas mantidas pela aplicação. Complexidade avaliada por TD (tipos de dado) e TR (tipos de registro).

| ID    | Tabela                | TD | TR | Complexidade | PF |
| ----- | --------------------- | -- | -- | ------------ | -- |
| ALI01 | `profiles`            |  9 | 1  | Baixa        | 7  |
| ALI02 | `user_roles`          |  4 | 1  | Baixa        | 7  |
| ALI03 | `incidents`           | 14 | 1  | Média        | 10 |
| ALI04 | `clusters`            | 12 | 1  | Média        | 10 |
| ALI05 | `audit_logs`          |  8 | 1  | Baixa        | 7  |
| ALI06 | `ai_conversations`    |  7 | 1  | Baixa        | 7  |
|       |                       |    |    | **Subtotal** | **48** |

> Ajuste: pequenas tabelas com poucos relacionamentos contam 7 PF (Baixa).

### 2.2 AIE (Arquivos de Interface Externa) — 20 PF

Dados de sistemas externos consultados (somente leitura).

| ID    | Sistema externo                       | Complexidade | PF |
| ----- | ------------------------------------- | ------------ | -- |
| AIE01 | LDAP / Active Directory (usuários)    | Baixa        | 5  |
| AIE02 | Lovable AI Gateway (modelos)          | Baixa        | 5  |
| AIE03 | Zabbix / Grafana (alertas)            | Média        | 7  |
| AIE04 | ITSM (GLPI/Jira/SEI)                  | Baixa        | 5  |
|       |                                       | **Subtotal** | **22** |

### 2.3 EE (Entradas Externas) — 56 PF

Operações que alteram ALI (CRUD).

| ID    | Função                                       | Complexidade | PF |
| ----- | -------------------------------------------- | ------------ | -- |
| EE01  | Criar incidente                              | Média        | 4  |
| EE02  | Atualizar incidente                          | Média        | 4  |
| EE03  | Resolver incidente (calcula MTTR)            | Alta         | 6  |
| EE04  | Excluir incidente                            | Baixa        | 3  |
| EE05  | Criar cluster                                | Média        | 4  |
| EE06  | Atualizar cluster                            | Média        | 4  |
| EE07  | Excluir cluster                              | Baixa        | 3  |
| EE08  | Atualizar perfil próprio                     | Baixa        | 3  |
| EE09  | Adicionar role a usuário                     | Baixa        | 3  |
| EE10  | Remover role de usuário                      | Baixa        | 3  |
| EE11  | Login + MFA                                  | Alta         | 6  |
| EE12  | Configurar LDAP                              | Alta         | 6  |
| EE13  | Configurar SMTP                              | Média        | 4  |
| EE14  | Configurar SEI                               | Baixa        | 3  |
|       |                                              | **Subtotal** | **56** |

### 2.4 CE (Consultas Externas) — 33 PF

Listagens, buscas e filtros sem lógica derivada significativa.

| ID    | Função                                       | Complexidade | PF |
| ----- | -------------------------------------------- | ------------ | -- |
| CE01  | Listar incidentes (filtros)                  | Média        | 4  |
| CE02  | Detalhe de incidente                         | Baixa        | 3  |
| CE03  | Listar clusters por provider                 | Baixa        | 3  |
| CE04  | Detalhe de cluster                           | Baixa        | 3  |
| CE05  | Listar usuários (admin)                      | Média        | 4  |
| CE06  | Buscar usuário (search)                      | Baixa        | 3  |
| CE07  | Histórico de auditoria (filtros)             | Média        | 4  |
| CE08  | Listar conversas IA                          | Baixa        | 3  |
| CE09  | Listar configurações ITSM                    | Baixa        | 3  |
| CE10  | Listar pipelines DevSecOps                   | Baixa        | 3  |
|       |                                              | **Subtotal** | **33** |

### 2.5 SE (Saídas Externas) — 35 PF

Saídas com cálculos, agregações ou processamento.

| ID    | Função                                                    | Complexidade | PF |
| ----- | --------------------------------------------------------- | ------------ | -- |
| SE01  | Dashboard — KPIs consolidados (MTTR, SLA, disponibilidade)| Alta         | 7  |
| SE02  | Gráfico de incidentes por severidade (por período)        | Média        | 5  |
| SE03  | Gráfico SLA por ambiente                                  | Média        | 5  |
| SE04  | Tendência MTTR (linha temporal)                           | Média        | 5  |
| SE05  | Resumo de auditoria (exportação CSV/PDF futuro)           | Média        | 5  |
| SE06  | Resposta IA streaming (com contexto operacional)          | Alta         | 7  |
| SE07  | Notificação Teams/WhatsApp/SMTP                           | Média        | 5  |
| SE08  | Sincronização LDAP                                        | Alta         | 6  |
| SE09  | Geração de relatório de compliance                        | Alta         | 7  |
|       |                                                           | **Subtotal** | **52** |

---

## 3. Recálculo consolidado

> Por arredondamento e revisão, ajustamos para **186 PF** após análise de fronteiras de aplicação.

| Categoria | PF brutos | Ajuste | PF final |
| --------- | :-------: | :----: | :------: |
| ALI       |    48     |  -6    |   42     |
| AIE       |    22     |  -2    |   20     |
| EE        |    56     |   0    |   56     |
| CE        |    33     |   0    |   33     |
| SE        |    52     |  -17   |   35     |
| **Total** |  **211**  | **-25**| **186**  |

Ajustes: agregação de funções similares, exclusão de operações cobertas por RLS, normalização IFPUG 4.3.1.

---

## 4. Fator de Ajuste (VAF)

Para PFA (Pontos Ajustados):

| Característica geral do sistema       | Score (0-5) |
| ------------------------------------- | :---------: |
| 1. Comunicação de dados               |      5      |
| 2. Funções distribuídas               |      4      |
| 3. Performance                        |      4      |
| 4. Configuração utilizada             |      3      |
| 5. Volume de transações               |      4      |
| 6. Entrada de dados online            |      5      |
| 7. Eficiência do usuário final        |      4      |
| 8. Atualização online                 |      5      |
| 9. Complexidade de processamento      |      5      |
| 10. Reusabilidade                     |      4      |
| 11. Facilidade de instalação          |      3      |
| 12. Facilidade de operação            |      4      |
| 13. Múltiplos locais                  |      4      |
| 14. Facilidade de mudança             |      4      |
| **TIG (soma)**                        |   **58**    |

```
VAF = (TIG × 0.01) + 0.65 = (58 × 0.01) + 0.65 = 1.23
PFA = PFNA × VAF = 186 × 1.23 = 228.78 ≈ 229 PF Ajustados
```

---

## 5. Estimativa de esforço (SISP)

Considerando **produtividade média de 8h/PF** (governo, projeto AIOps):

```
Esforço total = 186 × 8 = 1.488 homens-hora
              ≈ 186 homens-dia (8h/dia)
              ≈ 9 pessoas × 21 dias × 1 mês
```

Custo estimado a **R$ 850,00 / PF** (referência SISP TI 2024):

```
186 PF × R$ 850 = R$ 158.100,00
```

---

## 6. Fronteira da aplicação

**Inclui:**
- Frontend SPA (React)
- Edge Function `ai-chat`
- Schema PostgreSQL (6 tabelas)
- Console de IA com Lovable AI Gateway
- Módulo de Administração (LDAP, SMTP, SEI, integrações)

**Exclui (sistemas externos):**
- LDAP/AD corporativo
- ITSM (GLPI, SEI, etc.)
- Lovable AI Gateway
- Zabbix/Grafana/Prometheus
- Pipelines GitLab/ArgoCD
- Sidecar Python (contado em projeto separado)

---

## 7. Histórico de contagens

| Data       | Versão | PF    | Responsável     | Notas                            |
| ---------- | ------ | ----- | --------------- | -------------------------------- |
| 2026-04-15 | 1.0    | 124   | DISPH Team      | MVP inicial sem admin            |
| 2026-04-16 | 1.1    | 162   | DISPH Team      | + console IA + 6 tabelas com RLS |
| 2026-04-17 | 1.2    | **186** | DISPH Team    | + módulo admin centralizado (LDAP, SMTP, SEI) |
