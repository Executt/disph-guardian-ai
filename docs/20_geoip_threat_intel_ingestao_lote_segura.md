# 20 — GeoIP, Threat Intel e Ingestão em Lote Segura

## 1. Fontes

| Fonte | Tipo | Uso | Periodicidade |
| --- | --- | --- | --- |
| CTIR Gov | Advisories oficiais | Base do módulo AR | Diária |
| NVD (NIST 2.0) | CVE/CPE | Correlação de vulnerabilidade | Diária |
| MaxMind GeoLite2 | GeoIP | Enriquecimento de origem de eventos | Semanal |
| MISP / OpenCTI do órgão | IoC (IP, domínio, hash) | Correlação de ameaça | Horária |
| Feeds abertos (abuse.ch e similares) | IoC | Complemento, confiança baixa | Diária |

Toda fonte tem: URL declarada, credencial própria, janela de coleta e estado incremental.

---

## 2. GeoIP

- Base **local** (arquivo MMDB), atualizada semanalmente — nenhuma consulta a serviço externo por evento.
- Resolução ocorre no sidecar, nunca no navegador.
- Campos derivados: `country`, `asn`, `as_org`. **Não** persistimos latitude/longitude de IP de usuário.
- IP de usuário final é tratado como dado pessoal (LGPD): armazenado com truncamento do último octeto (`/24`) para fins estatísticos.
- IP de origem de ataque (não pertencente ao órgão) é preservado integralmente — é evidência de segurança.

---

## 3. Modelo de threat intel

| Campo | Descrição |
| --- | --- |
| `indicator` | Valor do IoC (normalizado, minúsculo) |
| `kind` | `ipv4`, `ipv6`, `domain`, `url`, `sha256`, `md5` |
| `source` | Fonte de origem |
| `confidence` | 0–100 |
| `first_seen` / `last_seen` | Janela de observação |
| `expires_at` | Expiração automática |
| `tags` | Classificação livre (campanha, malware, TTP) |

Chave natural: `(kind, indicator, source)`. Deduplicação por `UPSERT`, mantendo o maior `confidence` e o `last_seen` mais recente.

Expiração: IoC sem reobservação por 90 dias é marcado inativo, nunca apagado silenciosamente.

---

## 4. Ingestão em lote segura

Pipeline em cinco estágios:

```
Download → Validação → Staging → Reconciliação → Publicação
```

| Estágio | Controle |
| --- | --- |
| Download | TLS obrigatório; verificação de checksum/assinatura quando a fonte publica; timeout e limite de tamanho |
| Validação | Schema estrito; linha inválida é descartada e contabilizada, nunca aborta o lote inteiro |
| Staging | Tabela temporária; nada toca a tabela produtiva antes da validação completa |
| Reconciliação | `UPSERT` por chave natural em transação; contagem de inseridos/atualizados/ignorados |
| Publicação | Estado gravado (`etag`, `last_modified`, `cursor`) para retomada incremental |

Salvaguardas:

- **Circuit breaker de volume**: variação acima de ±40% em relação ao lote anterior suspende a publicação e gera alerta para revisão humana.
- **Lote vazio inesperado** é falha, não sucesso.
- Escrita exclusiva por `service_role`; o app nunca insere em tabela de intel.
- Retry com backoff exponencial e jitter; falha definitiva vira `sync_alerts` + notificação.

---

## 5. Segurança da ingestão

| Risco | Mitigação |
| --- | --- |
| Envenenamento de feed | Confiança por fonte; IoC de baixa confiança não dispara ação automática |
| Injeção via conteúdo | Parametrização de SQL; sanitização de string; sem `eval` de payload |
| Zip bomb / payload gigante | Limite de tamanho e razão de compressão (doc 18) |
| SSRF na coleta | Lista de destinos permitidos no egress; sem URL vinda do usuário |
| Falso positivo em massa | Circuit breaker + revisão humana antes de bloquear ativo |

Nenhum IoC gera ação de bloqueio automática em produção sem `confidence ≥ 80` **e** aprovação conforme os guardrails de agente.

---

## 6. Correlação e uso

1. Evento de infraestrutura ou log com IP/domínio → busca no cache de IoC.
2. Casamento positivo enriquece o incidente com fonte, confiança e tags.
3. GeoIP adiciona país e ASN ao contexto.
4. Advisory do CTIR com IoC publicado alimenta a mesma base — o módulo AR e a threat intel compartilham indicadores.
5. Resultado aparece no incidente e no funil de `/security-overview`.

---

## 7. Conformidade

- IP de usuário é dado pessoal → minimização, retenção curta e base legal registrada (LGPD, doc 08).
- Licença da base GeoIP respeitada; redistribuição proibida.
- Compartilhamento de IoC com terceiros segue TLP (`CLEAR`, `GREEN`, `AMBER`, `RED`) declarado por indicador.

---

## 8. Critérios de aceite

- [ ] Toda fonte tem estado incremental e retomada
- [ ] Lote vazio ou com variação anômala não publica
- [ ] Linha inválida é contabilizada sem abortar o lote
- [ ] Escrita apenas por `service_role`
- [ ] IP de usuário truncado; IP de atacante preservado
- [ ] IoC de baixa confiança não dispara ação automática
