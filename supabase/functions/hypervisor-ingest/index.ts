// Edge function: hypervisor-ingest
// Receives metrics + agent heartbeat/logs from on-prem agents.
// Auth: shared secret in x-agent-token (HYPERVISOR_AGENT_TOKEN).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface HostIn {
  environment_id?: string | null;
  platform: "vmware" | "hyperv";
  hostname: string;
  cluster?: string | null;
  cpu_pct?: number;
  ram_pct?: number;
  datastore_pct?: number;
  uptime_seconds?: number;
  status?: "ok" | "warn" | "crit" | "maintenance";
}
interface VmIn { hostname: string; name: string; symptom: string; severity?: "info"|"warn"|"crit"; recommendation?: string }
interface FpIn { environment_id?: string | null; category: string; title: string; severity?: "info"|"warn"|"crit"; impact?: string }

interface AgentStatusIn {
  agent_name: string;
  platform: "vsphere" | "hyperv";
  environment_id?: string | null;
  hostname?: string | null;
  version?: string | null;
  status?: "online" | "degraded" | "offline";
  last_error_message?: string | null;
}
interface LogIn {
  agent_name: string;
  platform: "vsphere" | "hyperv";
  environment_id?: string | null;
  level?: "info" | "warn" | "error";
  message: string;
  details?: Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = req.headers.get("x-agent-token");
    const expected = Deno.env.get("HYPERVISOR_AGENT_TOKEN");
    if (!expected || token !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json() as {
      hosts?: HostIn[]; vms?: VmIn[]; failure_points?: FpIn[];
      agent?: AgentStatusIn; logs?: LogIn[];
    };
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const out: Record<string, number> = { hosts: 0, vms: 0, failure_points: 0, logs: 0, agent: 0 };
    const now = new Date().toISOString();
    const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    if (body.hosts?.length) {
      const rows = body.hosts.map(h => ({
        environment_id: h.environment_id ?? null,
        platform: h.platform,
        hostname: h.hostname,
        cluster: h.cluster ?? null,
        cpu_pct: h.cpu_pct ?? 0,
        ram_pct: h.ram_pct ?? 0,
        datastore_pct: h.datastore_pct ?? 0,
        uptime_seconds: h.uptime_seconds ?? 0,
        status: h.status ?? "ok",
        last_check_at: now,
      }));
      const { error } = await supabase.from("hypervisor_hosts").upsert(rows, { onConflict: "platform,hostname" });
      if (error) throw error;
      out.hosts = rows.length;
    }

    if (body.vms?.length) {
      const hostnames = [...new Set(body.vms.map(v => v.hostname))];
      const { data: hosts } = await supabase.from("hypervisor_hosts").select("id,hostname").in("hostname", hostnames);
      const map = new Map((hosts ?? []).map(h => [h.hostname, h.id]));
      const rows = body.vms.filter(v => map.has(v.hostname)).map(v => ({
        host_id: map.get(v.hostname)!,
        name: v.name,
        symptom: v.symptom,
        severity: v.severity ?? "warn",
        recommendation: v.recommendation ?? null,
        last_check_at: now,
      }));
      const hostIds = [...new Set(rows.map(r => r.host_id))];
      if (hostIds.length) await supabase.from("hypervisor_vms").delete().in("host_id", hostIds);
      if (rows.length) {
        const { error } = await supabase.from("hypervisor_vms").insert(rows);
        if (error) throw error;
      }
      out.vms = rows.length;
    }

    if (body.failure_points?.length) {
      const envIds = [...new Set(body.failure_points.map(f => f.environment_id ?? null))];
      for (const e of envIds) {
        const q = supabase.from("hypervisor_failure_points").delete();
        await (e ? q.eq("environment_id", e) : q.is("environment_id", null));
      }
      const rows = body.failure_points.map(f => ({
        environment_id: f.environment_id ?? null,
        category: f.category,
        title: f.title,
        severity: f.severity ?? "warn",
        impact: f.impact ?? null,
        detected_at: now,
      }));
      const { error } = await supabase.from("hypervisor_failure_points").insert(rows);
      if (error) throw error;
      out.failure_points = rows.length;
    }

    // Agent logs
    if (body.logs?.length) {
      const rows = body.logs.map(l => ({
        environment_id: l.environment_id ?? null,
        platform: l.platform,
        agent_name: l.agent_name,
        level: l.level ?? "info",
        message: l.message,
        details: l.details ?? null,
      }));
      const { error } = await supabase.from("hypervisor_agent_logs").insert(rows);
      if (error) throw error;
      out.logs = rows.length;
    }

    // Agent heartbeat / status
    if (body.agent?.agent_name && body.agent?.platform) {
      const a = body.agent;
      const hasError = (body.logs ?? []).some(l => l.level === "error") || a.status === "degraded" || a.status === "offline";

      // count errors in last 24h for this agent
      const { count } = await supabase
        .from("hypervisor_agent_logs")
        .select("id", { count: "exact", head: true })
        .eq("agent_name", a.agent_name)
        .eq("platform", a.platform)
        .eq("level", "error")
        .gte("created_at", since24h);

      const row = {
        environment_id: a.environment_id ?? null,
        platform: a.platform,
        agent_name: a.agent_name,
        hostname: a.hostname ?? null,
        version: a.version ?? null,
        status: a.status ?? (hasError ? "degraded" : "online"),
        last_collect_at: now,
        last_success_at: hasError ? undefined : now,
        last_error_at: hasError ? now : undefined,
        last_error_message: a.last_error_message ?? null,
        error_count_24h: count ?? 0,
        updated_at: now,
      };
      // Remove undefined fields so upsert keeps existing values
      const clean = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
      const { error } = await supabase
        .from("hypervisor_agent_status")
        .upsert(clean, { onConflict: "environment_id,platform,agent_name" });
      if (error) throw error;
      out.agent = 1;
    }

    return new Response(JSON.stringify({ ok: true, ingested: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
