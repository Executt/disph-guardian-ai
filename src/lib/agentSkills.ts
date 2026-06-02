// Catálogo de skills disponíveis para os agentes IA.
// Espelha o registry do backend (disph-aiops-backend/app/skills/registry.py).

export type SkillCategory =
  | "ansible"
  | "gitlab"
  | "kubernetes"
  | "monitoring"
  | "itsm"
  | "notifications";

export interface SkillDefinition {
  name: string;
  category: SkillCategory;
  description: string;
  riskLevel: 1 | 2 | 3 | 4 | 5;
  requiredRole: "viewer" | "operator" | "admin";
  parameters: Record<string, { type: string; description: string; default?: unknown }>;
}

export const SKILL_CATEGORIES: { id: SkillCategory; label: string; description: string }[] = [
  { id: "ansible", label: "Ansible", description: "Execução de playbooks de remediação" },
  { id: "gitlab", label: "GitLab", description: "Pipelines, MRs e issues" },
  { id: "kubernetes", label: "Kubernetes", description: "Operações em clusters K8s" },
  { id: "monitoring", label: "Monitoramento", description: "Consultas a Prometheus, Grafana, Zabbix" },
  { id: "itsm", label: "ITSM", description: "Tickets, mudanças em GLPI/Jira/ServiceNow/CITSmart/Freshservice/Azure DevOps" },
  { id: "notifications", label: "Notificações", description: "Envio de mensagens em Teams, Slack, Discord, Mattermost, Telegram, WhatsApp" },
];

const ITSM_PROVIDERS = ["glpi", "jira", "servicenow", "citsmart", "freshservice", "azure-devops"];

