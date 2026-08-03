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

// Janela de deduplicação por (source, kind) e limite global por origem.
const DEDUP_WINDOW_MIN = Number(Deno.env.get("SYNC_ALERT_DEDUP_MINUTES") ?? "30");
const RATE_LIMIT_PER_HOUR = Number(Deno.env.get("SYNC_ALERT_MAX_PER_HOUR") ?? "5");

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

  // ── Deduplicação: mesma origem+tipo já notificada na janela? ──────
  const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MIN * 60_000).toISOString();
  const { data: dupes } = await supabase
    .from("sync_alerts")
    .select("id,created_at,notified_channels,details")
    .eq("source", p.source)
    .eq("kind", p.kind)
    .is("resolved_at", null)
    .gte("created_at", dedupSince)
    .order("created_at", { ascending: false })
    .limit(50);

  const notifiedDupes = (dupes ?? []).filter(
    (d: any) => Array.isArray(d.notified_channels) && d.notified_channels.length > 0,
  );
  const duplicate = notifiedDupes.length > 0;

  // ── Rate limit: máximo de notificações por hora por origem ────────
  const hourSince = new Date(Date.now() - 3_600_000).toISOString();
  const { data: recent } = await supabase
    .from("sync_alerts")
    .select("id,notified_channels")
    .eq("source", p.source)
    .gte("created_at", hourSince)
    .limit(200);
  const sentLastHour = (recent ?? []).filter(
    (r: any) => Array.isArray(r.notified_channels) && r.notified_channels.some((c: string) => c === "teams" || c === "whatsapp"),
  ).length;
  const rateLimited = sentLastHour >= RATE_LIMIT_PER_HOUR;

  const suppressed = duplicate || rateLimited;
  const suppression_reason = rateLimited
    ? `rate_limit:${sentLastHour}/${RATE_LIMIT_PER_HOUR}h`
    : duplicate ? `dedup:${DEDUP_WINDOW_MIN}min` : null;
  const occurrences = (dupes ?? []).length + 1;

  const text =
    `⚠️ [${p.source.toUpperCase()} · ${p.kind}] ${p.message}` +
    (occurrences > 1 ? `\n(ocorrência #${occurrences} na janela de ${DEDUP_WINDOW_MIN}min)` : "");

  const notified: string[] = [];
  if (!suppressed) {
    const [teamsOk, waOk] = await Promise.all([notifyTeams(text), notifyWhatsApp(text)]);
    if (teamsOk) notified.push("teams");
    if (waOk) notified.push("whatsapp");
  }

  // Ticket também é deduplicado: só abre se ainda não houver ticket na janela
  let ticketRef: string | null = null;
  const hasTicket = (dupes ?? []).some((d: any) => d.details?.ticket_ref || d.ticket_ref);
  if (!suppressed && !hasTicket && p.create_ticket !== false && (severity === "error" || severity === "critical")) {
    ticketRef = await createTicket(`Sync ${p.source} · ${p.kind}`, `${p.message}\n\n${JSON.stringify(p.details ?? {}, null, 2)}`);
    if (ticketRef) notified.push(`ticket:${ticketRef}`);
  }

  // O registro é sempre persistido (motivo/detalhes preservados), mesmo suprimido.
  const { data, error } = await supabase.from("sync_alerts").insert({
    source: p.source, kind: p.kind, severity, message: p.message,
    details: { ...(p.details ?? {}), occurrences, suppressed, suppression_reason },
    ticket_ref: ticketRef,
    notified_channels: suppressed ? [`suppressed:${suppression_reason}`] : notified,
  }).select("id").single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({
    ok: true, id: data.id, notified, ticket_ref: ticketRef,
    suppressed, suppression_reason, occurrences,
  }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

