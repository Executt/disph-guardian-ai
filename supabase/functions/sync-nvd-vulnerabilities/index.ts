// Sync NVD 2.0 CVEs por watchlist (keyword/cpe/vendor/product)
// - Sem API key: 5 req/30s (sleep 6s). Com NVD_API_KEY: 50 req/30s (sleep 0.6s).
// - Incremental via lastModStartDate/lastModEndDate (janela máxima 120 dias).
// - Estado por watch reaproveita ctir_sync_state.feed_url = "nvd:<watchId>".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NVD = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const UA = "DISPH-Guardian-AI/1.0";

type Sev = "low" | "medium" | "high" | "critical" | "none";

function cvssSeverity(score: number | null): Sev {
  if (score == null) return "none";
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "none";
}

function extractCvss(metrics: any): { score: number | null; vector: string | null } {
  const src =
    metrics?.cvssMetricV31?.[0]?.cvssData ??
    metrics?.cvssMetricV30?.[0]?.cvssData ??
    metrics?.cvssMetricV2?.[0]?.cvssData ??
    null;
  if (!src) return { score: null, vector: null };
  return { score: src.baseScore ?? null, vector: src.vectorString ?? null };
}

async function nvdFetch(url: string, apiKey: string | null) {
  const headers: Record<string, string> = { "User-Agent": UA };
  if (apiKey) headers["apiKey"] = apiKey;
  const res = await fetch(url, { headers });
  const body = await res.text();
  if (!res.ok) throw new Error(`NVD ${res.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const startedAt = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const nvdKey = Deno.env.get("NVD_API_KEY") ?? null;
  const throttle = nvdKey ? 700 : 6200;

  let force = false;
  let daysBack = 30;
  try {
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({} as any));
      force = b?.force === true;
      if (typeof b?.days_back === "number") daysBack = Math.max(1, Math.min(120, b.days_back));
    }
  } catch (_e) { /* noop */ }

  const { data: watches } = await supabase
    .from("nvd_watchlist")
    .select("id,label,kind,value,severity_floor,enabled")
    .eq("enabled", true);

  const totals = {
    watches: watches?.length ?? 0,
    upserts: 0, unchanged: 0, errors: 0, cve_seen: 0,
  };

  for (const w of watches ?? []) {
    try {
      const stateKey = `nvd:${w.id}`;
      const { data: state } = await supabase
        .from("ctir_sync_state")
        .select("last_item_published_at")
        .eq("feed_url", stateKey)
        .maybeSingle();

      const endDate = new Date();
      const startDate = !force && state?.last_item_published_at
        ? new Date(state.last_item_published_at)
        : new Date(endDate.getTime() - daysBack * 86_400_000);

      const params = new URLSearchParams({
        lastModStartDate: startDate.toISOString(),
        lastModEndDate: endDate.toISOString(),
        resultsPerPage: "200",
      });
      if (w.kind === "cpe") params.set("cpeName", w.value);
      else params.set("keywordSearch", w.value);

      let startIndex = 0;
      let maxMod = startDate.getTime();
      // paginação
      // eslint-disable-next-line no-constant-condition
      while (true) {
        params.set("startIndex", String(startIndex));
        const url = `${NVD}?${params.toString()}`;
        const data = await nvdFetch(url, nvdKey);
        const vulns = data?.vulnerabilities ?? [];
        totals.cve_seen += vulns.length;

        for (const v of vulns) {
          const cve = v.cve;
          if (!cve?.id) continue;
          const { score, vector } = extractCvss(cve.metrics);
          const summary =
            cve.descriptions?.find((d: any) => d.lang === "en")?.value ??
            cve.descriptions?.[0]?.value ?? null;
          const cwe =
            cve.weaknesses?.[0]?.description?.find((d: any) => d.lang === "en")?.value ?? null;
          const refs = (cve.references ?? []).map((r: any) => ({ url: r.url, source: r.source }));
          const cpes = (cve.configurations ?? []).flatMap((c: any) =>
            (c.nodes ?? []).flatMap((n: any) =>
              (n.cpeMatch ?? []).map((m: any) => m.criteria)
            )
          );
          const lastMod = cve.lastModified ? new Date(cve.lastModified) : null;
          if (lastMod && lastMod.getTime() > maxMod) maxMod = lastMod.getTime();

          const { data: existing } = await supabase
            .from("nvd_vulnerabilities")
            .select("cve_id, matched_watch_ids, last_modified")
            .eq("cve_id", cve.id)
            .maybeSingle();

          const matched = new Set<string>(existing?.matched_watch_ids ?? []);
          matched.add(w.id);

          const payload = {
            cve_id: cve.id,
            published_at: cve.published ? new Date(cve.published).toISOString() : null,
            last_modified: lastMod?.toISOString() ?? null,
            cvss_score: score,
            cvss_vector: vector,
            severity: cvssSeverity(score),
            summary,
            cwe,
            refs,
            cpe_matches: cpes,
            matched_watch_ids: Array.from(matched),
            synced_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from("nvd_vulnerabilities")
            .upsert(payload, { onConflict: "cve_id" });
          if (error) { totals.errors++; console.error("upsert cve", error); }
          else totals.upserts++;
        }

        const totalResults = data?.totalResults ?? 0;
        startIndex += vulns.length;
        if (startIndex >= totalResults || vulns.length === 0) break;
        await sleep(throttle);
      }

      await supabase.from("ctir_sync_state").upsert({
        feed_url: stateKey,
        last_status: 200,
        last_fetched_at: new Date().toISOString(),
        last_item_published_at: new Date(maxMod).toISOString(),
        items_seen: totals.cve_seen,
      }, { onConflict: "feed_url" });

      await sleep(throttle);
    } catch (e) {
      totals.errors++;
      console.error(`[nvd] watch ${w.label}`, e);
    }
  }

  await supabase.from("audit_logs").insert({
    action: "sync_nvd_vulnerabilities",
    resource_type: "nvd_vulnerabilities",
    details: { ...totals, force, days_back: daysBack, duration_ms: Date.now() - startedAt, has_api_key: !!nvdKey },
  });

  return new Response(JSON.stringify({ ok: true, ...totals, duration_ms: Date.now() - startedAt }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
