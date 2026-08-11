# Guia de Implantação — OpenShift / OKD / ROSA

## 1. Escopo

Implantação dos componentes privados do DISPH-AIOPS em OpenShift (on-prem/OKD) ou ROSA (AWS). O frontend e as Edge Functions permanecem na nuvem gerenciada do projeto.

| Namespace | Conteúdo |
| --- | --- |
| `disph-app` | Sidecar FastAPI |
| `disph-agents` | Agentes de hypervisor e conectores ITSM |
| `disph-observability` | Coletor de logs e exportadores de métrica |

---

## 2. Pré-requisitos

| Item | Versão / requisito |
| --- | --- |
| OpenShift | 4.14+ (ou OKD equivalente) |
| Operadores | External Secrets, Cert Manager, Logging |
| Registry | Interno, com imagens assinadas |
| Acesso de saída | API da plataforma, NVD, CTIR, ITSM |
| Alcance interno | vCenter (443), hosts Hyper-V (WinRM 5986), LDAPS (636) |

---

## 3. Postura de segurança do cluster

- `SecurityContextConstraints` restrito: `runAsNonRoot: true`, sem `privileged`, sem `hostNetwork`, filesystem raiz somente leitura.
- `NetworkPolicy` `default-deny` em cada namespace; liberação explícita por porta e destino.
- `requests`/`limits` obrigatórios em todo Deployment.
- `imagePullPolicy: Always`, apenas registry interno.
- ResourceQuota e LimitRange por namespace.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: disph-app }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
```

---

## 4. Sidecar FastAPI

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: disph-sidecar, namespace: disph-app }
spec:
  replicas: 2
  template:
    spec:
      serviceAccountName: disph-sidecar
      containers:
        - name: api
          image: registry.interno/disph-sidecar:<sha>
          ports: [{ containerPort: 8000 }]
          envFrom:
            - secretRef: { name: disph-secrets }
            - configMapRef: { name: disph-config }
          resources:
            requests: { cpu: 250m, memory: 512Mi }
            limits:   { cpu: 1,    memory: 2Gi }
          readinessProbe: { httpGet: { path: /health, port: 8000 }, initialDelaySeconds: 10 }
          livenessProbe:  { httpGet: { path: /health, port: 8000 }, periodSeconds: 30 }
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: ["ALL"] }
```

HPA: mínimo 2, máximo 10 réplicas, alvo de 65% de CPU.

Rota interna com TLS por *service serving certificate*; **sem** exposição pública.

---

## 5. Segredos

- Origem: cofre do órgão (Vault) ou AWS Secrets Manager em ROSA.
- Sincronização por **External Secrets Operator** para o Secret `disph-secrets`.
- Configuração não sensível (`DISPH_GUARDRAILS_*`, `DISPH_KEYCLOAK_*`) em ConfigMap.
- Rotação semestral; pods recarregam automaticamente na mudança do Secret.
- Proibido: segredo em ConfigMap, em variável da imagem ou no repositório.

---

## 6. Agentes

- `CronJob` (ou Deployment com laço) no namespace `disph-agents`.
- ServiceAccount própria, sem permissão de cluster.
- Token do agente vindo de Secret sincronizado; nunca em argumento de linha de comando.
- Egress liberado apenas para a Edge Function de ingestão e para o vCenter/Hyper-V.

---

## 7. Observabilidade

```
Pods → Vector/Fluent Bit (DaemonSet) → CloudWatch/OpenSearch → SIEM
                                     └→ S3/objeto WORM (trilhas, 5 anos)
```

- Log JSON estruturado; redação de segredo no coletor; sem PII.
- Métricas expostas em `/metrics` e coletadas pelo Prometheus do cluster.
- Alertas: pod em `CrashLoopBackOff`, readiness falhando, HPA no teto, latência elevada.

---

## 8. Pipeline de deploy

```
commit → lint + typecheck → Vitest → SAST/SCA/segredos/IaC (Checkov)
       → build → scan de imagem → assinatura → push registry interno
       → migrations de banco → rollout OpenShift → smoke test
```

- Estratégia `RollingUpdate` com `maxUnavailable: 0`.
- Rollback: `oc rollout undo deployment/disph-sidecar`.
- Toda migration inclui `GRANT` + RLS + política na mesma transação.
- Linter de banco executado a cada migration.

---

## 9. Continuidade

| Item | Definição |
| --- | --- |
| Distribuição | Pods espalhados por AZ/nó (`topologySpreadConstraints`) |
| PodDisruptionBudget | `minAvailable: 1` |
| Backup | Diário, retenção 35 dias, restauração testada trimestralmente |
| RTO / RPO | 4 h / 15 min |

---

## 10. Checklist de go-live

- [ ] `default-deny` ativo nos três namespaces
- [ ] Nenhum pod privilegiado ou como root
- [ ] Segredos vindos do cofre via External Secrets
- [ ] Probes de readiness e liveness respondendo
- [ ] HPA e PDB configurados
- [ ] Imagem assinada e sem CVE crítico
- [ ] Egress restrito aos destinos declarados
- [ ] Logs chegando ao SIEM e ao armazenamento WORM
- [ ] Agentes enviando heartbeat
- [ ] Rollback ensaiado
