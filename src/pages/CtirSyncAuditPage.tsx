import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, RefreshCw, ShieldAlert, CheckCircle2, XCircle, Clock, Play, Download, FileText, Wifi, WifiOff, Timer, Percent } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { useSyncProgress } from "@/hooks/useSyncProgress";
import { useWindowedRows } from "@/hooks/useWindowedRows";
import { useExportQueue } from "@/hooks/useExportQueue";
import ExportJobsPanel from "@/components/ExportJobsPanel";
import SyncCauseTree from "@/components/SyncCauseTree";
import { exportCsv, exportPdf, type ExportScope } from "@/lib/ctirAuditExport";


type AuditRow = {
  id: string;
  created_at: string;
  action: string;
  details: any;
};

type Alert = {
  id: string;
  source: string;
  kind: string;
  severity: string;
  message: string;
  details: any;
  created_at: string;
  resolved_at: string | null;
};

const PAGE_SIZES = [20, 50, 100, 250];
const DEFAULT_PAGE_SIZE = 20;
const ROW_HEIGHT = 56;
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function CtirSyncAuditPage() {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // execução em tempo real
  const [running, setRunning] = useState(false);

  // ---- estado 100% persistido na URL (deep-link reprodutível) ----
  const [params, setParams] = useSearchParams();
  const patchParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v == null || v === "" ? next.delete(k) : next.set(k, v)));
    setParams(next, { replace: true });
  };

  const activeTab = ((params.get("tab") as "runs" | "alerts" | "tree") ?? "runs");
  const selectedNodeId = params.get("node");
  const setActiveTab = (t: string) => patchParams({ tab: t === "runs" ? null : t });

  // filtros
  const year = params.get("year") ?? "all";
  const month = params.get("month") ?? "all";
  const severityFilter = params.get("sev") ?? "all";
  const kindFilter = params.get("kind") ?? "all";
  const setFilter = (key: "year" | "month" | "sev" | "kind") => (v: string) =>
    patchParams({ [key]: v === "all" ? null : v, rp: null, ap: null });
  const setYear = setFilter("year");
  const setMonth = setFilter("month");
  const setSeverityFilter = setFilter("sev");
  const setKindFilter = setFilter("kind");

  // paginação
  const pageSize = PAGE_SIZES.includes(Number(params.get("ps"))) ? Number(params.get("ps")) : DEFAULT_PAGE_SIZE;
  const setPageSize = (v: string) => patchParams({ ps: v === String(DEFAULT_PAGE_SIZE) ? null : v, rp: null, ap: null });
  const runsPage = Math.max(0, Number(params.get("rp") ?? 0) || 0);
  const alertsPage = Math.max(0, Number(params.get("ap") ?? 0) || 0);
  const setRunsPage = (n: number) => patchParams({ rp: n > 0 ? String(n) : null });
  const setAlertsPage = (n: number) => patchParams({ ap: n > 0 ? String(n) : null });

  const [elapsed, setElapsed] = useState(0);
  const [lastResult, setLastResult] = useState<any>(null);
  const runStartRef = useRef<number>(0);
  const exportScope = ((params.get("scope") as ExportScope) ?? "all");
  const setExportScope = (v: string) => patchParams({ scope: v === "all" ? null : v });

  // stream de progresso (WebSocket + fallback polling + reconexão)
  const { events: liveEvents, transport, reconnects, reset: resetProgress } = useSyncProgress("ctir");

  // fila assíncrona de exportação (geração em background + download assinado)
  const { jobs: exportJobs, enqueue, download: downloadJob, remove: removeJob } = useExportQueue("ctir_audit");

  // virtualização das tabelas (renderização por janela)
  const runsWindow = useWindowedRows(0, { rowHeight: ROW_HEIGHT });

  // posição de scroll persistida na URL
  const scrollY = Number(params.get("y") ?? 0) || 0;
  const restoredRef = useRef(false);
  useEffect(() => {
    const onScroll = () => {
      const y = Math.round(window.scrollY);
      const cur = Number(params.get("y") ?? 0) || 0;
      if (Math.abs(y - cur) > 80) patchParams({ y: y > 0 ? String(y) : null });
    };
    const debounced = () => {
      window.clearTimeout((debounced as any)._t);
      (debounced as any)._t = window.setTimeout(onScroll, 300);
    };
    window.addEventListener("scroll", debounced, { passive: true });
    return () => window.removeEventListener("scroll", debounced);
  });




  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
    const [a, al] = await Promise.all([
      supabase.from("audit_logs")
        .select("id,created_at,action,details")
        .eq("action", "sync_ctir_advisories")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("sync_alerts" as any)
        .select("id,source,kind,severity,message,details,created_at,resolved_at")
        .eq("source", "ctir")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    setAudits((a.data as AuditRow[]) ?? []);
    setAlerts(((al.data as unknown) as Alert[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // cronômetro da execução
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(Date.now() - runStartRef.current), 250);
    return () => clearInterval(t);
  }, [running]);

  const runNow = async () => {
    setRunning(true);
    resetProgress();

    setLastResult(null);
    runStartRef.current = Date.now();
    setElapsed(0);
    try {
      const { data, error } = await supabase.functions.invoke("sync-ctir-advisories", {
        body: { trigger_source: "manual" },
      });
      if (error) throw error;
      setLastResult(data);
      toast.success("Sincronização CTIR concluída", {
        description: `Inseridos: ${data?.inserted ?? 0} · Atualizados: ${data?.updated ?? 0} · Erros: ${data?.errors ?? 0}`,
      });
      await load();
    } catch (e: any) {
      toast.error(`Falha ao executar sync CTIR: ${e?.message ?? e}`);
    } finally {
      setRunning(false);
    }
  };

  // ---- filtragem compartilhada por período ----
  const inPeriod = (iso: string) => {
    const d = new Date(iso);
    if (year !== "all" && d.getFullYear() !== Number(year)) return false;
    if (month !== "all" && d.getMonth() !== Number(month)) return false;
    return true;
  };

  const years = useMemo(() => {
    const s = new Set<number>();
    [...audits, ...alerts].forEach(r => s.add(new Date(r.created_at).getFullYear()));
    return Array.from(s).sort((a, b) => b - a);
  }, [audits, alerts]);

  const kinds = useMemo(() => {
    const s = new Set<string>();
    alerts.forEach(a => s.add(a.kind));
    return Array.from(s).sort();
  }, [alerts]);

  const filteredAudits = useMemo(
    () => audits.filter(a => inPeriod(a.created_at)),
    [audits, year, month],
  );

  const filteredAlerts = useMemo(
    () => alerts.filter(a =>
      inPeriod(a.created_at) &&
      (severityFilter === "all" || a.severity === severityFilter) &&
      (kindFilter === "all" || a.kind === kindFilter)),
    [alerts, year, month, severityFilter, kindFilter],
  );

  useEffect(() => { setRunsPage(0); setAlertsPage(0); }, [year, month, severityFilter, kindFilter]);

  const summary = useMemo(() => {
    const total = filteredAudits.length;
    const withErrors = filteredAudits.filter(a => (a.details?.errors ?? 0) > 0).length;
    const success = total - withErrors;
    const totalInserted = filteredAudits.reduce((s, a) => s + (a.details?.inserted ?? 0), 0);
    const totalRetries = filteredAudits.reduce((s, a) => s + (a.details?.retries ?? 0), 0);
    const durations = filteredAudits.map(a => a.details?.duration_ms ?? 0).filter(n => n > 0);
    const avgDurationMs = durations.length
      ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length)
      : 0;
    const failureRate = total ? Math.round((withErrors / total) * 1000) / 10 : 0;
    return { total, success, withErrors, totalInserted, totalRetries, avgDurationMs, failureRate };
  }, [filteredAudits]);

  // distribuição de motivos de falha no período filtrado
  const reasonDist = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredAudits.forEach(a => {
      (a.details?.failures ?? []).forEach((f: any) => {
        const raw = String(f.reason ?? "erro desconhecido");
        const key = raw.replace(/\d{2,}/g, "N").slice(0, 60);
        counts[key] = (counts[key] ?? 0) + 1;
      });
    });
    filteredAlerts.forEach(a => {
      if (!a.details?.feed_url) return;
      const key = String(a.kind);
      counts[key] = (counts[key] ?? 0) + 0; // mantém chaves de falhas como fonte primária
    });
    const rows = Object.entries(counts).map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count).slice(0, 8);
    const total = rows.reduce((s, r) => s + r.count, 0);
    return { rows, total };
  }, [filteredAudits, filteredAlerts]);


  // contagem por data consistente com os mesmos filtros aplicados
  const chartData = useMemo(() => {
    const buckets: Record<string, { key: number; date: string; warning: number; error: number; critical: number }> = {};
    for (const a of filteredAlerts) {
      const d = new Date(a.created_at);
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const label = format(d, "dd/MM");
      const b = buckets[label] ?? { key, date: label, warning: 0, error: 0, critical: 0 };
      const sev = a.severity as "warning" | "error" | "critical";
      if (sev in b) (b as any)[sev]++;
      buckets[label] = b;
    }
    return Object.values(buckets).sort((a, b) => a.key - b.key).slice(-31);
  }, [filteredAlerts]);

  const pagedAudits = filteredAudits.slice(runsPage * pageSize, runsPage * pageSize + pageSize);
  const pagedAlerts = filteredAlerts.slice(alertsPage * pageSize, alertsPage * pageSize + pageSize);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  // deep-link: abre a execução correspondente ao nó selecionado na árvore
  const openRun = (runId: string) => {
    const idx = filteredAudits.findIndex(a => a.id === runId);
    if (idx >= 0) setRunsPage(Math.floor(idx / pageSize));
    setExpanded(prev => new Set([...prev, runId]));
    patchParams({ tab: "runs", run: runId });
    requestAnimationFrame(() => {
      document.getElementById(`run-${runId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };



  const exportMetaBase = { year, month, severity: severityFilter, kind: kindFilter, scope: exportScope };

  const runsExport = () => ({
    headers: ["Data", "Origem", "Feeds", "Inseridos", "Atualizados", "Retries", "Erros", "Duração (ms)", "Falhas"],
    rows: (exportScope === "page" ? pagedAudits : filteredAudits).map(a => {
      const d = a.details ?? {};
      return [
        format(new Date(a.created_at), "dd/MM/yyyy HH:mm"),
        d.trigger_source ?? "manual",
        d.feeds_checked ?? 0, d.inserted ?? 0, d.updated ?? 0,
        d.retries ?? 0, d.errors ?? 0, d.duration_ms ?? 0,
        (d.failures ?? []).map((f: any) => `${f.kind ?? ""}/${f.year ?? ""}: ${f.reason ?? ""}`).join(" | "),
      ];
    }),
  });

  const alertsExport = () => ({
    headers: ["Data", "Tipo", "Severidade", "Mensagem", "Status"],
    rows: (exportScope === "page" ? pagedAlerts : filteredAlerts).map(a => [
      format(new Date(a.created_at), "dd/MM/yyyy HH:mm"),
      a.kind, a.severity, a.message, a.resolved_at ? "resolvido" : "aberto",
    ]),
  });

  const doExport = (fmt: "csv" | "pdf") => {
    const tab = activeTab === "alerts" ? "alerts" : "runs";
    const { headers, rows } = tab === "alerts" ? alertsExport() : runsExport();
    if (rows.length === 0) return toast.error("Nada para exportar com os filtros atuais");
    const meta = { ...exportMetaBase, tab } as const;
    fmt === "csv" ? exportCsv(headers, rows, meta) : exportPdf(headers, rows, meta);
    toast.success(`Exportação ${fmt.toUpperCase()} gerada (${rows.length} registros)`);
  };




  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="heading text-2xl font-bold">Auditoria de Sincronização CTIR</h1>
          <p className="text-sm text-muted-foreground">Execuções, falhas e retentativas com filtros por período</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={runNow} disabled={running}>
            <Play className={`h-4 w-4 mr-2 ${running ? "animate-pulse" : ""}`} />
            {running ? "Executando…" : "Executar CTIR agora"}
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Select value={exportScope} onValueChange={(v) => setExportScope(v as ExportScope)}>
            <SelectTrigger className="w-40 h-9" aria-label="Escopo da exportação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos filtrados</SelectItem>
              <SelectItem value="page">Página atual</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => doExport("csv")}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => doExport("pdf")}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>

        </div>
      </div>

      {(running || lastResult) && (
        <Card data-testid="run-progress">
          <CardHeader className="pb-2">
            <CardTitle className="heading text-sm flex items-center gap-2">
              {running ? <RefreshCw className="h-4 w-4 animate-spin text-primary" /> : <CheckCircle2 className="h-4 w-4 text-accent" />}
              {running ? "Execução em andamento" : "Última execução manual"}
              <span className="font-mono text-[11px] text-muted-foreground">{(elapsed / 1000).toFixed(1)}s</span>
              <Badge variant="outline" data-testid="transport-badge" className={`text-[10px] font-mono ${transport === "websocket" ? "text-accent border-accent/40" : "text-warning border-warning/40"}`}>
                {transport === "websocket"
                  ? <><Wifi className="h-3 w-3 mr-1 inline" />stream</>
                  : <><WifiOff className="h-3 w-3 mr-1 inline" />{transport === "polling" ? "polling" : "conectando"}</>}
                {reconnects > 0 ? ` · ${reconnects} reconexão(ões)` : ""}
              </Badge>

            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={running ? Math.min(95, (elapsed / 60000) * 100) : 100} />
            {lastResult && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs font-mono">
                {[
                  ["Feeds", lastResult.feeds_checked], ["Inseridos", lastResult.inserted],
                  ["Atualizados", lastResult.updated], ["Retries", lastResult.retries],
                  ["Erros", lastResult.errors],
                ].map(([l, v]) => (
                  <div key={String(l)}>
                    <div className="text-[10px] uppercase text-muted-foreground">{l}</div>
                    <div>{v ?? 0}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {liveEvents.length === 0 ? (
                <div className="text-[11px] font-mono text-muted-foreground">Aguardando eventos da execução…</div>
              ) : liveEvents.map(e => (
                <div key={e.id} className="text-[11px] font-mono flex items-center gap-2 border border-border/40 rounded px-2 py-1">
                  <Badge variant="outline" className="text-[10px]">{e.kind}</Badge>
                  <span className="truncate">{e.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-2 items-center">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32" aria-label="Ano"><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-40" aria-label="Mês"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40" aria-label="Severidade"><SelectValue placeholder="Severidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas severidades</SelectItem>
              {["warning", "error", "critical"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-48" aria-label="Tipo de falha"><SelectValue placeholder="Tipo de falha" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {kinds.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard icon={Clock} label="Execuções" value={summary.total} tone="primary" />
        <SummaryCard icon={CheckCircle2} label="Sucesso" value={summary.success} tone="success" />
        <SummaryCard icon={XCircle} label="Com falhas" value={summary.withErrors} tone="destructive" />
        <SummaryCard icon={ShieldAlert} label="Alertas inseridos" value={summary.totalInserted} tone="accent" />
        <SummaryCard icon={RefreshCw} label="Retentativas" value={summary.totalRetries} tone="warning" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card data-testid="kpi-avg-duration">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Tempo médio de sincronização</span>
            </div>
            <div className="text-2xl font-bold heading mt-1 text-primary">
              {(summary.avgDurationMs / 1000).toFixed(1)}s
            </div>
          </CardContent>
        </Card>
        <Card data-testid="kpi-failure-rate">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-destructive" />
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Taxa de falhas</span>
            </div>
            <div className="text-2xl font-bold heading mt-1 text-destructive">{summary.failureRate}%</div>
            <Progress className="mt-2" value={summary.failureRate} />
          </CardContent>
        </Card>
        <Card data-testid="kpi-reason-dist">
          <CardHeader className="pb-1">
            <CardTitle className="heading text-sm">Distribuição de motivos</CardTitle>
            <CardDescription>Período e filtros aplicados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 max-h-40 overflow-y-auto">
            {reasonDist.rows.length === 0 ? (
              <div className="text-xs font-mono text-muted-foreground">Sem falhas registradas.</div>
            ) : reasonDist.rows.map(r => (
              <div key={r.reason} className="text-[11px] font-mono">
                <div className="flex justify-between gap-2">
                  <span className="truncate" title={r.reason}>{r.reason}</span>
                  <span className="text-muted-foreground">
                    {r.count} · {reasonDist.total ? Math.round((r.count / reasonDist.total) * 100) : 0}%
                  </span>
                </div>
                <Progress className="h-1 mt-0.5" value={reasonDist.total ? (r.count / reasonDist.total) * 100 : 0} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>


      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="heading text-sm">Alertas de sincronização por dia</CardTitle>
          <CardDescription>Distribuição por severidade (filtros aplicados)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="warning" stackId="s" fill="hsl(var(--warning))" />
                <Bar dataKey="error" stackId="s" fill="hsl(var(--destructive))" />
                <Bar dataKey="critical" stackId="s" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="runs">Execuções ({filteredAudits.length})</TabsTrigger>
          <TabsTrigger value="alerts">Alertas ({filteredAlerts.length})</TabsTrigger>
          <TabsTrigger value="tree">Causa-raiz</TabsTrigger>

        </TabsList>

        <TabsContent value="runs">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Data</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Feeds</TableHead>
                    <TableHead>Inseridos</TableHead>
                    <TableHead>Atualizados</TableHead>
                    <TableHead>Retries</TableHead>
                    <TableHead>Erros</TableHead>
                    <TableHead>Duração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedAudits.map(a => {
                    const d = a.details ?? {};
                    const isOpen = expanded.has(a.id);
                    return (
                      <>
                        <TableRow
                          key={a.id}
                          id={`run-${a.id}`}
                          className={`cursor-pointer ${params.get("run") === a.id ? "bg-primary/5 ring-1 ring-primary/30" : ""}`}
                          onClick={() => toggle(a.id)}
                        >
                          <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {format(new Date(a.created_at), "dd/MM HH:mm")}
                            <div className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {d.trigger_source ?? "manual"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{d.feeds_checked ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs text-accent">{d.inserted ?? 0}</TableCell>
                          <TableCell className="font-mono text-xs">{d.updated ?? 0}</TableCell>
                          <TableCell className="font-mono text-xs">{d.retries ?? 0}</TableCell>
                          <TableCell className={`font-mono text-xs ${(d.errors ?? 0) > 0 ? "text-destructive" : ""}`}>{d.errors ?? 0}</TableCell>
                          <TableCell className="font-mono text-xs">{d.duration_ms ? `${d.duration_ms}ms` : "—"}</TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow key={`${a.id}-d`}>
                            <TableCell colSpan={9} className="bg-muted/30">
                              <pre className="text-[10px] font-mono overflow-x-auto p-2">{JSON.stringify(d, null, 2)}</pre>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                  {filteredAudits.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">
                      Nenhuma execução registrada no período selecionado.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <Pager page={runsPage} setPage={setRunsPage} total={filteredAudits.length} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedAlerts.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                      </TableCell>
                      <TableCell><Badge variant="outline">{a.kind}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          a.severity === "critical" || a.severity === "error"
                            ? "text-destructive border-destructive/40"
                            : "text-warning border-warning/40"
                        }>{a.severity}</Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-md truncate" title={a.message}>{a.message}</TableCell>
                      <TableCell>
                        {a.resolved_at
                          ? <Badge variant="outline" className="text-accent border-accent/40">resolvido</Badge>
                          : <Badge variant="outline" className="text-warning border-warning/40">aberto</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAlerts.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      Sem alertas.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <Pager page={alertsPage} setPage={setAlertsPage} total={filteredAlerts.length} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tree">
          <SyncCauseTree
            runs={filteredAudits.slice(0, 20)}
            alerts={filteredAlerts}
            selectedId={selectedNodeId}
            onSelectNode={(nodeId, runId) => patchParams({ node: nodeId, run: runId })}
            onOpenRun={openRun}
          />

        </TabsContent>

      </Tabs>
    </div>
  );
}

function Pager({ page, setPage, total, pageSize }: { page: number; setPage: (n: number) => void; total: number; pageSize: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between pt-3 text-xs font-mono">
      <span className="text-muted-foreground">
        {total === 0 ? "0 registros" : `${page * pageSize + 1}–${Math.min(total, (page + 1) * pageSize)} de ${total}`}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
        <span className="self-center">{page + 1}/{pages}</span>
        <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Próxima</Button>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: {
  icon: any; label: string; value: number; tone: "primary" | "success" | "destructive" | "accent" | "warning";
}) {
  const toneCls = {
    primary: "text-primary", success: "text-accent",
    destructive: "text-destructive", accent: "text-accent", warning: "text-warning",
  }[tone];
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${toneCls}`} />
          <span className="text-[10px] font-mono uppercase text-muted-foreground">{label}</span>
        </div>
        <div className={`text-2xl font-bold heading mt-1 ${toneCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
