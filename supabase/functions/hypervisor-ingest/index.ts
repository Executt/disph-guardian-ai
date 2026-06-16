// Edge function: hypervisor-ingest
// Receives metrics from on-prem agents and upserts into hypervisor_* tables.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = req.headers.get("x-agent-token");
    const expected = Deno.env.get("HYPERVISOR_AGENT_TOKEN");
    if (!expected || token !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json() as { hosts?: HostIn[]; vms?: VmIn[]; failure_points?: FpIn[] };
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const out: Record<string, number> = { hosts: 0, vms: 0, failure_points: 0 };

    // Upsert hosts (by platform+hostname)
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
        last_check_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("hypervisor_hosts").upsert(rows, { onConflict: "platform,hostname" });
      if (error) throw error;
      out.hosts = rows.length;
    }

    // Resolve host ids for VMs
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
        last_check_at: new Date().toISOString(),
      }));
      // Replace-by-host strategy: clear stale rows for affected hosts, insert fresh
      const hostIds = [...new Set(rows.map(r => r.host_id))];
      if (hostIds.length) await supabase.from("hypervisor_vms").delete().in("host_id", hostIds);
      if (rows.length) {
        const { error } = await supabase.from("hypervisor_vms").insert(rows);
        if (error) throw error;
      }
      out.vms = rows.length;
    }

    if (body.failure_points?.length) {
      // Replace-all per environment included in payload
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
        detected_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("hypervisor_failure_points").insert(rows);
      if (error) throw error;
      out.failure_points = rows.length;
    }

    return new Response(JSON.stringify({ ok: true, ingested: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
