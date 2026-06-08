// Fonte ÚNICA dos modelos de IA disponíveis via Lovable AI Gateway.
// Todos os consumidores (AIChatConsole, SettingsPage, AdminPage, AgentsPage,
// AgentDetailPage, agentSkills) DEVEM importar daqui — não duplicar listas.

export type AIModelTier = "fast" | "standard" | "premium" | "reasoning" | "economy";

export interface AIModel {
  id: string;
  label: string;
  description: string;
  tier: AIModelTier;
}

export const AI_MODELS: AIModel[] = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", description: "Rápido e eficiente", tier: "fast" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Equilibrado", tier: "fast" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", description: "Mais econômico", tier: "economy" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Melhor raciocínio complexo", tier: "premium" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", description: "Última geração Google", tier: "premium" },
  { id: "openai/gpt-5", label: "GPT-5", description: "Poderoso, multimodal", tier: "premium" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", description: "Custo-benefício", tier: "standard" },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano", description: "Velocidade máxima", tier: "fast" },
  { id: "openai/gpt-5.2", label: "GPT-5.2", description: "Raciocínio avançado", tier: "reasoning" },
];

export const DEFAULT_AI_MODEL = "google/gemini-2.5-flash";
