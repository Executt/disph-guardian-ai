import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ExternalLink, ShieldAlert } from "lucide-react";

type Vuln = {
  cve_id: string; published_at: string | null; last_modified: string | null;
  cvss_score: number | null; cvss_vector: string | null; severity: string | null;
  summary: string | null; cwe: string | null;
  refs: Array<{ url: string; source?: string }> | null;
  cpe_matches: string[] | null;
  matched_watch_ids: string[] | null;
};
type HistoryRow = { id: string; changed_at: string; field: string; old_value: any; new_value: any };

const SEV_COLOR: Record<string, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/30",
  high: "bg-warning/20 text-warning border-warning/30",
  medium: "bg-primary/20 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
  none: "bg-muted text-muted-foreground border-border",
};

function parseVector(v: string | null) {
  if (!v) return [];
  // e.g. "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
  return v.split("/").slice(1).map(p => {
    const [k, val] = p.split(":");
    return { k, val };
  });
}

const METRIC_LABEL: Record<string, string> = {
  AV: "Attack Vector", AC: "Attack Complexity", PR: "Privileges Required",
  UI: "User Interaction", S: "Scope", C: "Confidentiality", I: "Integrity", A: "Availability",
};

export default function CveDetailPage() {
  const { cveId = "" } = useParams();
  const [v, setV] = useState<Vuln | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [watches, setWatches] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [vd, hd, wd] = await Promise.all([
        supabase.from("nvd_vulnerabilities").select("*").eq("cve_id", cveId).maybeSingle(),
        supabase.from("nvd_vulnerability_history" as any).select("*").eq("cve_id", cveId).order("changed_at", { ascending: false }),
        supabase.from("nvd_watchlist").select("id,label"),
      ]);
      setV(vd.data as Vuln | null);
      setHistory((hd.data as HistoryRow[]) ?? []);
      setWatches(Object.fromEntries(((wd.data ?? []) as any[]).map(w => [w.id, w.label])));
      setLoading(false);
    })();
  }, [cveId]);

  if (loading) return <div className="p-6 text-sm font-mono">carregando…</div>;
  if (!v) return <div className="p-6 text-sm font-mono">CVE não encontrado.</div>;

  const vector = parseVector(v.cvss_vector);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/vulnerabilities"><Button variant="ghost" size="sm"><ArrowLeft className="h-3.5 w-3.5 mr-1" />Voltar</Button></Link>
        <a href={`https://nvd.nist.gov/vuln/detail/${v.cve_id}`} target="_blank" rel="noreferrer" className="ml-auto">
          <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5 mr-1" />Abrir no NVD</Button>
        </a>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="heading text-xl flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              {v.cve_id}
            </CardTitle>
            <div className="flex gap-2 items-center">
              <Badge variant="outline" className={`text-xs font-mono uppercase ${SEV_COLOR[v.severity ?? "none"]}`}>{v.severity ?? "—"}</Badge>
              {v.cvss_score != null && <Badge variant="outline" className="font-mono">CVSS {v.cvss_score}</Badge>}
              {v.cwe && <Badge variant="outline" className="font-mono">{v.cwe}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{v.summary}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono text-muted-foreground">
            <div>Publicado: {v.published_at ? new Date(v.published_at).toLocaleString("pt-BR") : "—"}</div>
            <div>Modificado: {v.last_modified ? new Date(v.last_modified).toLocaleString("pt-BR") : "—"}</div>
            <div>CPE afetados: {v.cpe_matches?.length ?? 0}</div>
            <div>Refs: {v.refs?.length ?? 0}</div>
          </div>
        </CardContent>
      </Card>

      {vector.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="heading text-sm">Vetor CVSS</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              {vector.map(m => (
                <div key={m.k} className="border border-border/40 rounded px-2 py-1">
                  <div className="text-[10px] uppercase text-muted-foreground">{METRIC_LABEL[m.k] ?? m.k}</div>
                  <div>{m.val}</div>
                </div>
              ))}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground mt-2 break-all">{v.cvss_vector}</div>
          </CardContent>
        </Card>
      )}

      {(v.matched_watch_ids?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="heading text-sm">Watchlist correspondente</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {v.matched_watch_ids!.map(id => (
              <Badge key={id} variant="outline" className="font-mono text-xs">{watches[id] ?? id.slice(0, 8)}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="heading text-sm">Referências</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs font-mono max-h-[400px] overflow-auto">
            {(v.refs ?? []).map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noreferrer"
                 className="block text-primary hover:underline truncate">
                {r.source ? `[${r.source}] ` : ""}{r.url}
              </a>
            ))}
            {(!v.refs || v.refs.length === 0) && <span className="text-muted-foreground">Sem referências.</span>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="heading text-sm">Histórico de mudanças</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs font-mono max-h-[400px] overflow-auto">
            {history.length === 0 && <span className="text-muted-foreground">Sem alterações registradas.</span>}
            {history.map(h => (
              <div key={h.id} className="border border-border/40 rounded px-2 py-1">
                <div className="flex justify-between">
                  <span className="text-primary">{h.field}</span>
                  <span className="text-muted-foreground">{new Date(h.changed_at).toLocaleString("pt-BR")}</span>
                </div>
                <div className="text-[11px]">
                  <span className="text-muted-foreground">{JSON.stringify(h.old_value)}</span>
                  {" → "}
                  <span>{JSON.stringify(h.new_value)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {(v.cpe_matches?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle className="heading text-sm">CPEs afetados ({v.cpe_matches!.length})</CardTitle></CardHeader>
          <CardContent className="text-[11px] font-mono max-h-[300px] overflow-auto space-y-0.5">
            {v.cpe_matches!.map((c, i) => <div key={i} className="text-muted-foreground">{c}</div>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
