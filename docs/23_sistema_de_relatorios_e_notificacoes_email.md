# 23 — Sistema de Relatórios e Notificações

## 1. Catálogo de relatórios

| Código | Relatório | Conteúdo | Periodicidade | Público |
| --- | --- | --- | --- | --- |
| REL-01 | Postura de conformidade CTIR | Score, avaliações por ambiente e severidade | Semanal | Gestão |
| REL-02 | Auditoria de sincronização | Execuções, falhas, motivos, tempo médio | Diária | Operação |
| REL-03 | Vulnerabilidades NVD | CVEs novos e alterados na watchlist | Diária | SOC |
| REL-04 | Saúde de hypervisores | Hosts, VMs em risco, pontos de falha | Semanal | SRE |
| REL-05 | Execuções de agentes | Skills executadas, risco, aprovações | Mensal | Auditoria |
| REL-06 | Trilha de auditoria | Eventos de `audit_logs` no período | Sob demanda | Auditoria |

Formatos: **CSV** (dados) e **PDF** (evidência assinada visualmente com cabeçalho do órgão, período e filtros aplicados).

---

## 2. Geração

Toda exportação segue o fluxo assíncrono já implementado:

```
UI (filtros + paginação) → enfileira job em export_jobs
   → geração em fatias de 250 linhas (UI permanece responsiva)
   → upload para bucket privado ctir-exports em <auth.uid()>/<jobId>.<ext>
   → URL assinada de 60 s exibida no painel
```

Regras:

- O relatório respeita **exatamente** os filtros e a ordenação da tela de origem.
- Cabeçalho do arquivo registra: período, filtros, total de linhas, data/hora com offset e usuário solicitante.
- Isolamento por `auth.uid()` no storage; nenhum objeto público.
- Cota e retenção conforme doc 17 (2 GB por órgão, 7 dias).
- Falha na geração marca o job como `failed` com motivo legível na UI.

---

## 3. Canais de notificação

| Canal | Uso | Configuração |
| --- | --- | --- |
| Microsoft Teams | Alerta operacional e falha de sync | Webhook por órgão em `agent_channels` |
| WhatsApp | Escalada de severidade alta e plantão | API + token |
| Slack / Discord | Alternativa ao Teams | Webhook |
| Telegram | Canal secundário de agentes | Bot token |
| ITSM (GLPI, Jira, ServiceNow, CITSmart, Zendesk) | Ticket formal | `create-itsm-ticket` |
| E-mail | Relatórios periódicos e resumo | Provedor transacional |

---

## 4. Regras de disparo

| Evento | Canais | Nível |
| --- | --- | --- |
| Sync falhou após backoff | Teams | L2 |
| Duas falhas consecutivas / feed vazio inesperado | Teams + WhatsApp + ticket | L3 |
| Agente sem heartbeat > 30 min | Teams + WhatsApp + ticket + plantão | L4 |
| Advisory crítico novo | Teams + e-mail | L2 |
| CVE crítico na watchlist | Teams + e-mail | L2 |
| Execução de skill risco ≥ 3 | Teams (registro) | L1 |
| Relatório semanal pronto | E-mail | L0 |

### 4.1 Antisspam

- Deduplicação por assinatura (`job` + `feed` + `motivo`) por **30 minutos**.
- Rate limit de **5 mensagens por hora por canal**.
- Mensagem suprimida continua registrada em `sync_alerts`.

---

## 5. Conteúdo da mensagem

Padrão obrigatório:

```
[DISPH-AIOPS] <nível> — <título curto>
Órgão/Ambiente: <nome>
Quando: <data/hora America/Sao_Paulo>
Motivo: <causa raiz legível>
Detalhes: <feed, tentativas, código HTTP>
Ação: <link direto para a tela de auditoria>
```

Proibido em notificação: PII, token, trecho de credencial, stack trace bruto e identificador interno de infraestrutura.

---

## 6. E-mail

| Item | Definição |
| --- | --- |
| Remetente | Domínio institucional verificado (SPF, DKIM, DMARC) |
| Destinatários | Listas por papel, mantidas junto ao mapa LDAP |
| Anexo | Evitado — o e-mail traz link autenticado, não o arquivo |
| Cancelamento | Relatórios opcionais têm preferência por usuário |
| Retenção de envio | Log de entrega por 1 ano, sem corpo da mensagem |

---

## 7. Falhas de entrega

1. Retry com backoff exponencial (3 tentativas).
2. Falha definitiva registra `sync_alerts` de severidade média.
3. Canal com falha persistente é marcado como degradado na tela de agentes.
4. Escalada por canal alternativo quando o primário estiver degradado.

---

## 8. Critérios de aceite

- [ ] Exportação respeita filtros, ordenação e RLS
- [ ] Download apenas por URL assinada curta
- [ ] Dedupe e rate limit ativos e verificáveis
- [ ] Mensagem sem PII e sem segredo
- [ ] Falha de canal gera alerta e escala para o alternativo
- [ ] Log de entrega retido sem corpo da mensagem
