// Sync CTIR Gov advisories incrementally
// Strategy:
//  1. For each feed (alertas/recomendacoes × year), do a conditional GET using
//     stored ETag / Last-Modified -> 304 means skip entirely.
//  2. Parse the RSS/RDF, extract items with <dc:date>; if CTIR serves HTML,
//     parse the Plone listing as fallback.
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
// Fallback: caminho institucional atual em /gsi/ separado por tipo.
const BASE_GSI = "https://www.gov.br/gsi/pt-br/assuntos/ctir";
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

function decodeHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBrDate(value: string | null): string {
  if (!value) return new Date().toISOString();
  const m = value.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})h(?:(\d{2}))?/);
  if (!m) return new Date().toISOString();
  const [, dd, mm, yyyy, hh, min = "00"] = m;
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00-03:00`).toISOString();
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

function parseHtmlListing(html: string): FeedItem[] {
  const items: FeedItem[] = [];
  const articleRe = /<article\b[\s\S]*?class="[^"]*\bentry\b[^"]*"[\s\S]*?<\/article>/gi;
  let m: RegExpExecArray | null;
  while ((m = articleRe.exec(html)) !== null) {
    const block = m[0];
    const link = block.match(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const url = link[1].replace(/&amp;/g, "&");
    const title = decodeHtml(link[2]);
    const description = decodeHtml(
      block.match(/<p\b[^>]*class="[^"]*\bdescription\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "",
    );
    const modified = block.match(/última\s+modifica(?:ç|&ccedil;)ão\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}h\d{0,2})/i)?.[1]
      ?? block.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}h\d{0,2})/)?.[1]
      ?? null;
    if (!title || !url) continue;
    items.push({ url, title, description, published_at: parseBrDate(modified) });
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
  const rdfItems = parseRdfItems(xml);
  const items = rdfItems.length > 0 ? rdfItems : parseHtmlListing(xml);
  return {
    modified: true,
    items,
    status: res.status,
    etag: res.headers.get("etag"),
    last_modified: res.headers.get("last-modified"),
  };
}

// Retry com backoff exponencial + jitter
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  shouldRetry: (result: T | null, err: unknown) => boolean,
  onAttemptFail: (attempt: number, reason: string) => Promise<void>,
  attempts = 3,
  baseMs = 800,
): Promise<T> {
  let lastErr: unknown = null;
  let lastRes: T | null = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      lastRes = await fn();
      if (!shouldRetry(lastRes, null)) return lastRes;
      await onAttemptFail(i, `retryable_result`);
    } catch (e) {
      lastErr = e;
      await onAttemptFail(i, (e as Error)?.message ?? String(e));
      if (!shouldRetry(null, e)) break;
    }
    if (i < attempts) {
      const delay = baseMs * Math.pow(2, i - 1) + Math.floor(Math.random() * 250);
      console.log(`[retry] ${label} attempt ${i} failed, waiting ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  if (lastRes !== null) return lastRes;
  throw lastErr ?? new Error(`${label} failed after ${attempts} attempts`);
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
  let yearsBack = 2; // ano corrente + 2 anteriores
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
    inserted: 0, updated: 0, unchanged: 0, assessments_created: 0, errors: 0, retries: 0,
  };

  // Parse trigger_source
  let trigger_source: "cron" | "manual" = "manual";
  try {
    if (req.method === "POST") {
      const bodyClone = req.clone();
      const b = await bodyClone.json().catch(() => ({} as any));
      if (b?.trigger_source === "cron") trigger_source = "cron";
    }
  } catch { /* noop */ }

  const retryableStatus = (s: number) => s === 0 || s === 408 || s === 429 || (s >= 500 && s < 600);
  const logRetry = async (feedUrl: string, attempt: number, reason: string) => {
    totals.retries++;
    await supabase.from("sync_alerts" as any).insert({
      source: "ctir", kind: "retry", severity: "warning",
      message: `Tentativa ${attempt} falhou em ${feedUrl}`,
      details: { feed_url: feedUrl, attempt, reason },
    }).then(() => {}, () => {});
  };


  for (const feed of feeds) {
    totals.feeds_checked++;
    try {
      const { data: state } = await supabase
        .from("ctir_sync_state")
        .select("etag,last_modified,last_item_published_at")
        .eq("feed_url", feed.url)
        .maybeSingle();

      let result = await withRetry<FeedResult>(
        `fetch ${feed.url}`,
        () => conditionalFetch(feed.url, force ? null : state?.etag ?? null, force ? null : state?.last_modified ?? null),
        (r, err) => {
          if (err) return true;
          if (!r) return true;
          if (r.status === 304) return false;
          if (!r.modified && retryableStatus(r.status)) return true;
          return false;
        },
        (attempt, reason) => logRetry(feed.url, attempt, reason),
      );

      // Fallback para GSI se o feed CTIR falhar ou vier vazio.
      if ((!result.modified && result.status !== 304) || (result.modified && result.items.length === 0)) {
        const kindPath = feed.kind === "alert" ? "alertas" : "recomendacoes";
        const gsiUrl = `${BASE_GSI}/${kindPath}/${feed.year}`;
        console.log(`[sync] fallback GSI ${gsiUrl}`);
        const alt = await withRetry<FeedResult>(
          `fallback ${gsiUrl}`,
          () => conditionalFetch(gsiUrl, null, null),
          (r, err) => {
            if (err) return true;
            if (!r) return true;
            if (!r.modified && retryableStatus(r.status)) return true;
            return false;
          },
          (attempt, reason) => logRetry(gsiUrl, attempt, reason),
        );
        if (alt.modified && alt.items.length > 0) {
          result = alt;
          feed.url = gsiUrl;
        }
      }


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
      const reason = (e as Error)?.message ?? String(e);
      console.error(`[sync] feed ${feed.url} error`, e);
      await supabase.from("sync_alerts" as any).insert({
        source: "ctir", kind: "feed_error", severity: "error",
        message: `Falha ao processar ${feed.url}: ${reason}`,
        details: { feed_url: feed.url, reason },
      }).then(() => {}, () => {});
    }
  }

  await supabase.from("audit_logs").insert({
    action: "sync_ctir_advisories",
    resource_type: "ctir_advisories",
    details: { ...totals, force, years_back: yearsBack, trigger_source, duration_ms: Date.now() - startedAt },
  });


  // Alertas de inconsistência
  try {
    if (totals.errors > 0) {
      await supabase.functions.invoke("notify-sync-failure", {
        body: {
          source: "ctir", kind: "http_error", severity: "error",
          message: `${totals.errors} feed(s) do CTIR falharam`,
          details: totals,
        },
      });
    } else if (totals.feeds_changed > 0 && totals.inserted === 0 && totals.updated === 0) {
      await supabase.functions.invoke("notify-sync-failure", {
        body: {
          source: "ctir", kind: "empty_feed", severity: "warning",
          message: "Feeds retornaram conteúdo mas sem novos itens/alterações",
          details: totals,
        },
      });
    }
  } catch (e) { console.warn("notify skip", e); }

  return new Response(JSON.stringify({ ok: true, ...totals, duration_ms: Date.now() - startedAt }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
