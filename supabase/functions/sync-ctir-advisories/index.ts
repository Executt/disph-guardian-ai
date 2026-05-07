// Sync CTIR Gov advisories into ctir_advisories table
// Scrapes https://www.gov.br/ctir/pt-br/assuntos/alertas-e-recomendacoes
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CTIR_BASE = "https://www.gov.br/ctir/pt-br/assuntos/alertas-e-recomendacoes";

type Severity = "low" | "medium" | "high" | "critical";
type Kind = "alert" | "recommendation";

interface ParsedAdvisory {
  code: string;
  title: string;
  kind: Kind;
  severity: Severity;
  category: string | null;
  cves: string[];
  source_url: string;
  published_at: string | null;
  description: string | null;
}

function detectKind(text: string): Kind {
  const t = text.toUpperCase();
  if (t.includes("CTIR-AL") || /\bALERTA\b/.test(t)) return "alert";
  return "recommendation";
}

function detectSeverity(text: string): Severity {
  const t = text.toLowerCase();
  if (/(cr[ií]tic|critical|9\.[0-9]|10\.0)/.test(t)) return "critical";
  if (/(alta|high|7\.[0-9]|8\.[0-9])/.test(t)) return "high";
  if (/(baixa|low|0\.|1\.|2\.|3\.)/.test(t)) return "low";
  return "medium";
}

function extractCVEs(text: string): string[] {
  const matches = text.match(/CVE-\d{4}-\d{4,7}/gi) || [];
  return Array.from(new Set(matches.map((c) => c.toUpperCase())));
}

function detectCategory(text: string): string | null {
  const map: Record<string, string> = {
    kubernetes: "Kubernetes",
    docker: "Container",
    ssh: "SSH",
    openssh: "SSH",
    ldap: "IAM",
    "active directory": "IAM",
    vpn: "Rede",
    firewall: "Rede",
    apache: "Web Server",
    nginx: "Web Server",
    windows: "Windows",
    linux: "Linux",
    chrome: "Browser",
    firefox: "Browser",
  };
  const lower = text.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (lower.includes(k)) return v;
  }
  return null;
}

async function fetchListing(): Promise<ParsedAdvisory[]> {
  const res = await fetch(CTIR_BASE, {
    headers: { "User-Agent": "DISPH-AIOPS/1.0 (advisory-sync)" },
  });
  if (!res.ok) throw new Error(`CTIR fetch failed: ${res.status}`);
  const html = await res.text();

  // Plone-style listing: <a class="summary url" href="...">TITLE</a>
  const items: ParsedAdvisory[] = [];
  const linkRegex =
    /<a[^>]+class="[^"]*summary[^"]*url[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    const url = m[1];
    const rawTitle = m[2].replace(/<[^>]+>/g, "").trim();
    if (!rawTitle || seen.has(url)) continue;
    seen.add(url);

    const codeMatch = rawTitle.match(/CTIR[- ]?(?:AL|REC)[- ]?\d{4}[- ]?\d+/i);
    const code = codeMatch
      ? codeMatch[0].replace(/\s+/g, "-").toUpperCase()
      : rawTitle.slice(0, 60).toUpperCase();

    items.push({
      code,
      title: rawTitle,
      kind: detectKind(rawTitle),
      severity: detectSeverity(rawTitle),
      category: detectCategory(rawTitle),
      cves: extractCVEs(rawTitle),
      source_url: url.startsWith("http") ? url : `https://www.gov.br${url}`,
      published_at: null,
      description: null,
    });
    if (items.length >= 30) break;
  }
  return items;
}

async function enrichAdvisory(adv: ParsedAdvisory): Promise<ParsedAdvisory> {
  try {
    const res = await fetch(adv.source_url, {
      headers: { "User-Agent": "DISPH-AIOPS/1.0" },
    });
    if (!res.ok) return adv;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const desc = text.slice(0, 2000);
    const cves = Array.from(new Set([...adv.cves, ...extractCVEs(text)]));
    const dateMatch =
      html.match(/datetime="([^"]+)"/) ||
      text.match(/(\d{2}\/\d{2}\/\d{4})/);
    let published_at: string | null = adv.published_at;
    if (dateMatch) {
      const raw = dateMatch[1];
      if (raw.includes("/")) {
        const [d, m, y] = raw.split("/");
        published_at = new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
      } else {
        published_at = new Date(raw).toISOString();
      }
    }

    return {
      ...adv,
      description: desc,
      cves,
      severity: detectSeverity(text + " " + adv.title),
      category: adv.category || detectCategory(text),
      published_at,
    };
  } catch (_e) {
    return adv;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log("[sync-ctir] Fetching listing...");
    const listing = await fetchListing();
    console.log(`[sync-ctir] Found ${listing.length} advisories`);

    let inserted = 0;
    let updated = 0;
    let assessmentsCreated = 0;

    // Get all environments once for default assessment seeding
    const { data: envs } = await supabase
      .from("monitored_environments")
      .select("id");
    const envIds = (envs || []).map((e) => e.id);

    for (const item of listing) {
      const enriched = await enrichAdvisory(item);

      // Upsert by code
      const { data: existing } = await supabase
        .from("ctir_advisories")
        .select("id")
        .eq("code", enriched.code)
        .maybeSingle();

      const payload = {
        code: enriched.code,
        title: enriched.title,
        kind: enriched.kind,
        severity: enriched.severity,
        category: enriched.category,
        cves: enriched.cves,
        source: "CTIR Gov",
        source_url: enriched.source_url,
        published_at: enriched.published_at,
        description: enriched.description,
        synced_at: new Date().toISOString(),
      };

      let advisoryId: string;
      if (existing) {
        const { error } = await supabase
          .from("ctir_advisories")
          .update(payload)
          .eq("id", existing.id);
        if (error) {
          console.error("update error", error);
          continue;
        }
        advisoryId = existing.id;
        updated++;
      } else {
        const { data, error } = await supabase
          .from("ctir_advisories")
          .insert(payload)
          .select("id")
          .single();
        if (error || !data) {
          console.error("insert error", error);
          continue;
        }
        advisoryId = data.id;
        inserted++;

        // Seed pending assessments for every monitored environment
        if (envIds.length > 0) {
          const rows = envIds.map((eid) => ({
            advisory_id: advisoryId,
            environment_id: eid,
            status: "pending",
            affected_assets: 0,
          }));
          const { error: aErr } = await supabase
            .from("advisory_environment_assessments")
            .insert(rows);
          if (!aErr) assessmentsCreated += rows.length;
        }
      }
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      action: "sync_ctir_advisories",
      resource_type: "ctir_advisories",
      details: {
        inserted,
        updated,
        assessments_created: assessmentsCreated,
        total_seen: listing.length,
      },
    });

    const result = {
      ok: true,
      inserted,
      updated,
      assessments_created: assessmentsCreated,
      total_seen: listing.length,
      synced_at: new Date().toISOString(),
    };
    console.log("[sync-ctir] done", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[sync-ctir] fatal", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
