import { useEffect, useMemo, useState } from "react";
import {
  ShieldAlert, Search, ExternalLink, CheckCircle2, AlertTriangle,
  XCircle, Clock, TrendingUp, Database, Server, Lock, FileWarning,
  Activity, Eye, Zap, BarChart3, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Database as DB } from "@/integrations/supabase/types";
import { RefreshCw, Rss } from "lucide-react";

type Severity = DB["public"]["Enums"]["advisory_severity"];
type Compliance = DB["public"]["Enums"]["compliance_status"];
type Kind = DB["public"]["Enums"]["advisory_kind"];

type Advisory = DB["public"]["Tables"]["ctir_advisories"]["Row"];
type Environment = DB["public"]["Tables"]["monitored_environments"]["Row"];
type Assessment = DB["public"]["Tables"]["advisory_environment_assessments"]["Row"];
type SyncState = DB["public"]["Tables"]["ctir_sync_state"]["Row"];

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function statusTone(status: number | null): string {
  if (!status) return "bg-muted text-muted-foreground border-border";
  if (status === 304) return "bg-accent/15 text-accent border-accent/30";
  if (status >= 200 && status < 300) return "bg-primary/15 text-primary border-primary/30";
  if (status >= 400) return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-warning/15 text-warning border-warning/30";
}

interface AdvisoryView extends Advisory {
  affectedAssets: number;
  totalAssets: number;
  worstStatus: Compliance;
  envCount: number;
}

