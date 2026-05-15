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
  { id: "itsm", label: "ITSM", description: "Tickets e mudanças" },
  { id: "notifications", label: "Notificações", description: "Envio de mensagens em canais" },
];

export const SKILLS: SkillDefinition[] = [
  // Ansible
  { name: "run_playbook", category: "ansible", description: "Executa um playbook Ansible", riskLevel: 4, requiredRole: "operator",
    parameters: { playbook: { type: "string", description: "Nome do playbook" }, inventory: { type: "string", description: "Inventário alvo" } } },
  { name: "list_playbooks", category: "ansible", description: "Lista playbooks disponíveis", riskLevel: 1, requiredRole: "viewer", parameters: {} },

  // GitLab
  { name: "create_merge_request", category: "gitlab", description: "Cria MR de remediação", riskLevel: 3, requiredRole: "operator",
    parameters: { project: { type: "string", description: "ID do projeto" }, branch: { type: "string", description: "Branch origem" } } },
  { name: "trigger_pipeline", category: "gitlab", description: "Dispara pipeline CI/CD", riskLevel: 3, requiredRole: "operator",
    parameters: { project: { type: "string", description: "ID do projeto" }, ref: { type: "string", description: "Branch/tag", default: "main" } } },
  { name: "create_issue", category: "gitlab", description: "Cria issue", riskLevel: 1, requiredRole: "viewer",
    parameters: { project: { type: "string", description: "ID do projeto" }, title: { type: "string", description: "Título" } } },

  // Kubernetes
  { name: "rollout_restart", category: "kubernetes", description: "Reinicia deployment", riskLevel: 4, requiredRole: "operator",
    parameters: { namespace: { type: "string", description: "Namespace" }, deployment: { type: "string", description: "Nome" } } },
  { name: "scale_deployment", category: "kubernetes", description: "Escala deployment", riskLevel: 3, requiredRole: "operator",
    parameters: { namespace: { type: "string", description: "Namespace" }, deployment: { type: "string", description: "Nome" }, replicas: { type: "number", description: "Réplicas" } } },
  { name: "get_pods", category: "kubernetes", description: "Lista pods", riskLevel: 1, requiredRole: "viewer",
    parameters: { namespace: { type: "string", description: "Namespace" } } },

  // Monitoring
  { name: "query_prometheus", category: "monitoring", description: "Consulta PromQL", riskLevel: 1, requiredRole: "viewer",
    parameters: { query: { type: "string", description: "Expressão PromQL" } } },
  { name: "get_alerts", category: "monitoring", description: "Lista alertas ativos", riskLevel: 1, requiredRole: "viewer", parameters: {} },
  { name: "silence_alert", category: "monitoring", description: "Silencia alerta", riskLevel: 3, requiredRole: "operator",
    parameters: { alert: { type: "string", description: "Nome do alerta" }, duration: { type: "string", description: "Duração", default: "1h" } } },

  // ITSM
  { name: "create_ticket", category: "itsm", description: "Abre chamado", riskLevel: 2, requiredRole: "operator",
    parameters: { title: { type: "string", description: "Título" }, priority: { type: "string", description: "Prioridade", default: "medium" } } },
  { name: "update_ticket", category: "itsm", description: "Atualiza chamado", riskLevel: 2, requiredRole: "operator",
    parameters: { ticket_id: { type: "string", description: "ID do chamado" }, status: { type: "string", description: "Novo status" } } },
  { name: "create_change", category: "itsm", description: "Abre mudança (RFC)", riskLevel: 4, requiredRole: "operator",
    parameters: { title: { type: "string", description: "Título" }, risk: { type: "string", description: "Risco", default: "low" } } },

  // Notifications
  { name: "send_teams", category: "notifications", description: "Envia mensagem no Teams", riskLevel: 1, requiredRole: "operator",
    parameters: { channel: { type: "string", description: "Canal" }, message: { type: "string", description: "Mensagem" } } },
  { name: "send_whatsapp", category: "notifications", description: "Envia WhatsApp via Twilio", riskLevel: 2, requiredRole: "operator",
    parameters: { to: { type: "string", description: "Telefone" }, message: { type: "string", description: "Mensagem" } } },
  { name: "send_telegram", category: "notifications", description: "Envia mensagem no Telegram", riskLevel: 1, requiredRole: "operator",
    parameters: { chat_id: { type: "string", description: "Chat ID" }, message: { type: "string", description: "Mensagem" } } },
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
