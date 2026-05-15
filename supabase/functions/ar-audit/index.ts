// Edge Function: ar-audit
// Returns advisory ordering audit data with filters (year, sort_source), pagination
// and deterministic ordering matching the AR page audit tab.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type SortSource = "code" | "published_at" | "fallback";

interface AuditRow {
  id: string;
  code: string;
  title: string;
  kind: string;
  severity: string;
  source_url: string | null;
  published_at: string | null;
  synced_at: string;
  sort_year: number;
  sort_num: number;
  sort_source: SortSource;
  published_year: number | null;
  divergent: boolean;
}

function codeYearNum(code: string): { year: number; num: number } | null {
  if (!code) return null;
  const m = code.match(/-(\d{4})-(\d+)/);
  if (!m) return null;
  return { year: parseInt(m[1], 10), num: parseInt(m[2], 10) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const yearsParam = url.searchParams.get("years"); // e.g. "2024,2025,2026"
    const sourcesParam = url.searchParams.get("sources"); // e.g. "code,fallback"
    const kindParam = url.searchParams.get("kind"); // alert | recommendation
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      500,
      Math.max(1, parseInt(url.searchParams.get("page_size") ?? "50", 10) || 50),
    );
    const onlyDivergent = url.searchParams.get("only_divergent") === "true";

    const yearsFilter = yearsParam
      ? new Set(
          yearsParam
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !Number.isNaN(n)),
        )
      : null;
    const sourcesFilter = sourcesParam
      ? new Set(
          sourcesParam
            .split(",")
            .map((s) => s.trim()) as SortSource[],
        )
      : null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Verify caller is authenticated (any authenticated role can read audit).
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase
      .from("ctir_advisories")
      .select(
        "id, code, title, kind, severity, source_url, published_at, synced_at",
      );
    if (kindParam === "alert" || kindParam === "recommendation") {
      query = query.eq("kind", kindParam);
    }
    const { data, error } = await query.limit(5000);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build audit rows with deterministic sort metadata.
    const rows: AuditRow[] = (data ?? []).map((adv) => {
      const parsed = codeYearNum(adv.code);
      const publishedYear = adv.published_at
        ? new Date(adv.published_at).getUTCFullYear()
        : null;

      let sortYear: number;
      let sortNum: number;
      let sortSource: SortSource;
      if (parsed) {
        sortYear = parsed.year;
        sortNum = parsed.num;
        sortSource = "code";
      } else if (publishedYear) {
        sortYear = publishedYear;
        sortNum = 0;
        sortSource = "published_at";
      } else {
        sortYear = 0;
        sortNum = 0;
        sortSource = "fallback";
      }
      const divergent =
        sortSource === "code" &&
        publishedYear !== null &&
        publishedYear !== sortYear;

      return {
        id: adv.id,
        code: adv.code,
        title: adv.title,
        kind: adv.kind,
        severity: adv.severity,
        source_url: adv.source_url,
        published_at: adv.published_at,
        synced_at: adv.synced_at,
        sort_year: sortYear,
        sort_num: sortNum,
        sort_source: sortSource,
        published_year: publishedYear,
        divergent,
      };
    });

    // Apply filters.
    const filtered = rows.filter((r) => {
      if (yearsFilter && !yearsFilter.has(r.sort_year)) return false;
      if (sourcesFilter && !sourcesFilter.has(r.sort_source)) return false;
      if (onlyDivergent && !r.divergent) return false;
      return true;
    });

    // Deterministic ordering: sort_year DESC, sort_num DESC,
    // published_at DESC, code DESC, id ASC (stable tiebreaker).
    filtered.sort((a, b) => {
      if (a.sort_year !== b.sort_year) return b.sort_year - a.sort_year;
      if (a.sort_num !== b.sort_num) return b.sort_num - a.sort_num;
      const pa = a.published_at ?? "";
      const pb = b.published_at ?? "";
      if (pa !== pb) return pb.localeCompare(pa);
      if (a.code !== b.code) return b.code.localeCompare(a.code);
      return a.id.localeCompare(b.id);
    });

    // Aggregate stats over the filtered set.
    const stats = {
      total: filtered.length,
      by_source: {
        code: filtered.filter((r) => r.sort_source === "code").length,
        published_at: filtered.filter((r) => r.sort_source === "published_at")
          .length,
        fallback: filtered.filter((r) => r.sort_source === "fallback").length,
      },
      divergent: filtered.filter((r) => r.divergent).length,
      years: Array.from(new Set(filtered.map((r) => r.sort_year))).sort(
        (a, b) => b - a,
      ),
    };

    // Paginate.
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return new Response(
      JSON.stringify({
        items,
        stats,
        pagination: {
          page: safePage,
          page_size: pageSize,
          total: filtered.length,
          total_pages: totalPages,
        },
        filters: {
          years: yearsFilter ? Array.from(yearsFilter) : null,
          sources: sourcesFilter ? Array.from(sourcesFilter) : null,
          kind: kindParam ?? null,
          only_divergent: onlyDivergent,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
