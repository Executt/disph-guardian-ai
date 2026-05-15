# Módulo de Agentes IA Autônomos

Criar uma nova área `/agents` para cadastrar, parametrizar e operar agentes de IA, cada um com seu perfil (modelo, skills, prompt, guardrails) e canais de interação humana (Teams, WhatsApp, Telegram).

## Escopo

### 1. Banco de dados (Lovable Cloud)
Novas tabelas com RLS (admin/operator escrevem, todos autenticados leem):

- **`agents`** — `name`, `description`, `avatar_url`, `status` (active/paused/draft), `autonomy_level` (manual/supervised/autonomous), `created_by`
- **`agent_profiles`** — `agent_id`, `model` (gemini-2.5-pro / gpt-5 / etc.), `system_prompt`, `temperature`, `max_tokens`, `role_focus` (devsecops/incidents/infra/ar/custom), `risk_threshold` (1-5)
- **`agent_skills`** — `agent_id`, `skill_name` (referencia o registry do backend: ansible, gitlab, k8s, monitoring, itsm, notifications), `enabled`, `parameters` (jsonb)
- **`agent_channels`** — `agent_id`, `channel_type` (teams/whatsapp/telegram), `config` (jsonb: chat_id, channel_id, phone, webhook), `enabled`, `requires_approval`
- **`agent_executions`** — log de execuções: `agent_id`, `triggered_by` (auto/human/channel), `channel_type`, `input`, `output`, `status`, `tokens_used`, `duration_ms`

Enums: `agent_status`, `agent_autonomy`, `agent_channel_type`, `execution_status`.

### 2. Frontend — `/agents`
Adicionar rota protegida (admin/operator) ao `App.tsx` e link no `TopNav`.

**Página `AgentsPage.tsx`** com:
- Grid de cards de agentes (nome, avatar, modelo, autonomia, skills count, status, último uso)
- Botão "Novo Agente" → modal com wizard
- Filtros: status, autonomia, área de atuação

**Página `AgentDetailPage.tsx`** (`/agents/:id`) com tabs:
- **Perfil** — modelo (select com modelos suportados), system prompt, temperatura (slider), tokens, área de atuação, threshold de risco
- **Skills** — lista das 6 categorias do backend (ansible/gitlab/k8s/monitoring/itsm/notifications) com toggle por skill e parâmetros JSON editáveis
- **Canais** — tabela de canais (Teams/WhatsApp/Telegram) com config (chat ID/telefone), toggle requires_approval, botão testar
- **Autonomia** — radio (manual/supervised/autonomous) + regras de aprovação
- **Histórico** — tabela de `agent_executions` com filtros e detalhes

### 3. Edge function `agent-dispatcher`
Endpoint POST que recebe `{ agent_id, input, channel_type, channel_payload }`:
1. Carrega agent + profile + skills + channel config
2. Chama Lovable AI Gateway com modelo configurado, system prompt, e tool definitions geradas das skills habilitadas
3. Se `autonomy_level=autonomous` e risco ≤ threshold → executa direto
4. Se `supervised` ou `requires_approval=true` → posta no canal (Teams/WA/Telegram) e aguarda
5. Registra em `agent_executions`

Para Teams/Telegram usar conectores existentes (gateway). WhatsApp via Twilio (também conector). Detectar se conector está conectado; se não, mostrar CTA na UI de Canais.

### 4. Skills catálogo (frontend)
Hardcoded a partir do `disph-aiops-backend/app/skills/registry.py` (nomes, risk_level, required_role, parameters_schema). Renderizar como checkboxes com formulário dinâmico de parâmetros.

## Detalhes técnicos

- Roles: `admin` cria/edita/exclui; `operator` cria/edita; `viewer/auditor` apenas leem
- Realtime opcional em `agent_executions` para acompanhar logs ao vivo
- UI segue tokens do design system (cyber dark, Space Grotesk/Inter, ícones lucide: Bot, Zap, Workflow, MessageSquare)
- pt-BR em toda a UI
- Conectores (Teams/Telegram/Twilio) só são solicitados quando o usuário ativa o canal correspondente — não bloquear criação do agente

## Fora de escopo (próxima iteração)
- Execução real das skills no backend Python (hoje só registra intenção e aciona o canal)
- Workflow visual / DAG entre agentes
- Treinamento/RAG por agente
- Métricas agregadas (dashboard de custo por agente)

Confirma para eu começar pela migration + UI?