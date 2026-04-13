import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MetricCard } from "@/components/MetricCard";
import { EnvironmentFilter, Environment } from "@/components/EnvironmentFilter";
import { AIChatConsole } from "@/components/AIChatConsole";
import { useRealtimeValue, useRealtimeSeries, useRealtimeTimeline } from "@/hooks/useRealtimeData";
import {
  AlertTriangle, ShieldCheck, Clock, Activity, Server,
  CheckCircle2, XCircle, TrendingUp, Zap, BarChart3
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar
} from "recharts";

const COLORS = {
  primary: "hsl(142, 60%, 45%)",
  accent: "hsl(199, 80%, 50%)",
  warning: "hsl(38, 92%, 50%)",
  destructive: "hsl(0, 72%, 51%)",
  muted: "hsl(215, 15%, 55%)",
  card: "hsl(220, 18%, 10%)",
  border: "hsl(220, 14%, 18%)",
  foreground: "hsl(210, 20%, 92%)",
};

const tooltipStyle = {
  backgroundColor: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: "6px",
  fontSize: "11px",
  fontFamily: "JetBrains Mono, monospace",
};

const envBaseData = {
  all:         { incidents: 47, sla: 97.2, mttr: 18, availability: 99.94, p1: 3,  p2: 8,  p3: 16, p4: 20 },
  AWS:         { incidents: 18, sla: 98.1, mttr: 14, availability: 99.97, p1: 1,  p2: 3,  p3: 6,  p4: 8  },
  OCI:         { incidents: 15, sla: 96.8, mttr: 21, availability: 99.91, p1: 1,  p2: 3,  p3: 5,  p4: 6  },
  "On-Premise": { incidents: 14, sla: 96.5, mttr: 22, availability: 99.89, p1: 1,  p2: 2,  p3: 5,  p4: 6  },
};

const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

function generateTimeline(env: Environment) {
  const base = envBaseData[env];
  return hours.map((h, i) => ({
    hour: h,
    incidentes: Math.max(0, Math.round(base.incidents / 24 + (Math.random() - 0.4) * 4)),
    resolvidos: Math.max(0, Math.round(base.incidents / 24 + (Math.random() - 0.5) * 3)),
    sla: +(base.sla + (Math.random() - 0.5) * 3).toFixed(1),
    mttr: +(base.mttr + (Math.random() - 0.5) * 10).toFixed(0),
    disponibilidade: +(base.availability + (Math.random() - 0.5) * 0.1).toFixed(2),
  }));
}

const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function generateWeekly(env: Environment) {
  const base = envBaseData[env];
  return weekDays.map(d => ({
    day: d,
    abertos: Math.round(base.incidents / 7 + (Math.random() - 0.3) * 5),
    fechados: Math.round(base.incidents / 7 + (Math.random() - 0.4) * 4),
  }));
}

function generateSeverityPie(env: Environment) {
  const b = envBaseData[env];
  return [
    { name: "P1 – Crítico", value: b.p1, color: COLORS.destructive },
    { name: "P2 – Alto", value: b.p2, color: COLORS.warning },
    { name: "P3 – Médio", value: b.p3, color: COLORS.accent },
    { name: "P4 – Baixo", value: b.p4, color: COLORS.muted },
  ];
}

function generateAvailabilityByService(env: Environment) {
  const services = env === "all"
    ? ["API Gateway", "Auth Service", "DB Primary", "Cache Redis", "MQ Kafka", "Storage S3"]
    : env === "AWS"
    ? ["EKS Prod", "RDS Aurora", "ElastiCache", "S3 Buckets"]
    : env === "OCI"
    ? ["OKE Prod", "ATP DB", "Object Storage", "Functions"]
    : ["OCP Cluster", "PostgreSQL", "Redis HA", "NFS Storage"];

  return services.map(s => ({
    service: s,
    uptime: +(99.5 + Math.random() * 0.5).toFixed(2),
    fill: Math.random() > 0.3 ? COLORS.primary : COLORS.warning,
  }));
}