export const SKILLS: SkillDefinition[] = [
  // ── Ansible ──
  { name: "run_playbook", category: "ansible", description: "Executa um playbook Ansible", riskLevel: 4, requiredRole: "operator",
    parameters: { playbook: { type: "string", description: "Nome do playbook" }, inventory: { type: "string", description: "Inventário alvo" } } },
  { name: "list_playbooks", category: "ansible", description: "Lista playbooks disponíveis", riskLevel: 1, requiredRole: "viewer", parameters: {} },

  // ── GitLab ──
  { name: "create_merge_request", category: "gitlab", description: "Cria MR de remediação", riskLevel: 3, requiredRole: "operator",
    parameters: { project: { type: "string", description: "ID do projeto" }, branch: { type: "string", description: "Branch origem" } } },
  { name: "trigger_pipeline", category: "gitlab", description: "Dispara pipeline CI/CD", riskLevel: 3, requiredRole: "operator",
    parameters: { project: { type: "string", description: "ID do projeto" }, ref: { type: "string", description: "Branch/tag", default: "main" } } },
  { name: "create_issue", category: "gitlab", description: "Cria issue", riskLevel: 1, requiredRole: "viewer",
    parameters: { project: { type: "string", description: "ID do projeto" }, title: { type: "string", description: "Título" } } },

  // ── Kubernetes ──
  { name: "rollout_restart", category: "kubernetes", description: "Reinicia deployment", riskLevel: 4, requiredRole: "operator",
    parameters: { namespace: { type: "string", description: "Namespace" }, deployment: { type: "string", description: "Nome" } } },
  { name: "scale_deployment", category: "kubernetes", description: "Escala deployment", riskLevel: 3, requiredRole: "operator",
    parameters: { namespace: { type: "string", description: "Namespace" }, deployment: { type: "string", description: "Nome" }, replicas: { type: "number", description: "Réplicas" } } },
  { name: "get_pods", category: "kubernetes", description: "Lista pods", riskLevel: 1, requiredRole: "viewer",
    parameters: { namespace: { type: "string", description: "Namespace" } } },

  // ── Monitoring ──
  { name: "query_prometheus", category: "monitoring", description: "Consulta PromQL", riskLevel: 1, requiredRole: "viewer",
    parameters: { query: { type: "string", description: "Expressão PromQL" } } },
  { name: "get_alerts", category: "monitoring", description: "Lista alertas ativos", riskLevel: 1, requiredRole: "viewer", parameters: {} },
  { name: "silence_alert", category: "monitoring", description: "Silencia alerta", riskLevel: 3, requiredRole: "operator",
    parameters: { alert: { type: "string", description: "Nome do alerta" }, duration: { type: "string", description: "Duração", default: "1h" } } },

  // ── ITSM (provider-based + específicas) ──
  { name: "create_ticket", category: "itsm",
    description: `Abre chamado em qualquer provedor (${ITSM_PROVIDERS.join(", ")})`,
    riskLevel: 2, requiredRole: "operator",
    parameters: {
      provider: { type: "string", description: `Provedor ITSM (${ITSM_PROVIDERS.join("|")})` },
      title: { type: "string", description: "Título / resumo" },
      description: { type: "string", description: "Descrição detalhada" },
      priority: { type: "string", description: "Prioridade", default: "medium" },
      extra: { type: "object", description: "Campos específicos do provedor" },
    } },
  { name: "update_ticket", category: "itsm", description: "Atualiza status/comentário em chamado existente", riskLevel: 2, requiredRole: "operator",
    parameters: {
      provider: { type: "string", description: "Provedor ITSM" },
      ticket_id: { type: "string", description: "ID do chamado" },
      status: { type: "string", description: "Novo status" },
      comment: { type: "string", description: "Comentário opcional" },
    } },
  { name: "create_change", category: "itsm", description: "Abre mudança (RFC) com avaliação de risco", riskLevel: 4, requiredRole: "operator",
    parameters: {
      provider: { type: "string", description: "Provedor ITSM" },
      title: { type: "string", description: "Título" },
      risk: { type: "string", description: "Risco (low/medium/high)", default: "low" },
    } },
  { name: "open_glpi_ticket", category: "itsm", description: "Abre chamado direto no GLPI (REST)", riskLevel: 1, requiredRole: "operator",
    parameters: { title: { type: "string", description: "Título" }, category: { type: "string", description: "Categoria" }, priority: { type: "number", description: "1-5", default: 3 } } },
  { name: "open_jira_ticket", category: "itsm", description: "Cria issue direto no Jira Cloud/DC", riskLevel: 1, requiredRole: "operator",
    parameters: { project_key: { type: "string", description: "PROJ" }, summary: { type: "string", description: "Resumo" }, issue_type: { type: "string", description: "Bug/Task", default: "Bug" } } },
  { name: "open_servicenow_incident", category: "itsm", description: "Cria incidente direto no ServiceNow", riskLevel: 1, requiredRole: "operator",
    parameters: { short_description: { type: "string", description: "Resumo" }, urgency: { type: "number", description: "1-3", default: 2 } } },
  { name: "open_citsmart_ticket", category: "itsm", description: "Cria requisição direto no CITSmart", riskLevel: 1, requiredRole: "operator",
    parameters: { service_id: { type: "number", description: "ID do serviço" }, requester: { type: "string", description: "Solicitante" } } },
  { name: "open_freshservice_ticket", category: "itsm", description: "Cria ticket direto no Freshservice", riskLevel: 1, requiredRole: "operator",
    parameters: { subject: { type: "string", description: "Assunto" }, email: { type: "string", description: "Email solicitante" }, priority: { type: "number", description: "1-4", default: 2 } } },
  { name: "open_azuredevops_workitem", category: "itsm", description: "Cria work item no Azure DevOps Boards", riskLevel: 1, requiredRole: "operator",
    parameters: { organization: { type: "string", description: "Org" }, project: { type: "string", description: "Projeto" }, work_item_type: { type: "string", description: "Bug/Task/Story", default: "Bug" } } },

  // ── Notifications / Colaboração ──
  { name: "notify_teams", category: "notifications", description: "Envia Adaptive Card para Microsoft Teams", riskLevel: 1, requiredRole: "operator",
    parameters: { title: { type: "string", description: "Título" }, message: { type: "string", description: "Mensagem" }, severity: { type: "string", description: "info/warning/critical", default: "info" } } },
  { name: "notify_slack", category: "notifications", description: "Envia mensagem para canal Slack (Block Kit)", riskLevel: 1, requiredRole: "operator",
    parameters: { channel: { type: "string", description: "#canal ou ID" }, message: { type: "string", description: "Mensagem" }, severity: { type: "string", description: "info/warning/critical", default: "info" } } },
  { name: "notify_discord", category: "notifications", description: "Envia mensagem para Discord via webhook", riskLevel: 1, requiredRole: "operator",
    parameters: { webhook_url: { type: "string", description: "URL do webhook" }, message: { type: "string", description: "Mensagem" } } },
  { name: "notify_mattermost", category: "notifications", description: "Envia mensagem para Mattermost", riskLevel: 1, requiredRole: "operator",
    parameters: { channel: { type: "string", description: "Canal" }, message: { type: "string", description: "Mensagem" } } },
  { name: "notify_telegram", category: "notifications", description: "Envia mensagem via Telegram Bot API", riskLevel: 1, requiredRole: "operator",
    parameters: { chat_id: { type: "string", description: "Chat ID" }, message: { type: "string", description: "Mensagem" } } },
  { name: "notify_whatsapp", category: "notifications", description: "Envia alerta via WhatsApp Business (template)", riskLevel: 2, requiredRole: "operator",
    parameters: { phone_number: { type: "string", description: "+5511..." }, template_name: { type: "string", description: "Template aprovado" } } },
];

export const AI_MODELS = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "rápido" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "raciocínio" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", tier: "econômico" },
  { id: "openai/gpt-5", label: "GPT-5", tier: "premium" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", tier: "balanceado" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano", tier: "rápido" },
];

export const ROLE_FOCUSES = [
  { id: "general", label: "Geral" },
  { id: "incidents", label: "Incidentes / SRE" },
  { id: "devsecops", label: "DevSecOps" },
  { id: "infrastructure", label: "Infraestrutura" },
  { id: "advisories", label: "Alertas / AR (CTIR)" },
  { id: "compliance", label: "Conformidade / Auditoria" },
  { id: "itsm", label: "ITSM / Service Desk" },
];
