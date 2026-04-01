import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { EnvironmentFilter, type Environment } from "@/components/EnvironmentFilter";
import { Server, Cpu, HardDrive, Network, Database, Cloud } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useState, useMemo } from "react";
import { useRealtimeTimeline, useRealtimeSeries, useRealtimeValue } from "@/hooks/useRealtimeData";

const clusters = [
  { name: "OpenShift ROSA", env: "AWS Produção", envGroup: "AWS" as const, status: "healthy" as const, nodes: 12, cpu: 62, mem: 71, pods: 148 },
  { name: "OpenShift ROSA", env: "AWS Dev/HMG", envGroup: "AWS" as const, status: "healthy" as const, nodes: 6, cpu: 34, mem: 45, pods: 82 },
  { name: "OKD Cluster", env: "OCI Produção", envGroup: "OCI" as const, status: "healthy" as const, nodes: 8, cpu: 55, mem: 63, pods: 96 },
  { name: "OKD Cluster", env: "OCI Dev/HMG", envGroup: "OCI" as const, status: "warning" as const, nodes: 4, cpu: 78, mem: 82, pods: 67 },
  { name: "OpenShift Hub", env: "On-Premise", envGroup: "On-Premise" as const, status: "healthy" as const, nodes: 6, cpu: 41, mem: 52, pods: 34 },
];

const services = [
  { name: "Traefik Proxy", status: "healthy" as const, type: "Proxy Reverso", location: "On-Premise", envGroup: "On-Premise" as const },
  { name: "ExaCS Oracle DB", status: "healthy" as const, type: "Database", location: "OCI", envGroup: "OCI" as const },
  { name: "RDS PostgreSQL", status: "healthy" as const, type: "Database", location: "AWS", envGroup: "AWS" as const },
  { name: "S3 Buckets", status: "healthy" as const, type: "Storage", location: "AWS", envGroup: "AWS" as const },
  { name: "Red Hat ACM", status: "healthy" as const, type: "Management", location: "On-Premise Hub", envGroup: "On-Premise" as const },
  { name: "Quay Registry", status: "healthy" as const, type: "Registry", location: "On-Premise Hub", envGroup: "On-Premise" as const },
];

const tooltipStyle = {
  backgroundColor: "hsl(220, 18%, 10%)",
  border: "1px solid hsl(220, 14%, 18%)",
  borderRadius: "6px",
  fontSize: "12px",
};

const cpuGenerators = {
  "ROSA-PROD": { base: 55, variance: 15 },
  "OKD-PROD": { base: 45, variance: 12 },
  "On-Premise": { base: 40, variance: 10 },
};

