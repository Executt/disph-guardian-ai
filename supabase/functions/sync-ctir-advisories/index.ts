// Sync CTIR Gov advisories incrementally
// Strategy:
//  1. For each feed (alertas/recomendacoes × year), do a conditional GET using
//     stored ETag / Last-Modified -> 304 means skip entirely.
//  2. Parse the RSS/RDF, extract items with <dc:date>.
//  3. Skip items with published_at <= last_item_published_at stored for that feed.
//  4. Upsert only changed items by `code`. Compare published_at to existing.synced_at-aware row
//     to skip writes when nothing changed.
//  5. Persist new ETag / Last-Modified / max(published_at) into ctir_sync_state.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://www.gov.br/ctir/pt-br/assuntos/alertas-e-recomendacoes";
// gov.br bloqueia UAs não-browser com 403. Usamos UA de browser real.
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type Severity = "low" | "medium" | "high" | "critical";
type Kind = "alert" | "recommendation";

interface FeedItem {
  url: string;
  title: string;
  description: string;
  published_at: string; // ISO
}

function detectSeverity(text: string): Severity {
  const t = text.toLowerCase();
  if (/(cr[ií]tic|critical|zero[- ]?day|9\.\d|10\.0)/.test(t)) return "critical";
  if (/(alta|high|7\.\d|8\.\d)/.test(t)) return "high";
  if (/(baixa|low)/.test(t)) return "low";
  return "medium";
}

function detectCategory(text: string): string | null {
  const map: Record<string, string> = {
    kubernetes: "Kubernetes", docker: "Container", ssh: "SSH",
    openssh: "SSH", ldap: "IAM", "active directory": "IAM",
    vpn: "Rede", firewall: "Rede", apache: "Web Server",
    nginx: "Web Server", windows: "Windows", linux: "Linux",
    chrome: "Browser", firefox: "Browser", office: "Office",
    exchange: "Email", outlook: "Email", cisco: "Rede",
    fortinet: "Rede", vmware: "Virtualização",
  };
  const lower = text.toLowerCase();
  for (const [k, v] of Object.entries(map)) if (lower.includes(k)) return v;
  return null;
}

function extractCVEs(text: string): string[] {
  const m = text.match(/CVE-\d{4}-\d{4,7}/gi) || [];
  return Array.from(new Set(m.map((c) => c.toUpperCase())));
}

function buildCode(kind: Kind, title: string, year: number): string {
  // Normalize "ALERTA 14/2026" -> "CTIR-AL-2026-014"
  const m = title.match(/(\d+)\s*\/\s*(\d{4})/);
  if (m) {
    const num = m[1].padStart(3, "0");
    const prefix = kind === "alert" ? "CTIR-AL" : "CTIR-REC";
    return `${prefix}-${m[2]}-${num}`;
  }
  return `CTIR-${kind === "alert" ? "AL" : "REC"}-${year}-${title
    .replace(/[^A-Z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase()}`;
}

function parseRdfItems(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const re = /<item\b[^>]*rdf:about="([^"]+)"[\s\S]*?<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[0];
    const url = m[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").trim();
    const description = (block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "").trim();
    const date = (block.match(/<dc:date>([\s\S]*?)<\/dc:date>/)?.[1] ?? "").trim();
    if (!title || !url) continue;
    const published_at = date ? new Date(date).toISOString() : new Date(0).toISOString();
    items.push({ url, title, description, published_at });
  }
  return items;
}

interface FeedResult {
  modified: boolean;
  items: FeedItem[];
  status: number;
  etag: string | null;
  last_modified: string | null;
}

