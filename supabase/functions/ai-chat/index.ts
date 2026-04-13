import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPERATIONAL_CONTEXT = `Você é o **DISPH AI Assistant**, um copiloto de AIOps para operações de TI governamentais (SISP).

## Contexto Operacional Atual (dados simulados em tempo real)

### Incidentes Ativos
- Total: 47 incidentes (3 P1, 8 P2, 16 P3, 20 P4)
- P1 Abertos:
  - INC-2847: API Gateway (AWS) — 23 min, threshold 20 min ultrapassado
  - INC-2851: DB Primary (On-Premise) — 14 min
  - INC-2853: Auth Service (OCI) — 8 min
- Resolvidos últimas 24h: 32

### Métricas
- SLA Compliance: 97.2% (meta: 99.0%)
  - AWS: 98.1% | OCI: 96.8% | On-Premise: 96.5%
- MTTR: 18 min (↓12% vs semana anterior)
  - AWS: 14 min | OCI: 21 min | On-Premise: 22 min
- Disponibilidade Global: 99.94%

### Serviços Degradados
- Cache Redis (On-Premise): Uptime 99.52%, latência p99 45ms (baseline 12ms), memory pressure worker-03
- MQ Kafka (OCI): Uptime 99.61%, consumer lag crescente tópico events.incidents, 3 partições rebalanceando

### Ambientes Monitorados
- AWS (EKS): 18 incidentes, melhor performance
- OCI (OKE): 15 incidentes
- On-Premise (OpenShift): 14 incidentes, 3 pods CrashLoopBackOff

### Automação
- Ansible resolveu 8 incidentes sem intervenção humana
- Deploy v2.14.3 API Gateway agendado 22:00

## Instruções
- Responda SEMPRE em português brasileiro
- Use markdown com tabelas, listas e emojis para formatação rica
- Seja preciso e objetivo, como um analista SRE sênior
- Sugira ações proativas quando relevante
- Referencie IDs de incidentes, serviços e ambientes específicos
- Para dados que não possui, informe que precisaria de integração com os sistemas reais
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, model } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const selectedModel = model || "google/gemini-3-flash-preview";

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: "system", content: OPERATIONAL_CONTEXT },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione fundos em Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no gateway AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
