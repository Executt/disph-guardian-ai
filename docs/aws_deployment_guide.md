# Guia de Implantação — AWS

## 1. Escopo

Este guia cobre a implantação dos componentes **privados** do DISPH-AIOPS na AWS: sidecar FastAPI, agentes de hypervisor e pipeline de logs. O frontend (SPA) e as Edge Functions são publicados pela nuvem gerenciada do projeto e não exigem infraestrutura AWS.

| Componente | Onde roda |
| --- | --- |
| SPA React/Vite | Nuvem gerenciada do projeto (CDN) |
| Edge Functions (8) | Nuvem gerenciada do projeto |
| Banco PostgreSQL + storage | Nuvem gerenciada do projeto |
| Sidecar FastAPI | AWS (ECS Fargate ou ROSA) |
| Agente de hypervisor | On-prem ou EC2 próximo ao vCenter |
| Pipeline de logs | CloudWatch + S3 + SIEM |

---

## 2. Rede

| Recurso | Configuração |
| --- | --- |
| VPC | `/16`, 3 AZs |
| Subnets privadas | `private-app`, `private-data` (sem rota para IGW) |
| Subnets públicas | Apenas ALB e NAT Gateway |
| NAT Gateway | Um por AZ; egress restrito por lista de destinos |
| VPC Endpoints | S3, ECR, Secrets Manager, CloudWatch Logs, KMS |
| Security Groups | Menor privilégio; sem `0.0.0.0/0` de entrada em workload |

O agente **não** expõe porta: toda comunicação é *push* de dentro para fora.

---

## 3. Sidecar FastAPI

### 3.1 ECS Fargate

```
Cluster: disph-aiops
Service: disph-sidecar
  Task CPU/Mem: 1 vCPU / 2 GB
  Desired count: 2   (min 2, max 10)
  Autoscaling: CPU > 65% por 3 min
  Subnets: private-app
  ALB: interno, HTTPS, health check GET /health
```

### 3.2 Variáveis (prefixo `DISPH_`)

| Variável | Origem |
| --- | --- |
| `DISPH_DATABASE_URL` | Secrets Manager |
| `DISPH_LLM_PROVIDER` / `DISPH_LLM_BASE_URL` / `DISPH_LLM_API_KEY` | Secrets Manager |
| `DISPH_GUARDRAILS_*` | Parameter Store (não sensível) |
| `DISPH_TEAMS_WEBHOOK_URL`, `DISPH_WHATSAPP_*` | Secrets Manager |
| `DISPH_GLPI_*`, `DISPH_JIRA_*`, `DISPH_SERVICENOW_*`, `DISPH_CITSMART_*` | Secrets Manager |
| `DISPH_KEYCLOAK_*` | Parameter Store |

Nenhum segredo em imagem, task definition em texto claro ou repositório. Identidade por **IAM Role da Task** — sem chave estática.

### 3.3 Imagem

```
ECR: <conta>.dkr.ecr.<regiao>.amazonaws.com/disph-sidecar:<sha>
Scan on push habilitado; deploy bloqueado em severidade crítica.
Imagem assinada; runtime aceita apenas o registry interno.
```

---

## 4. Agente de hypervisor

- Executado em host on-prem com alcance ao vCenter (pyVmomi) e aos hosts Hyper-V (pywinrm).
- Token dedicado por ambiente, guardado no cofre local; rotação semestral.
- Envia telemetria, heartbeat e log para a Edge Function `hypervisor-ingest` via HTTPS.
- Intervalo de coleta configurável; falha de envio faz retry com backoff e mantém buffer local limitado.
- Ausência de heartbeat por 30 min gera alerta L4 (doc 17).

---

## 5. Dados e storage

| Recurso | Uso | Proteção |
| --- | --- | --- |
| S3 `disph-logs` | Logs de aplicação | KMS, lifecycle 90 dias |
| S3 `disph-audit` | Trilhas de longo prazo | **Object Lock (compliance)**, KMS, 5 anos |
| S3 `disph-backup` | Backup do sidecar | Versionamento, replicação cross-region |
| Secrets Manager | Todos os segredos | Rotação automática |
| KMS | Chaves gerenciadas pelo órgão | Rotação anual |

---

## 6. Observabilidade

```
Tasks/Pods → Fluent Bit → CloudWatch Logs → (subscription) → S3 + SIEM
```

- Log estruturado em JSON: `ts`, `level`, `service`, `trace_id`, `event`.
- Redação de padrões sensíveis no coletor; **sem PII**.
- Alarmes CloudWatch: erro 5xx do ALB, CPU sustentada, fila de tarefas, falha de health check.
- Métricas de negócio (sync, postura) vivem no banco e aparecem na UI — não duplicar no CloudWatch.

---

## 7. Pipeline de deploy

```
commit → lint + typecheck → Vitest → SAST/SCA/segredos
       → build da imagem → scan (Trivy) → push ECR → assinatura
       → deploy ECS (rolling, 50% mínimo saudável) → smoke test → promoção
```

- Migrations de banco aplicadas antes do deploy da aplicação, sempre com `GRANT` + RLS + política.
- Plano de retorno declarado; rollback por revisão anterior da task definition.
- Deploy em janela programada, exceto correção Sev 1.

---

## 8. Custos e capacidade

| Item | Dimensionamento inicial |
| --- | --- |
| Sidecar | 2 tarefas de 1 vCPU / 2 GB |
| NAT Gateway | 1 por AZ (maior item de custo — revisar por endpoints) |
| S3 auditoria | Crescimento estimado de 5 GB/mês |
| CloudWatch | Retenção 90 dias, filtro de log de baixo valor |

---

## 9. Checklist de go-live

- [ ] Nenhuma subnet de workload com rota para IGW
- [ ] IAM Role da Task em uso; nenhuma chave estática
- [ ] Todos os segredos no Secrets Manager
- [ ] Bucket de auditoria com Object Lock e KMS
- [ ] Scan de imagem sem severidade crítica
- [ ] Health check e autoscaling validados
- [ ] Alarmes configurados e testados
- [ ] Backup e restauração testados
- [ ] Agente enviando heartbeat e telemetria
- [ ] Rollback ensaiado
