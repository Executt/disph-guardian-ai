import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard } from "@/components/MetricCard";
import SyncStatusPanel from "@/components/SyncStatusPanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bug, RefreshCw, Plus, ShieldAlert, Activity, Search, Trash2 } from "lucide-react";

type Watch = {
  id: string; label: string; kind: string; value: string;
  category: string | null; enabled: boolean; severity_floor: string;
};
type Vuln = {
  cve_id: string; published_at: string | null; last_modified: string | null;
  cvss_score: number | null; severity: string | null; summary: string | null;
  cwe: string | null; matched_watch_ids: string[];
};

const SEV_COLOR: Record<string, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/30",
  high: "bg-warning/20 text-warning border-warning/30",
  medium: "bg-primary/20 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
  none: "bg-muted text-muted-foreground border-border",
};

export default function VulnerabilitiesPage() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [vulns, setVulns] = useState<Vuln[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState<string>("all");

  // Novo item da watchlist
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newKind, setNewKind] = useState<"keyword" | "cpe" | "vendor" | "product">("keyword");

  const load = async () => {
    setLoading(true);
    const [w, v] = await Promise.all([
      supabase.from("nvd_watchlist").select("*").order("label"),
      supabase.from("nvd_vulnerabilities").select("*").order("published_at", { ascending: false }).limit(500),
    ]);
    setWatches((w.data as Watch[]) ?? []);
    setVulns((v.data as Vuln[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runSync = async (force = false) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-nvd-vulnerabilities", {
        body: { force, days_back: force ? 90 : 30 },
      });
      if (error) throw error;
      toast.success(`Sync NVD: ${data?.upserts ?? 0} CVEs · ${data?.cve_seen ?? 0} vistos`);
      await load();
    } catch (e: any) {
      toast.error(`Falha no sync NVD: ${e?.message ?? e}`);
    } finally { setSyncing(false); }
  };

  const toggleWatch = async (w: Watch, enabled: boolean) => {
    const { error } = await supabase.from("nvd_watchlist").update({ enabled }).eq("id", w.id);
    if (error) return toast.error(error.message);
    setWatches(watches.map(x => x.id === w.id ? { ...x, enabled } : x));
  };

  const addWatch = async () => {
    if (!newLabel || !newValue) return toast.error("Informe label e valor");
    if (newKind === "cpe" && !/^cpe:2\.3:[aho]:/i.test(newValue)) {
      return toast.error("CPE inválido — deve começar com cpe:2.3:a|h|o:");
    }
    const dup = watches.find(w => w.kind === newKind && w.value.toLowerCase() === newValue.toLowerCase());
    if (dup) return toast.error(`Já existe: "${dup.label}"`);
    const { error } = await supabase.from("nvd_watchlist").insert({
      label: newLabel, value: newValue, kind: newKind, category: "custom",
    });
    if (error) return toast.error(error.message);
    toast.success("Watch adicionado — será reprocessado no próximo sync");
    setNewLabel(""); setNewValue("");
    await load();
  };

  const removeWatch = async (w: Watch) => {
    if (!confirm(`Remover "${w.label}"?`)) return;
    const { error } = await supabase.from("nvd_watchlist").delete().eq("id", w.id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    await load();
  };

  const filtered = useMemo(() => {
    return vulns.filter(v => {
      if (sevFilter !== "all" && v.severity !== sevFilter) return false;
      if (search && !`${v.cve_id} ${v.summary ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [vulns, search, sevFilter]);

  const kpis = useMemo(() => {
    const crit = vulns.filter(v => v.severity === "critical").length;
    const high = vulns.filter(v => v.severity === "high").length;
    const last7 = vulns.filter(v => v.published_at && Date.now() - new Date(v.published_at).getTime() < 7 * 86_400_000).length;
    return { crit, high, last7, total: vulns.length };
  }, [vulns]);

  const watchById = Object.fromEntries(watches.map(w => [w.id, w]));

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold heading text-foreground">Vulnerabilidades · NVD</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            CVEs coletados da NVD 2.0 filtrados por watchlist de fabricantes, produtos e palavras-chave
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => runSync(false)} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
          <Button variant="secondary" size="sm" onClick={() => runSync(true)} disabled={syncing}>
            Forçar 90d
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="CVEs Total" value={kpis.total} icon={Bug} />
        <MetricCard title="Críticos" value={kpis.crit} icon={ShieldAlert} trend={kpis.crit > 0 ? "down" : "up"} />
        <MetricCard title="Altos" value={kpis.high} icon={Activity} />
        <MetricCard title="Últimos 7 dias" value={kpis.last7} icon={RefreshCw} />
      </div>

      <Tabs defaultValue="vulns">
        <TabsList>
          <TabsTrigger value="vulns">CVEs</TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist ({watches.length})</TabsTrigger>
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
        </TabsList>

        <TabsContent value="vulns" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="h-9 pl-7 text-xs font-mono"
                    placeholder="Buscar por CVE ou descrição…"
                    value={search} onChange={e => setSearch(e.target.value)}
                  />
                </div>
                {["all", "critical", "high", "medium", "low"].map(s => (
                  <Button key={s} variant={sevFilter === s ? "default" : "outline"} size="sm"
                    onClick={() => setSevFilter(s)} className="text-xs h-8">
                    {s === "all" ? "Todos" : s}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-mono uppercase">CVE</TableHead>
                      <TableHead className="text-[10px] font-mono uppercase">Sev</TableHead>
                      <TableHead className="text-[10px] font-mono uppercase">CVSS</TableHead>
                      <TableHead className="text-[10px] font-mono uppercase">Publicado</TableHead>
                      <TableHead className="text-[10px] font-mono uppercase">Watchlist</TableHead>
                      <TableHead className="text-[10px] font-mono uppercase">Resumo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && (<TableRow><TableCell colSpan={6} className="text-center text-xs font-mono py-6">carregando…</TableCell></TableRow>)}
                    {!loading && filtered.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-xs font-mono py-6 text-muted-foreground">
                        Nenhum CVE. Clique em <b>Sincronizar</b> para coletar da NVD.
                      </TableCell></TableRow>
                    )}
                    {filtered.slice(0, 200).map(v => (
                      <TableRow key={v.cve_id}>
                        <TableCell className="font-mono text-xs">
                          <Link to={`/vulnerabilities/${v.cve_id}`} className="text-primary hover:underline">
                            {v.cve_id}
                          </Link>
                        </TableCell>
                        <TableCell><Badge variant="outline" className={`text-[10px] font-mono uppercase ${SEV_COLOR[v.severity ?? "none"]}`}>{v.severity ?? "—"}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{v.cvss_score ?? "—"}</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">{v.published_at ? new Date(v.published_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap max-w-[180px]">
                            {(v.matched_watch_ids ?? []).slice(0, 2).map(id => (
                              <Badge key={id} variant="outline" className="text-[9px] font-mono">{watchById[id]?.label ?? id.slice(0, 6)}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs max-w-[500px] truncate">{v.summary}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="watchlist" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base heading">Adicionar item</CardTitle>
              <CardDescription className="text-xs font-mono">keyword: busca textual · cpe: identificador CPE 2.3 · vendor/product: nome do fabricante ou produto</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[160px]"><label className="text-[10px] font-mono uppercase text-muted-foreground">Label</label><Input value={newLabel} onChange={e => setNewLabel(e.target.value)} className="h-9 text-xs" /></div>
                <div className="flex-1 min-w-[160px]"><label className="text-[10px] font-mono uppercase text-muted-foreground">Valor</label><Input value={newValue} onChange={e => setNewValue(e.target.value)} className="h-9 text-xs font-mono" placeholder="ex.: kubernetes ou cpe:2.3:a:..." /></div>
                <div><label className="text-[10px] font-mono uppercase text-muted-foreground">Tipo</label>
                  <select value={newKind} onChange={e => setNewKind(e.target.value as any)} className="h-9 text-xs bg-background border border-border rounded px-2">
                    <option value="keyword">keyword</option>
                    <option value="cpe">cpe</option>
                    <option value="vendor">vendor</option>
                    <option value="product">product</option>
                  </select>
                </div>
                <Button size="sm" onClick={addWatch}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-mono uppercase">Ativo</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase">Label</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase">Tipo</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase">Valor</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase">Categoria</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase">Min. Sev.</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {watches.map(w => (
                    <TableRow key={w.id}>
                      <TableCell><Switch checked={w.enabled} onCheckedChange={v => toggleWatch(w, v)} /></TableCell>
                      <TableCell className="text-xs">{w.label}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] font-mono">{w.kind}</Badge></TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground max-w-[300px] truncate">{w.value}</TableCell>
                      <TableCell className="text-[11px] font-mono text-muted-foreground">{w.category ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-[10px] font-mono uppercase ${SEV_COLOR[w.severity_floor]}`}>{w.severity_floor}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeWatch(w)} className="h-7 w-7 p-0">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-3">
          <SyncStatusPanel source="nvd" functionName="sync-nvd-vulnerabilities" />
          <SyncStatusPanel source="ctir" functionName="sync-ctir-advisories" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
