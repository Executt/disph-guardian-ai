// Edge function: hypervisor-collect
// Authenticated trigger (admin/operator) that pulls metrics directly via APIs.
// Uses optional secrets: VSPHERE_URL/USER/PASS, HYPERV_WINRM_URL/USER/PASS.
// If secrets are missing, returns 412 so the UI can show "configure o agente".
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

async function collectVsphere() {
  const url = Deno.env.get("VSPHERE_URL");
  const user = Deno.env.get("VSPHERE_USER");
  const pass = Deno.env.get("VSPHERE_PASS");
  if (!url || !user || !pass) return null;

  // vSphere REST: POST /api/session -> session id
  const sess = await fetch(`${url}/api/session`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${user}:${pass}`) },
  });
  if (!sess.ok) throw new Error(`vSphere login failed: ${sess.status}`);
  const sid = (await sess.json()) as string;

  const hostsRes = await fetch(`${url}/api/vcenter/host`, { headers: { "vmware-api-session-id": sid } });
  if (!hostsRes.ok) throw new Error(`vSphere /host failed: ${hostsRes.status}`);
  const hosts = await hostsRes.json() as Array<{ host: string; name: string; connection_state: string; power_state: string }>;

  // Minimal mapping; rich metrics require pyVmomi / vRealize — coletor on-prem é recomendado.
  return hosts.map(h => ({
    platform: "vmware" as const,
    hostname: h.name,
    status: (h.connection_state === "CONNECTED" && h.power_state === "POWERED_ON") ? "ok" as const : "crit" as const,
  }));
}

async function collectHyperv() {
  const url = Deno.env.get("HYPERV_WINRM_URL");
  const user = Deno.env.get("HYPERV_USER");
  const pass = Deno.env.get("HYPERV_PASS");
  if (!url || !user || !pass) return null;
  // WinRM via HTTP exige SOAP/NTLM; recomendamos coletor on-prem (PowerShell -> POST ingest).
  // Aqui apenas validamos credenciais com um ping HTTP.
  const ping = await fetch(url, { method: "GET", headers: { Authorization: "Basic " + btoa(`${user}:${pass}`) } });
  if (!ping.ok) throw new Error(`Hyper-V WinRM ping ${ping.status}`);
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claims } = await sb.auth.getClaims(auth.replace("Bearer ", ""));
    if (!claims?.claims) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = claims.claims.sub as string;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ok } = await admin.rpc("has_any_role", { _user_id: userId, _roles: ["admin","operator"] });
    if (!ok) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const vsphere = await collectVsphere().catch(e => ({ error: String(e) }));
    const hyperv = await collectHyperv().catch(e => ({ error: String(e) }));

    if (vsphere === null && hyperv === null) {
      return new Response(JSON.stringify({
        error: "no_collector_configured",
        hint: "Configure secrets VSPHERE_URL/USER/PASS e/ou HYPERV_WINRM_URL/USER/PASS, ou use o agente on-prem (hypervisor-ingest).",
      }), { status: 412, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const hosts: Array<{ platform: "vmware"|"hyperv"; hostname: string; status: "ok"|"crit" }> = [];
    if (Array.isArray(vsphere)) hosts.push(...vsphere);
    if (Array.isArray(hyperv)) hosts.push(...hyperv);

    if (hosts.length) {
      const rows = hosts.map(h => ({ ...h, last_check_at: new Date().toISOString() }));
      await admin.from("hypervisor_hosts").upsert(rows, { onConflict: "platform,hostname" });
    }

    return new Response(JSON.stringify({ ok: true, vsphere, hyperv, collected: hosts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