const SEVERITY_STYLE: Record<Severity, { label: string; cls: string; icon: typeof ShieldAlert }> = {
  critical: { label: "Crítico", cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
  high: { label: "Alto", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: AlertTriangle },
  medium: { label: "Médio", cls: "bg-warning/15 text-warning border-warning/30", icon: Clock },
  low: { label: "Baixo", cls: "bg-accent/15 text-accent border-accent/30", icon: CheckCircle2 },
};

const COMPLIANCE_STYLE: Record<Compliance, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  compliant: { label: "Conforme", cls: "bg-accent/15 text-accent border-accent/30", icon: CheckCircle2 },
  partial: { label: "Parcial", cls: "bg-warning/15 text-warning border-warning/30", icon: AlertTriangle },
  non_compliant: { label: "Não Conforme", cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
  not_applicable: { label: "N/A", cls: "bg-muted text-muted-foreground border-border", icon: Eye },
  pending: { label: "Pendente", cls: "bg-secondary text-muted-foreground border-border", icon: Clock },
};

// Worst-status ranking for rollup per advisory
const STATUS_RANK: Record<Compliance, number> = {
  non_compliant: 4, pending: 3, partial: 2, compliant: 1, not_applicable: 0,
};

export default function ARPage() {
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [syncStates, setSyncStates] = useState<SyncState[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");
  const [compliance, setCompliance] = useState<string>("all");
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [selected, setSelected] = useState<AdvisoryView | null>(null);

  async function loadAll() {
    const [a, e, s, st] = await Promise.all([
      supabase.from("ctir_advisories").select("*").order("published_at", { ascending: false }),
      supabase.from("monitored_environments").select("*").order("name"),
      supabase.from("advisory_environment_assessments").select("*"),
      supabase.from("ctir_sync_state").select("*").order("last_fetched_at", { ascending: false }),
    ]);
    if (a.error || e.error || s.error) {
      toast({ title: "Erro ao carregar dados", description: a.error?.message ?? e.error?.message ?? s.error?.message, variant: "destructive" });
    }
    setAdvisories(a.data ?? []);
    setEnvironments(e.data ?? []);
    setAssessments(s.data ?? []);
    setSyncStates(st.data ?? []);
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      await loadAll();
      if (!cancel) setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  async function runSync(force = false) {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-ctir-advisories", {
        body: { force },
      });
      if (error) throw error;
      toast({ title: "Sincronização concluída", description: `Inseridos: ${data?.inserted ?? 0} · Atualizados: ${data?.updated ?? 0} · Pulados: ${data?.skipped ?? 0}` });
      await loadAll();
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  // Compose enriched advisory views (with cross-env rollup)
  const views: AdvisoryView[] = useMemo(() => {
    return advisories.map((adv) => {
      const related = assessments.filter((x) => x.advisory_id === adv.id &&
        (envFilter === "all" || x.environment_id === envFilter));
      const affectedAssets = related.reduce((s, x) => s + (x.affected_assets ?? 0), 0);
      const totalAssets = related.reduce((sum, x) => {
        const env = environments.find((e) => e.id === x.environment_id);
        return sum + (env?.total_assets ?? 0);
      }, 0);
      const worstStatus = related.reduce<Compliance>((acc, x) =>
        STATUS_RANK[x.status] > STATUS_RANK[acc] ? x.status : acc, "not_applicable");
      return { ...adv, affectedAssets, totalAssets, worstStatus, envCount: related.length };
    });
  }, [advisories, assessments, environments, envFilter]);

  const filtered = useMemo(() => {
    return views.filter((a) => {
      if (envFilter !== "all" && a.envCount === 0) return false;
      if (search && !a.title.toLowerCase().includes(search.toLowerCase()) &&
          !a.code.toLowerCase().includes(search.toLowerCase())) return false;
      if (severity !== "all" && a.severity !== severity) return false;
      if (kind !== "all" && a.kind !== kind) return false;
      if (compliance !== "all" && a.worstStatus !== compliance) return false;
      return true;
    });
  }, [views, search, severity, kind, compliance, envFilter]);

  const stats = useMemo(() => {
    const total = views.length;
    const critical = views.filter((a) => a.severity === "critical").length;
    const nonCompliant = views.filter((a) => a.worstStatus === "non_compliant").length;
    const partial = views.filter((a) => a.worstStatus === "partial").length;
    const compliant = views.filter((a) => a.worstStatus === "compliant").length;
    const totalAffected = views.reduce((s, a) => s + a.affectedAssets, 0);
    const score = total ? Math.round((compliant / total) * 100) : 0;
    return { total, critical, nonCompliant, partial, compliant, totalAffected, score };
  }, [views]);

  const selectedAssessments = useMemo(() => {
    if (!selected) return [];
    return assessments
      .filter((x) => x.advisory_id === selected.id)
      .map((x) => ({ ...x, env: environments.find((e) => e.id === x.environment_id) }));
  }, [selected, assessments, environments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-mono text-xs">Carregando alertas e ambientes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8">
        <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-mono text-[10px]">
                MÓDULO AR · CTIR Gov
              </Badge>
              <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30 font-mono text-[10px]">
                <Activity className="h-3 w-3 mr-1" /> {environments.length} AMBIENTES
              </Badge>
            </div>
            <h1 className="heading text-3xl lg:text-4xl font-bold mb-3 tracking-tight">
              Alertas e Recomendações
            </h1>
            <p className="text-muted-foreground text-sm lg:text-base mb-4">
              Catálogo CTIR persistido em PostgreSQL e correlacionado em tempo real com os ambientes monitorados.
              Análise cruzada com priorização por severidade e gap de compliance.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-2">
                <Zap className="h-4 w-4" /> Sincronizar com CTIR
              </Button>
              <Button size="sm" variant="outline" className="gap-2" asChild>
                <a href="https://www.gov.br/ctir/pt-br/assuntos/alertas-e-recomendacoes" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Fonte Oficial CTIR
                </a>
              </Button>
            </div>
          </div>
          <Card className="w-full lg:w-80 shrink-0 border-primary/20 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-[10px] tracking-wider">SECURITY POSTURE SCORE</CardDescription>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold heading text-primary">{stats.score}</span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={stats.score} className="h-2" />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>{stats.compliant} conformes</span>
                <span>{stats.partial} parciais</span>
                <span className="text-destructive">{stats.nonCompliant} críticos</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={ShieldAlert} label="Total Alertas/Recs" value={stats.total} hint="Sincronizados CTIR" tone="primary" />
        <KpiCard icon={XCircle} label="Severidade Crítica" value={stats.critical} hint="Ação imediata" tone="destructive" />
        <KpiCard icon={FileWarning} label="Não Conformes" value={stats.nonCompliant} hint="Gap de compliance" tone="warning" />
        <KpiCard icon={Server} label="Ativos Afetados" value={stats.totalAffected} hint="Cross-env exposure" tone="accent" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cross" className="space-y-4">
        <TabsList className="grid grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="cross" className="gap-2"><BarChart3 className="h-3.5 w-3.5" /> Análise Cruzada</TabsTrigger>
          <TabsTrigger value="catalog" className="gap-2"><Database className="h-3.5 w-3.5" /> Catálogo CTIR</TabsTrigger>
          <TabsTrigger value="environments" className="gap-2"><Lock className="h-3.5 w-3.5" /> Ambientes</TabsTrigger>
        </TabsList>

        {/* Análise Cruzada */}
        <TabsContent value="cross" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <CardTitle className="heading text-lg">Correlação Ambiente × CTIR</CardTitle>
                  <CardDescription>Análise automática do gap entre alertas publicados e ativos monitorados</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar AR ou CVE..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-9 pl-8 w-56 text-xs"
                    />
                  </div>
                  <Select value={envFilter} onValueChange={setEnvFilter}>
                    <SelectTrigger className="h-9 w-44 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos ambientes</SelectItem>
                      {environments.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos tipos</SelectItem>
                      <SelectItem value="alert">Alertas</SelectItem>
                      <SelectItem value="recommendation">Recomendações</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Severidade</SelectItem>
                      <SelectItem value="critical">Crítico</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                      <SelectItem value="medium">Médio</SelectItem>
                      <SelectItem value="low">Baixo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={compliance} onValueChange={setCompliance}>
                    <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Compliance</SelectItem>
                      <SelectItem value="compliant">Conforme</SelectItem>
                      <SelectItem value="partial">Parcial</SelectItem>
                      <SelectItem value="non_compliant">Não Conforme</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Código</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Título</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Severidade</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Categoria</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Exposição</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Compliance</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const SevIcon = SEVERITY_STYLE[a.severity].icon;
                    const CompIcon = COMPLIANCE_STYLE[a.worstStatus].icon;
                    const exposure = a.totalAssets > 0 ? Math.round((a.affectedAssets / a.totalAssets) * 100) : 0;
                    return (
                      <TableRow key={a.id} className="cursor-pointer" onClick={() => setSelected(a)}>
                        <TableCell className="font-mono text-xs text-primary">{a.code}</TableCell>
                        <TableCell className="max-w-md">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] font-mono uppercase">
                              {a.kind === "alert" ? "ALT" : "REC"}
                            </Badge>
                            <span className="text-sm truncate">{a.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-mono uppercase gap-1 ${SEVERITY_STYLE[a.severity].cls}`}>
                            <SevIcon className="h-3 w-3" />
                            {SEVERITY_STYLE[a.severity].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.category}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[140px]">
                            <Progress value={exposure} className="h-1.5 flex-1" />
                            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                              {a.affectedAssets}/{a.totalAssets}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-mono uppercase gap-1 ${COMPLIANCE_STYLE[a.worstStatus].cls}`}>
                            <CompIcon className="h-3 w-3" />
                            {COMPLIANCE_STYLE[a.worstStatus].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-xs">Detalhar</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                        Nenhum item encontrado para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Catálogo */}
        <TabsContent value="catalog" className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((a) => {
              const SevIcon = SEVERITY_STYLE[a.severity].icon;
              return (
                <Card key={a.id} className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => setSelected(a)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className="text-[9px] font-mono uppercase">
                        {a.kind === "alert" ? "ALERTA" : "RECOMENDAÇÃO"}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] font-mono uppercase gap-1 ${SEVERITY_STYLE[a.severity].cls}`}>
                        <SevIcon className="h-3 w-3" />
                        {SEVERITY_STYLE[a.severity].label}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm leading-snug heading">{a.title}</CardTitle>
                    <CardDescription className="font-mono text-[10px]">
                      {a.code} · {a.published_at?.slice(0, 10) ?? "—"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                    {a.cves && a.cves.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {a.cves.map((c) => (
                          <Badge key={c} variant="outline" className="text-[9px] font-mono">{c}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {a.envCount} amb · {a.affectedAssets}/{a.totalAssets} ativos
                      </span>
                      <Badge variant="outline" className={`text-[10px] font-mono ${COMPLIANCE_STYLE[a.worstStatus].cls}`}>
                        {COMPLIANCE_STYLE[a.worstStatus].label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Ambientes */}
        <TabsContent value="environments" className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {environments.map((env) => {
              const envAssessments = assessments.filter((x) => x.environment_id === env.id);
              const compliant = envAssessments.filter((x) => x.status === "compliant").length;
              const total = envAssessments.length;
              const pct = total ? Math.round((compliant / total) * 100) : 0;
              const affected = envAssessments.reduce((s, x) => s + (x.affected_assets ?? 0), 0);
              return (
                <Card key={env.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base heading">{env.name}</CardTitle>
                        <CardDescription className="text-xs">{env.description}</CardDescription>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-mono uppercase">{env.type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold heading">{env.total_assets}</p>
                        <p className="text-[9px] font-mono uppercase text-muted-foreground">Ativos</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold heading text-destructive">{affected}</p>
                        <p className="text-[9px] font-mono uppercase text-muted-foreground">Afetados</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold heading text-accent">{pct}%</p>
                        <p className="text-[9px] font-mono uppercase text-muted-foreground">Conforme</p>
                      </div>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(env.tags ?? []).map((t) => (
                        <Badge key={t} variant="outline" className="text-[9px] font-mono">{t}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog detalhe */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{selected.code}</Badge>
                  <Badge variant="outline" className={`font-mono text-[10px] ${SEVERITY_STYLE[selected.severity].cls}`}>
                    {SEVERITY_STYLE[selected.severity].label}
                  </Badge>
                  <Badge variant="outline" className={`font-mono text-[10px] ${COMPLIANCE_STYLE[selected.worstStatus].cls}`}>
                    {COMPLIANCE_STYLE[selected.worstStatus].label}
                  </Badge>
                </div>
                <DialogTitle className="heading">{selected.title}</DialogTitle>
                <DialogDescription className="font-mono text-xs">
                  {selected.source} · Publicado em {selected.published_at?.slice(0, 10) ?? "—"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <section>
                  <h4 className="font-semibold mb-1 text-xs uppercase tracking-wider text-muted-foreground">Descrição</h4>
                  <p className="text-muted-foreground">{selected.description}</p>
                </section>
                <section>
                  <h4 className="font-semibold mb-1 text-xs uppercase tracking-wider text-muted-foreground">Recomendação</h4>
                  <p className="text-muted-foreground">{selected.recommendation}</p>
                </section>
                {selected.cves && selected.cves.length > 0 && (
                  <section>
                    <h4 className="font-semibold mb-1 text-xs uppercase tracking-wider text-muted-foreground">CVEs</h4>
                    <div className="flex flex-wrap gap-1">
                      {selected.cves.map((c) => (
                        <Badge key={c} variant="outline" className="font-mono text-xs">{c}</Badge>
                      ))}
                    </div>
                  </section>
                )}
                <section>
                  <h4 className="font-semibold mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                    Avaliação por Ambiente
                  </h4>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-mono text-[10px] uppercase">Ambiente</TableHead>
                          <TableHead className="font-mono text-[10px] uppercase">Status</TableHead>
                          <TableHead className="font-mono text-[10px] uppercase text-right">Afetados</TableHead>
                          <TableHead className="font-mono text-[10px] uppercase">Notas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedAssessments.map((x) => (
                          <TableRow key={x.id}>
                            <TableCell className="text-xs">{x.env?.name ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] font-mono ${COMPLIANCE_STYLE[x.status].cls}`}>
                                {COMPLIANCE_STYLE[x.status].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {x.affected_assets} / {x.env?.total_assets ?? 0}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{x.notes ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                        {selectedAssessments.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">
                              Nenhuma avaliação registrada para este advisory.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </section>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="gap-2"><Zap className="h-3.5 w-3.5" /> Criar Plano de Remediação</Button>
                  {selected.source_url && (
                    <Button size="sm" variant="outline" className="gap-2" asChild>
                      <a href={selected.source_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Ver no CTIR
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint, tone }: {
  icon: typeof ShieldAlert; label: string; value: number; hint: string;
  tone: "primary" | "destructive" | "warning" | "accent";
}) {
  const toneCls = {
    primary: "text-primary bg-primary/10 border-primary/20",
    destructive: "text-destructive bg-destructive/10 border-destructive/20",
    warning: "text-warning bg-warning/10 border-warning/20",
    accent: "text-accent bg-accent/10 border-accent/20",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-9 w-9 rounded-lg border flex items-center justify-center ${toneCls}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold heading">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  );
}