export default function Index() {
  const [env, setEnv] = useState<Environment>("all");
  const [chatExpanded, setChatExpanded] = useState(false);

  const base = envBaseData[env];
  const incidents = useRealtimeValue(base.incidents, 3);
  const sla = useRealtimeValue(base.sla, 1);
  const mttr = useRealtimeValue(base.mttr, 3);
  const availability = useRealtimeValue(base.availability, 0.03);

  const incidentSpark = useRealtimeSeries(base.incidents, 5, 20, 4000);
  const slaSpark = useRealtimeSeries(base.sla, 1.5, 20, 4000);
  const mttrSpark = useRealtimeSeries(base.mttr, 4, 20, 4000);
  const availSpark = useRealtimeSeries(base.availability, 0.04, 20, 4000);

  const timeline = useMemo(() => generateTimeline(env), [env]);
  const weekly = useMemo(() => generateWeekly(env), [env]);
  const severityPie = useMemo(() => generateSeverityPie(env), [env]);
  const serviceAvail = useMemo(() => generateAvailabilityByService(env), [env]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Operacional</h1>
          <p className="text-sm text-muted-foreground font-mono">Visão consolidada · Tempo real</p>
        </div>
        <EnvironmentFilter selected={env} onChange={setEnv} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Incidentes Ativos"
          value={incidents}
          subtitle={`${base.p1} críticos abertos`}
          icon={AlertTriangle}
          trend="down"
          sparklineData={incidentSpark}
          drilldownItems={[
            { label: "P1 – Crítico", value: base.p1, env: "all" },
            { label: "P2 – Alto", value: base.p2, env: "all" },
            { label: "P3 – Médio", value: base.p3, env: "all" },
            { label: "P4 – Baixo", value: base.p4, env: "all" },
          ]}
        />
        <MetricCard
          title="SLA Compliance"
          value={`${sla.toFixed(1)}%`}
          subtitle="Meta: 99.0%"
          icon={ShieldCheck}
          trend={sla >= 99 ? "up" : "down"}
          sparklineData={slaSpark}
          drilldownItems={[
            { label: "AWS", value: `${envBaseData.AWS.sla}%` },
            { label: "OCI", value: `${envBaseData.OCI.sla}%` },
            { label: "On-Premise", value: `${envBaseData["On-Premise"].sla}%` },
          ]}
        />
        <MetricCard
          title="MTTR (min)"
          value={mttr}
          subtitle="↓ 12% vs semana anterior"
          icon={Clock}
          trend="up"
          sparklineData={mttrSpark}
          drilldownItems={[
            { label: "AWS", value: `${envBaseData.AWS.mttr} min` },
            { label: "OCI", value: `${envBaseData.OCI.mttr} min` },
            { label: "On-Premise", value: `${envBaseData["On-Premise"].mttr} min` },
          ]}
        />
        <MetricCard
          title="Disponibilidade"
          value={`${availability.toFixed(2)}%`}
          subtitle="Uptime últimas 24h"
          icon={Activity}
          trend="up"
          sparklineData={availSpark}
          drilldownItems={[
            { label: "AWS", value: `${envBaseData.AWS.availability}%` },
            { label: "OCI", value: `${envBaseData.OCI.availability}%` },
            { label: "On-Premise", value: `${envBaseData["On-Premise"].availability}%` },
          ]}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incidents Timeline */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent" /> Incidentes vs Resolvidos — 24h
            </CardTitle>
            <CardDescription className="font-mono text-[11px]">
              Ambiente: {env === "all" ? "Todos" : env}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeline} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: COLORS.muted, fontFamily: "JetBrains Mono" }} interval={3} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.muted, fontFamily: "JetBrains Mono" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "JetBrains Mono" }} />
                  <Bar dataKey="incidentes" name="Abertos" fill={COLORS.destructive} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="resolvidos" name="Resolvidos" fill={COLORS.primary} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Severity Pie */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Distribuição por Severidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityPie}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {severityPie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    wrapperStyle={{ fontSize: "10px", fontFamily: "JetBrains Mono" }}
                    formatter={(value: string) => <span style={{ color: COLORS.foreground }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SLA + MTTR over time */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> SLA & MTTR — Tendência 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: COLORS.muted, fontFamily: "JetBrains Mono" }} interval={3} />
                  <YAxis yAxisId="sla" domain={[90, 100]} tick={{ fontSize: 10, fill: COLORS.muted }} />
                  <YAxis yAxisId="mttr" orientation="right" tick={{ fontSize: 10, fill: COLORS.muted }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "JetBrains Mono" }} />
                  <Line yAxisId="sla" type="monotone" dataKey="sla" name="SLA %" stroke={COLORS.primary} strokeWidth={2} dot={false} />
                  <Line yAxisId="mttr" type="monotone" dataKey="mttr" name="MTTR (min)" stroke={COLORS.warning} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Availability Area */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-accent" /> Disponibilidade — 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline}>
                  <defs>
                    <linearGradient id="availGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: COLORS.muted, fontFamily: "JetBrains Mono" }} interval={3} />
                  <YAxis domain={[99.5, 100]} tick={{ fontSize: 10, fill: COLORS.muted }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="disponibilidade" name="Uptime %" stroke={COLORS.accent} strokeWidth={2} fill="url(#availGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly bar */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-warning" /> Incidentes — Última Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: COLORS.muted, fontFamily: "JetBrains Mono" }} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.muted }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "JetBrains Mono" }} />
                  <Bar dataKey="abertos" name="Abertos" fill={COLORS.warning} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="fechados" name="Fechados" fill={COLORS.primary} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Service availability table */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" /> Disponibilidade por Serviço
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {serviceAvail.map((svc, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">{svc.service}</span>
                    <span className={svc.uptime >= 99.9 ? "text-[hsl(var(--success))]" : "text-[hsl(var(--warning))]"}>
                      {svc.uptime}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${((svc.uptime - 99) / 1) * 100}%`,
                        backgroundColor: svc.uptime >= 99.9 ? COLORS.primary : COLORS.warning,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