export default function InfrastructurePage() {
  const [envFilter, setEnvFilter] = useState<Environment>("all");

  const cpuData = useRealtimeTimeline(cpuGenerators, 24, 4000);
  const cpuAvg = useRealtimeValue(54, 5, 3000);
  const memAvg = useRealtimeValue(63, 4, 3500);
  const totalPods = useRealtimeValue(427, 15, 4000);

  const cpuSparkline = useRealtimeSeries(54, 8, 20, 2500);
  const memSparkline = useRealtimeSeries(63, 6, 20, 3000);
  const podSparkline = useRealtimeSeries(427, 20, 20, 3500);
  const clusterSparkline = useRealtimeSeries(5, 0.5, 20, 5000);

  const filteredClusters = useMemo(() =>
    envFilter === "all" ? clusters : clusters.filter(c => c.envGroup === envFilter)
  , [envFilter]);

  const filteredServices = useMemo(() =>
    envFilter === "all" ? services : services.filter(s => s.envGroup === envFilter)
  , [envFilter]);

  const clusterDrilldown = [
    { label: "AWS (ROSA)", value: clusters.filter(c => c.envGroup === "AWS").length, env: "AWS" },
    { label: "OCI (OKD)", value: clusters.filter(c => c.envGroup === "OCI").length, env: "OCI" },
    { label: "On-Premise", value: clusters.filter(c => c.envGroup === "On-Premise").length, env: "On-Premise" },
  ];

  const cpuDrilldown = clusters.map(c => ({
    label: `${c.name} (${c.env})`,
    value: `${c.cpu}%`,
    env: c.envGroup,
  }));

  const memDrilldown = clusters.map(c => ({
    label: `${c.name} (${c.env})`,
    value: `${c.mem}%`,
    env: c.envGroup,
  }));

  const podDrilldown = clusters.map(c => ({
    label: c.env,
    value: c.pods,
    env: c.envGroup,
  }));

  // Filter chart lines based on env
  const chartKeys = envFilter === "all"
    ? ["ROSA-PROD", "OKD-PROD", "On-Premise"]
    : envFilter === "AWS" ? ["ROSA-PROD"]
    : envFilter === "OCI" ? ["OKD-PROD"]
    : ["On-Premise"];

  const lineColors: Record<string, string> = {
    "ROSA-PROD": "hsl(142, 60%, 45%)",
    "OKD-PROD": "hsl(199, 80%, 50%)",
    "On-Premise": "hsl(38, 92%, 50%)",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Infraestrutura</h1>
          <p className="text-sm text-muted-foreground font-mono">Multi-Cloud • Zabbix/Prometheus • ACM • ExaCS</p>
        </div>
        <EnvironmentFilter selected={envFilter} onChange={setEnvFilter} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Clusters Ativos" value={filteredClusters.length} subtitle={`${filteredClusters.reduce((a, c) => a + c.nodes, 0)} nós totais`} icon={Cloud} sparklineData={clusterSparkline} drilldownItems={clusterDrilldown} />
        <MetricCard title="CPU Média" value={`${Math.round(cpuAvg)}%`} subtitle="Todos os clusters" icon={Cpu} sparklineData={cpuSparkline} drilldownItems={cpuDrilldown} />
        <MetricCard title="Memória Média" value={`${Math.round(memAvg)}%`} subtitle="↑ 2% vs ontem" icon={HardDrive} trend="down" sparklineData={memSparkline} drilldownItems={memDrilldown} />
        <MetricCard title="Total de Pods" value={Math.round(totalPods)} subtitle={`${filteredClusters.length} ambientes`} icon={Server} sparklineData={podSparkline} drilldownItems={podDrilldown} />
      </div>

      {/* CPU Timeline - Real-time */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-accent" /> Consumo de CPU — Tempo Real
            <span className="ml-auto flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground">LIVE</span>
            </span>
          </CardTitle>
          <CardDescription className="font-mono text-xs">Zabbix + Prometheus aggregation • Atualização a cada 4s</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={cpuData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                {Object.entries(lineColors).map(([key, color]) => (
                  <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }} tickFormatter={() => ""} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={tooltipStyle} formatter={(val: number) => [`${val.toFixed(1)}%`, ""]} labelFormatter={() => ""} />
              <Legend wrapperStyle={{ fontSize: "10px" }} />
              {chartKeys.map(key => (
                <Area key={key} type="monotone" dataKey={key} stroke={lineColors[key]} fill={`url(#grad-${key})`} strokeWidth={2} isAnimationActive={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clusters */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" /> Clusters Kubernetes
              <Badge variant="outline" className="font-mono text-[10px] ml-auto">{filteredClusters.length} clusters</Badge>
            </CardTitle>
            <CardDescription className="font-mono text-xs">Status ACM — OpenShift, ROSA, OKD</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredClusters.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusBadge status={c.status} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{c.env}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground shrink-0">
                  <span>{c.nodes}n</span>
                  <span>CPU {c.cpu}%</span>
                  <span>MEM {c.mem}%</span>
                  <Badge variant="outline" className="text-[10px]">{c.pods} pods</Badge>
                </div>
              </div>
            ))}
            {filteredClusters.length === 0 && (
              <p className="text-xs text-muted-foreground font-mono text-center py-4">Nenhum cluster neste ambiente</p>
            )}
          </CardContent>
        </Card>

        {/* Services */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-accent" /> Serviços de Infraestrutura
              <Badge variant="outline" className="font-mono text-[10px] ml-auto">{filteredServices.length} serviços</Badge>
            </CardTitle>
            <CardDescription className="font-mono text-xs">Traefik, ExaCS, RDS, S3, ACM, Quay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredServices.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <StatusBadge status={svc.status} />
                  <div>
                    <p className="text-sm font-medium">{svc.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{svc.type}</p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">{svc.location}</Badge>
              </div>
            ))}
            {filteredServices.length === 0 && (
              <p className="text-xs text-muted-foreground font-mono text-center py-4">Nenhum serviço neste ambiente</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
