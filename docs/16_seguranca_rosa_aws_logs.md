# 16 — Segurança em ROSA/OpenShift na AWS e Pipeline de Logs

## 1. Contexto

O frontend e as Edge Functions rodam na nuvem gerenciada do projeto. Os componentes on-prem/privados — sidecar FastAPI, agentes de hypervisor e conectores ITSM — rodam em **ROSA** (Red Hat OpenShift Service on AWS) ou OpenShift/OKD no datacenter do órgão.

---

## 2. Isolamento de rede

| Camada | Definição |
| --- | --- |
| VPC | Privada, sem IGW nas subnets de workload |
| Subnets | `private-app` (sidecar), `private-data` (RDS/cache), `public-lb` apenas para o ingress |
| Saída | NAT Gateway com lista de destinos permitidos (API da plataforma, NVD, CTIR) |
| Entrada | Nenhuma porta aberta para o agente — comunicação é sempre *push* de dentro para fora |
| Endpoints | VPC Endpoints para S3, ECR, Secrets Manager e CloudWatch Logs |

---

## 3. Postura do cluster

- Namespaces dedicados: `disph-app`, `disph-agents`, `disph-observability`.
- `SecurityContextConstraints` restrito: sem `privileged`, sem `hostNetwork`, `runAsNonRoot: true`, filesystem raiz somente leitura.
- `NetworkPolicy` padrão `deny-all` por namespace; liberação explícita por porta e destino.
- Limites de recurso obrigatórios (`requests`/`limits`) em todo Deployment.
- Imagens assinadas e provenientes apenas do registry interno; `imagePullPolicy: Always`.
- Scan de imagem no pipeline; build falha em severidade crítica.

Exemplo de política padrão:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: disph-agents }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
```

---

## 4. Identidade e segredos

| Item | Solução |
| --- | --- |
| Identidade do pod | IRSA (IAM Roles for Service Accounts), sem chave estática |
| Segredos | AWS Secrets Manager sincronizado via External Secrets Operator |
| Token do agente | Segredo dedicado por ambiente, rotação semestral |
| TLS interno | Service serving certificates do OpenShift |
| Rotação | Automática no Secrets Manager; pods recarregam por *reloader* |

Nenhum segredo em ConfigMap, variável de imagem ou repositório.

---

## 5. Pipeline de logs

```
Pods ──▶ Vector/Fluent Bit (DaemonSet)
            ├─▶ CloudWatch Logs (retenção 90d)
            ├─▶ S3 (Object Lock, retenção 5 anos)  ← trilhas e eventos de segurança
            └─▶ SIEM do órgão (Wazuh / OpenSearch)
```

Regras:

1. **Sem PII** em log de aplicação; identificadores usam `user_id` (UUID), nunca e-mail ou CPF.
2. Log estruturado em JSON com `ts`, `level`, `service`, `trace_id`, `event`.
3. Redação automática de padrões sensíveis (token, senha, chave) no coletor.
4. Bucket S3 de trilhas com **Object Lock em modo compliance** — WORM real, complementar ao WORM lógico do doc 15.
5. Criptografia em repouso com KMS (chave gerenciada pelo órgão) e em trânsito com TLS 1.2+.

---

## 6. Correlação com o SIEM

| Evento | Origem | Uso no SIEM |
| --- | --- | --- |
| Falha de sincronização CTIR/NVD | `sync_alerts` + log do job | Regra de indisponibilidade de fonte |
| Execução de skill risco ≥ 3 | `agent_executions` | Detecção de automação anômala |
| Login e falha de MFA | `audit_logs` | Força bruta / conta comprometida |
| Ponto de falha de hypervisor | `hypervisor_failure_points` | Correlação com incidente de infraestrutura |

A árvore de causa-raiz da UI (`SyncCauseTree`) reproduz o mesmo encadeamento exibido no SIEM: execução → feed → erro → alerta.

---

## 7. Continuidade

- Multi-AZ para o control plane e para os nós de workload.
- Backup diário do banco do sidecar com retenção de 35 dias e teste de restauração trimestral.
- RTO alvo 4 h, RPO alvo 15 min para o sidecar; a nuvem do projeto tem SLA próprio.
- Runbooks de failover em `21_guia_sustentacao_operacao.md`.

---

## 8. Checklist de implantação segura

- [ ] `deny-all` ativo em todos os namespaces
- [ ] Nenhum pod privilegiado ou como root
- [ ] IRSA em uso, sem chave IAM estática
- [ ] Bucket de trilha com Object Lock e KMS
- [ ] Redação de segredos validada no coletor
- [ ] Scan de imagem sem severidade crítica
- [ ] Egress restrito a destinos declarados
