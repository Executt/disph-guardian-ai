// Recebe eventos de falha/inconsistência dos jobs de sync (CTIR/NVD),
// persiste em sync_alerts e despacha notificações (Teams, WhatsApp, ITSM).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  source: "ctir" | "nvd";
  kind: "empty_feed" | "timeout" | "rate_limit" | "http_error" | "fatal";
  severity?: "warning" | "error" | "critical";
  message: string;
  details?: Record<string, unknown>;
  create_ticket?: boolean;
};

async function notifyTeams(text: string): Promise<boolean> {
  const webhook = Deno.env.get("TEAMS_WEBHOOK_URL");
  if (!webhook) return false;
  try {
    const r = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return r.ok;
  } catch { return false; }
}

async function notifyWhatsApp(text: string): Promise<boolean> {
  const apiKey = Deno.env.get("GATEWAYAPI_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const recipients = (Deno.env.get("SYNC_ALERT_WHATSAPP_TO") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!apiKey || !lovableKey || recipients.length === 0) return false;
  try {
    // Envia um a um via /mobile/single (números como MSISDN inteiros)
    for (const to of recipients) {
      await fetch("https://connector-gateway.lovable.dev/gatewayapi/mobile/single", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: "DISPH",
          recipient: Number(to.replace(/\D/g, "")),
          message: text.slice(0, 640),
        }),
      });
    }
    return true;
  } catch { return false; }
}

async function createTicket(title: string, description: string): Promise<string | null> {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const { data, error } = await supabase.functions.invoke("create-itsm-ticket", {
      body: { title, description, priority: "high" },
    });
    if (error) return null;
    return (data as any)?.ticket_ref ?? null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: cors });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const p = await req.json() as Payload;
  if (!p?.source || !p?.kind || !p?.message) {
    return new Response(JSON.stringify({ error: "source, kind, message required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const severity = p.severity ?? (p.kind === "fatal" ? "critical" : p.kind === "http_error" || p.kind === "timeout" ? "error" : "warning");

  const text = `⚠️ [${p.source.toUpperCase()} · ${p.kind}] ${p.message}`;
  const [teamsOk, waOk] = await Promise.all([notifyTeams(text), notifyWhatsApp(text)]);
  const notified: string[] = [];
  if (teamsOk) notified.push("teams");
  if (waOk) notified.push("whatsapp");

  let ticketRef: string | null = null;
  if (p.create_ticket !== false && (severity === "error" || severity === "critical")) {
    ticketRef = await createTicket(`Sync ${p.source} · ${p.kind}`, `${p.message}\n\n${JSON.stringify(p.details ?? {}, null, 2)}`);
    if (ticketRef) notified.push(`ticket:${ticketRef}`);
  }

  const { data, error } = await supabase.from("sync_alerts").insert({
    source: p.source, kind: p.kind, severity, message: p.message,
    details: p.details ?? {}, ticket_ref: ticketRef, notified_channels: notified,
  }).select("id").single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true, id: data.id, notified, ticket_ref: ticketRef }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
