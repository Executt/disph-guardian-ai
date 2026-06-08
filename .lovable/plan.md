## Análise — principais achados

- **AI_MODELS triplicado** (`AIChatConsole.tsx`, `agentSkills.ts`, hardcode em `AdminPage.tsx`) com chaves e listas divergentes.
- **`AppSidebar.tsx`** é dead code; **dois `<Toaster>`** montados em `App.tsx`.
- **Skills FE↔BE com nomes divergentes** (`run_playbook` vs `trigger_ansible_playbook`, `scale_deployment` vs `k8s_scale_deployment`, etc.).
- **Bug funcional**: rota `/audit` exclui role `auditor` (só admin).
- **Docs desatualizados**: 10 tabelas não documentadas em `03-database-schema.md`; rotas `/ar`, `/agents`, `/agents/:id`, `/skills-catalog` ausentes em `02` e `08`; SEI mencionado mas não implementado.

## Plano (ordem de execução, baixo risco → maior impacto)

1. **Fix bug**: `App.tsx` → `/audit` aceita `["admin","auditor"]`.
2. **Deletar dead code**: `src/components/AppSidebar.tsx`.
3. **Remover Toaster duplicado**: manter apenas Sonner em `App.tsx`.
4. **Fonte única de modelos**: criar `src/lib/aiModels.ts` (type `AIModel { id, label, description, tier }`); re-exportar em `agentSkills.ts` para compat; `AIChatConsole.tsx`, `SettingsPage.tsx`, `AdminPage.tsx`, `AgentsPage.tsx`, `AgentDetailPage.tsx` passam a importar daí.
5. **Padronizar nomes de skills** no `agentSkills.ts` para o padrão do backend (`trigger_ansible_playbook`, `k8s_scale_deployment`, `k8s_rollout_restart`, `create_gitlab_mr`, `trigger_gitlab_pipeline`) e adicionar as skills BE-only faltantes (`ansible_restart_service`, `k8s_cordon_node`, `query_zabbix`, `notify_teams_deploy`, `notify_teams_guardrail`, `notify_multi_channel`).
6. **`console.error` → `toast.error`** em `AIChatConsole.tsx`.
7. **Atualizar docs**: `02-arquitetura.md` (rotas + roles + SEI como roadmap), `03-database-schema.md` (10 tabelas faltantes), `04-api-routes.md` (modelos + edge functions), `08-inventario-funcoes.md` (12 páginas + remoção `AppSidebar`), `09-regras-de-negocio.md` (SEI roadmap, skills ITSM alinhadas), `11-administracao.md` (SEI roadmap, lista de modelos).
8. **Roadmap em `.lovable/plan.md`**: Top 8 evoluções como backlog priorizado.

## Fora de escopo (registrado como roadmap)

- Renomear chaves do backend Python para camelCase TS (mantemos mapeamento por nome).
- Implementar SEI / Freshservice / Azure DevOps de verdade (skeletons já existem).
- Confirmar/dialog UX para skills riskLevel ≥4 (separado, requer design).
- Expor `advisory_environment_assessments` na UI.

Pronto para executar?