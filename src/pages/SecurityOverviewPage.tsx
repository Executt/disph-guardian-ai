import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import SyncStatusPanel from "@/components/SyncStatusPanel";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, AlertTriangle, Activity, Target, CheckCircle2, Clock, XCircle } from "lucide-react";

type StageKey = "identified" | "contained" | "eradicated" | "recovered" | "closed";
type Stage = { key: StageKey; label: string; count: number; color: string };
type ComplianceItem = { label: string; value: number; total: number; hint?: string };

const STAGE_META: { key: StageKey; label: string; color: string }[] = [
  { key: "identified",  label: "Identificado", color: "hsl(199,80%,50%)" },
  { key: "contained",   label: "Contido",      color: "hsl(38,90%,55%)" },
  { key: "eradicated",  label: "Erradicado",   color: "hsl(280,60%,55%)" },
  { key: "recovered",   label: "Recuperado",   color: "hsl(142,60%,45%)" },
  { key: "closed",      label: "Encerrado",    color: "hsl(142,55%,38%)" },
];

export default function SecurityOverviewPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [advisories, setAdvisories] = useState<any[]>([]);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [inc, ass, adv, env] = await Promise.all([
        supabase.from("incidents").select("id,severity,status,stage,created_at,resolved_at,environment"),
        supabase.from("advisory_environment_assessments").select("id,status,advisory_id,environment_id"),
        supabase.from("ctir_advisories").select("id,severity,code"),
        supabase.from("monitored_environments").select("id,name,total_assets"),
      ]);
      setIncidents(inc.data ?? []);
      setAssessments(ass.data ?? []);
      setAdvisories(adv.data ?? []);
      setEnvironments(env.data ?? []);
      setLoading(false);
    })();
  }, []);

  // Funil NIST: cumulativo por ordem de progressão
  const stages: Stage[] = useMemo(() => {
    const order: StageKey[] = ["identified", "contained", "eradicated", "recovered", "closed"];
    const rank = Object.fromEntries(order.map((k, i) => [k, i])) as Record<StageKey, number>;
    return STAGE_META.map((meta, i) => {
      const count = incidents.filter(inc => {
        const s = (inc.stage ?? "identified") as StageKey;
        return rank[s] >= i;
      }).length;
      return { ...meta, count };
    });
  }, [incidents]);

  const maxStage = Math.max(1, ...stages.map(s => s.count));

  // MTTR (média em horas) para incidentes com resolved_at
  const mttrHours = useMemo(() => {
    const resolved = incidents.filter(i => i.resolved_at && i.created_at);
    if (!resolved.length) return null;
    const totalMs = resolved.reduce((s, i) => s + (new Date(i.resolved_at).getTime() - new Date(i.created_at).getTime()), 0);
    return Math.round((totalMs / resolved.length) / 3_600_000);
  }, [incidents]);

  const complianceByEnv: ComplianceItem[] = useMemo(() => {
    return environments.map(env => {
      const items = assessments.filter(a => a.environment_id === env.id);
      const ok = items.filter(a => a.status === "compliant").length;
      return { label: env.name, value: ok, total: items.length, hint: `${env.total_assets ?? 0} ativos` };
    });
  }, [environments, assessments]);

  const overallCompliance = useMemo(() => {
    const total = assessments.length || 1;
    const ok = assessments.filter(a => a.status === "compliant").length;
    const pending = assessments.filter(a => a.status === "pending").length;
    const nonCompliant = assessments.filter(a => a.status === "non_compliant").length;
    return { pct: Math.round((ok / total) * 100), ok, pending, nonCompliant, total: assessments.length };
  }, [assessments]);

  const critical = incidents.filter(i => i.severity === "critical" && i.stage !== "closed").length;
  const openCount = incidents.filter(i => i.stage !== "closed").length;
  const criticalAdvisories = advisories.filter(a => (a.severity ?? "").toLowerCase() === "critical").length;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold heading text-foreground">Visão Geral de Segurança</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Funil NIST · Compliance CTIR · Correlação por ambiente
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          {loading ? "carregando…" : `${incidents.length} incidentes · ${assessments.length} avaliações`}
        </Badge>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Incidentes Abertos" value={openCount} icon={AlertTriangle} trend={openCount > 0 ? "down" : "up"} />
        <MetricCard title="Críticos Ativos" value={critical} icon={Activity} trend={critical > 0 ? "down" : "up"} />
        <MetricCard title="Advisories Críticos" value={criticalAdvisories} icon={ShieldCheck} />
        <MetricCard title="Compliance CTIR" value={`${overallCompliance.pct}%`} icon={Target} trend={overallCompliance.pct >= 80 ? "up" : "down"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base heading">Funil NIST de Resposta a Incidentes</CardTitle>
            <CardDescription className="text-xs font-mono">Identificado → Contido → Erradicado → Recuperado → Encerrado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stages.map((s, i) => {
              const pct = (s.count / maxStage) * 100;
              const conv = i === 0 ? 100 : Math.round((s.count / (stages[i - 1].count || 1)) * 100);
              return (
                <div key={s.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-foreground">{s.label}</span>
                    <span className="text-muted-foreground">{s.count} · conv. {conv}%</span>
                  </div>
                  <div className="h-8 rounded-md bg-muted/40 overflow-hidden relative">
                    <div
                      className="h-full transition-all flex items-center px-3 text-[11px] font-mono font-semibold text-background"
                      style={{ width: `${Math.max(pct, 4)}%`, background: s.color }}
                    >
                      {s.count}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="pt-3 border-t border-border grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Taxa de Recuperação</p>
                <p className="text-lg font-bold text-success">
                  {Math.round((stages[3].count / (stages[0].count || 1)) * 100)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase">MTTR médio</p>
                <p className="text-lg font-bold text-primary">{mttrHours != null ? `${mttrHours}h` : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Não Encerrados</p>
                <p className="text-lg font-bold text-warning">{stages[0].count - stages[4].count}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base heading">Compliance CTIR</CardTitle>
            <CardDescription className="text-xs font-mono">Aderência de alertas por ambiente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="relative h-32 w-32">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(220,14%,18%)" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={overallCompliance.pct >= 80 ? "hsl(142,60%,45%)" : overallCompliance.pct >= 50 ? "hsl(38,90%,55%)" : "hsl(0,72%,51%)"}
                    strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${(overallCompliance.pct / 100) * 264} 264`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">{overallCompliance.pct}%</span>
                  <span className="text-[10px] font-mono text-muted-foreground">aderência</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-success/10 border border-success/20 p-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-success mx-auto mb-1" />
                <p className="text-sm font-bold text-success">{overallCompliance.ok}</p>
                <p className="text-[9px] font-mono text-muted-foreground">OK</p>
              </div>
              <div className="rounded-md bg-warning/10 border border-warning/20 p-2">
                <Clock className="h-3.5 w-3.5 text-warning mx-auto mb-1" />
                <p className="text-sm font-bold text-warning">{overallCompliance.pending}</p>
                <p className="text-[9px] font-mono text-muted-foreground">Pend.</p>
              </div>
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2">
                <XCircle className="h-3.5 w-3.5 text-destructive mx-auto mb-1" />
                <p className="text-sm font-bold text-destructive">{overallCompliance.nonCompliant}</p>
                <p className="text-[9px] font-mono text-muted-foreground">N/C</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              {complianceByEnv.length === 0 && (
                <p className="text-xs font-mono text-muted-foreground text-center py-2">Sem ambientes monitorados.</p>
              )}
              {complianceByEnv.map(item => {
                const pct = item.total ? Math.round((item.value / item.total) * 100) : 0;
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-foreground truncate">{item.label}</span>
                      <span className="text-muted-foreground">{pct}% · {item.value}/{item.total}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
