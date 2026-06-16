# DISPH Guardian AI — Roadmap (pós-auditoria Jun/2026)

## Concluído nesta auditoria
- [x] Fix bug: `/audit` aceita role `auditor`.
- [x] Removido `src/components/AppSidebar.tsx` (dead code).
- [x] Removido `Toaster` duplicado em `App.tsx` (mantido Sonner).
- [x] Criado `src/lib/aiModels.ts` como fonte única de modelos.
- [x] `AIChatConsole`, `SettingsPage`, `AdminPage`, `AgentsPage`, `AgentDetailPage` importam de `aiModels`.
- [x] `agentSkills.ts` renomeado para padrão backend; adicionadas 7 skills BE-only.
- [x] `console.error` → `toast.error` em `AIChatConsole`.
- [x] Docs 02, 03, 04, 08, 09, 11 atualizados.

## Top 8 Evoluções (backlog priorizado)

| # | Item | Esforço | Impacto |
|---|---|---|---|
| 1 | **Confirm dialog** para skills com `riskLevel ≥ 4` antes da execução | S | Alto (segurança) |
| 2 | **TypeScript types** do sidecar Python (gerar `.d.ts` a partir do `/skills` endpoint) | M | Médio |
| 3 | **UI para `advisory_environment_assessments`** — exibir aplicabilidade de cada AR | M | Alto (CTIR) |
| 4 | **Implementar SEI** (skills `open_sei_processo`, `assina_sei`) — atualmente roadmap | L | Médio (gov) |
| 5 | **Implementar Freshservice e Azure DevOps** de verdade (skeletons existem) | M | Médio |
| 6 | **Audit log do agente** — visualização gráfica das `agent_executions` (timeline, custo) | M | Alto (governança) |
| 7 | **Cost tracker** por modelo LLM (campos em `ai_conversations` + dashboard) | M | Médio |
| 8 | **Sincronização automática** do registry backend ↔ `agentSkills.ts` (script CI) | S | Médio (manutenção) |
| 9 | ~~**Coletor real de hypervisores**~~ ✅ **Concluído v1.5.0** — agente `hypervisor_agent.py` (pyVmomi/pywinrm) + edge functions `hypervisor-ingest`/`hypervisor-collect` + tabelas `hypervisor_hosts/vms/failure_points` com RLS e Realtime | L | Alto (observabilidade) |
| 10 | Enriquecer coletor: datastores, snapshots antigos, ballooning, certificados vCenter | M | Médio |

## Fora de escopo / decisões registradas
- Snake_case do backend Python mantido; mapeamento por nome no frontend.
- Skills BE seguem padrão `{categoria}_{ação}`; FE alinhado.