async function conditionalFetch(
  feedUrl: string,
  etag: string | null,
  lastModified: string | null,
): Promise<FeedResult> {
  const headers: Record<string, string> = { "User-Agent": UA, Accept: "application/rss+xml,application/xml,text/xml" };
  if (etag) headers["If-None-Match"] = etag;
  if (lastModified) headers["If-Modified-Since"] = lastModified;
  const res = await fetch(feedUrl, { headers });
  if (res.status === 304) {
    return { modified: false, items: [], status: 304, etag, last_modified: lastModified };
  }
  if (!res.ok) {
    return {
      modified: false, items: [], status: res.status,
      etag: res.headers.get("etag"), last_modified: res.headers.get("last-modified"),
    };
  }
  const xml = await res.text();
  return {
    modified: true,
    items: parseRdfItems(xml),
    status: res.status,
    etag: res.headers.get("etag"),
    last_modified: res.headers.get("last-modified"),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Parse options
  let force = false;
  let yearsBack = 1;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      force = body?.force === true;
      if (typeof body?.years_back === "number") yearsBack = Math.max(0, Math.min(5, body.years_back));
    }
    const url = new URL(req.url);
    if (url.searchParams.get("force") === "1") force = true;
  } catch (_e) { /* noop */ }

  const currentYear = new Date().getUTCFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - yearsBack; y--) years.push(y);

  const feeds: { url: string; kind: Kind; year: number }[] = [];
  for (const y of years) {
    feeds.push({ url: `${BASE}/alertas/${y}/RSS`, kind: "alert", year: y });
    feeds.push({ url: `${BASE}/recomendacoes/${y}/RSS`, kind: "recommendation", year: y });
  }

  // Load env ids once
  const { data: envs } = await supabase.from("monitored_environments").select("id");
  const envIds = (envs || []).map((e) => e.id);

  const totals = {
    feeds_checked: 0, feeds_changed: 0, feeds_skipped_304: 0,
    inserted: 0, updated: 0, unchanged: 0, assessments_created: 0, errors: 0,
  };

  for (const feed of feeds) {
    totals.feeds_checked++;
    try {
      const { data: state } = await supabase
        .from("ctir_sync_state")
        .select("etag,last_modified,last_item_published_at")
        .eq("feed_url", feed.url)
        .maybeSingle();

      const result = await conditionalFetch(
        feed.url,
        force ? null : state?.etag ?? null,
        force ? null : state?.last_modified ?? null,
      );

      if (result.status === 304) {
        totals.feeds_skipped_304++;
        await supabase.from("ctir_sync_state").upsert({
          feed_url: feed.url,
          etag: result.etag,
          last_modified: result.last_modified,
          last_status: 304,
          last_fetched_at: new Date().toISOString(),
        }, { onConflict: "feed_url" });
        continue;
      }

      if (!result.modified) {
        totals.errors++;
        console.warn(`[sync] feed ${feed.url} status=${result.status}`);
        continue;
      }

      totals.feeds_changed++;
      const cutoff = !force && state?.last_item_published_at
        ? new Date(state.last_item_published_at).getTime()
        : 0;

      let maxPublished = cutoff;

      for (const item of result.items) {
        const itemTs = new Date(item.published_at).getTime();
        if (itemTs > maxPublished) maxPublished = itemTs;
        if (itemTs <= cutoff) { totals.unchanged++; continue; }

        const code = buildCode(feed.kind, item.title, feed.year);
        const fullText = `${item.title} ${item.description}`;
        const payload = {
          code,
          title: item.title,
          kind: feed.kind,
          severity: detectSeverity(fullText),
          category: detectCategory(fullText),
          cves: extractCVEs(fullText),
          source: "CTIR Gov",
          source_url: item.url,
          published_at: item.published_at,
          description: item.description || null,
          synced_at: new Date().toISOString(),
        };

        const { data: existing } = await supabase
          .from("ctir_advisories")
          .select("id, published_at, title, severity, description")
          .eq("code", code)
          .maybeSingle();

        if (existing) {
          const noChange =
            existing.title === payload.title &&
            existing.severity === payload.severity &&
            (existing.description ?? null) === payload.description &&
            existing.published_at &&
            new Date(existing.published_at).getTime() === itemTs;
          if (noChange) { totals.unchanged++; continue; }
          const { error } = await supabase
            .from("ctir_advisories").update(payload).eq("id", existing.id);
          if (error) { totals.errors++; console.error("update", error); continue; }
          totals.updated++;
        } else {
          const { data, error } = await supabase
            .from("ctir_advisories").insert(payload).select("id").single();
          if (error || !data) { totals.errors++; console.error("insert", error); continue; }
          totals.inserted++;
          if (envIds.length > 0) {
            const rows = envIds.map((eid) => ({
              advisory_id: data.id, environment_id: eid,
              status: "pending" as const, affected_assets: 0,
            }));
            const { error: aErr } = await supabase
              .from("advisory_environment_assessments").insert(rows);
            if (!aErr) totals.assessments_created += rows.length;
          }
        }
      }

      await supabase.from("ctir_sync_state").upsert({
        feed_url: feed.url,
        etag: result.etag,
        last_modified: result.last_modified,
        last_status: result.status,
        last_fetched_at: new Date().toISOString(),
        last_item_published_at: maxPublished
          ? new Date(maxPublished).toISOString()
          : state?.last_item_published_at ?? null,
        items_seen: result.items.length,
      }, { onConflict: "feed_url" });
    } catch (e) {
      totals.errors++;
      console.error(`[sync] feed ${feed.url} error`, e);
    }
  }

  await supabase.from("audit_logs").insert({
    action: "sync_ctir_advisories",
    resource_type: "ctir_advisories",
    details: { ...totals, force, years_back: yearsBack, duration_ms: Date.now() - startedAt },
  });

  return new Response(JSON.stringify({ ok: true, ...totals, duration_ms: Date.now() - startedAt }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
