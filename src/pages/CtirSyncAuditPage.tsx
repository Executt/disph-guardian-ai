import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight, RefreshCw, ShieldAlert, CheckCircle2, XCircle, Clock } from "lucide-react";

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

export default function CtirSyncAuditPage() {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const [a, al] = await Promise.all([
      supabase.from("audit_logs")
        .select("id,created_at,action,details")
        .eq("action", "sync_ctir_advisories")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("sync_alerts" as any)
        .select("id,source,kind,severity,message,details,created_at,resolved_at")
        .eq("source", "ctir")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setAudits((a.data as AuditRow[]) ?? []);
    setAlerts(((al.data as unknown) as Alert[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    const total = audits.length;
    const withErrors = audits.filter(a => (a.details?.errors ?? 0) > 0).length;
    const success = total - withErrors;
    const totalInserted = audits.reduce((s, a) => s + (a.details?.inserted ?? 0), 0);
    const totalRetries = audits.reduce((s, a) => s + (a.details?.retries ?? 0), 0);
    return { total, success, withErrors, totalInserted, totalRetries };
  }, [audits]);

  const chartData = useMemo(() => {
    const buckets: Record<string, { date: string; warning: number; error: number; critical: number }> = {};
    for (const a of alerts) {
      const d = format(new Date(a.created_at), "dd/MM");
      const b = buckets[d] ?? { date: d, warning: 0, error: 0, critical: 0 };
      const sev = a.severity as "warning" | "error" | "critical";
      if (sev in b) (b as any)[sev]++;
      buckets[d] = b;
    }
    return Object.values(buckets).reverse().slice(-30);
  }, [alerts]);

  const filteredAlerts = alerts.filter(a => severityFilter === "all" || a.severity === severityFilter);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading text-2xl font-bold">Auditoria de Sincronização CTIR</h1>
          <p className="text-sm text-muted-foreground">Últimas execuções, falhas e retentativas nos últimos 30 dias</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard icon={Clock} label="Execuções" value={summary.total} tone="primary" />
        <SummaryCard icon={CheckCircle2} label="Sucesso" value={summary.success} tone="success" />
        <SummaryCard icon={XCircle} label="Com falhas" value={summary.withErrors} tone="destructive" />
        <SummaryCard icon={ShieldAlert} label="Alertas inseridos" value={summary.totalInserted} tone="accent" />
        <SummaryCard icon={RefreshCw} label="Retentativas" value={summary.totalRetries} tone="warning" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="heading text-sm">Alertas de sincronização por dia</CardTitle>
          <CardDescription>Distribuição por severidade (30 dias)</CardDescription>
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

      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Execuções</TabsTrigger>
          <TabsTrigger value="alerts">Alertas ({alerts.length})</TabsTrigger>
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
                  {audits.map(a => {
                    const d = a.details ?? {};
                    const isOpen = expanded.has(a.id);
                    return (
                      <>
                        <TableRow key={a.id} className="cursor-pointer" onClick={() => toggle(a.id)}>
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
                  {audits.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-6">
                      Nenhuma execução registrada nos últimos 30 dias.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap gap-2">
                {["all", "warning", "error", "critical"].map(s => (
                  <Button key={s} size="sm" variant={severityFilter === s ? "default" : "outline"} onClick={() => setSeverityFilter(s)}>
                    {s === "all" ? "Todos" : s}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
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
                  {filteredAlerts.map(a => (
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
