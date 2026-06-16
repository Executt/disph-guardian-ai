# Agente coletor de hypervisores

Coleta métricas de **VMware vSphere** (via pyVmomi) e **Microsoft Hyper-V** (via pywinrm) em ambiente on-prem e publica no edge function `hypervisor-ingest`.

## Variáveis de ambiente

| Variável | Obrigatório | Descrição |
|---|---|---|
| `SUPABASE_FUNCTIONS_URL` | sim | URL base das edge functions (`https://<ref>.functions.supabase.co`) |
| `HYPERVISOR_AGENT_TOKEN` | sim | Mesmo valor configurado no Lovable Cloud |
| `INTERVAL_SECONDS` | não (60) | Periodicidade do loop |
| `ENVIRONMENT_ID` | não | UUID em `monitored_environments` para vincular hosts |
| `VSPHERE_HOST` / `VSPHERE_USER` / `VSPHERE_PASS` | opcional | Coleta vSphere |
| `HYPERV_HOSTS` (CSV) / `HYPERV_USER` / `HYPERV_PASS` | opcional | Coleta Hyper-V via WinRM/NTLM |

## Instalação

```bash
pip install pyvmomi pywinrm
python -m agents.hypervisor_agent
```

Recomenda-se executar como serviço (systemd) próximo aos hypervisores. O agente nunca expõe credenciais — apenas POSTs assinados com `x-agent-token`.
