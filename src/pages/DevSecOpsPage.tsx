import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { EnvironmentFilter, type Environment } from "@/components/EnvironmentFilter";
import { Shield, Bug, AlertTriangle, Container, Activity, Code } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { useState, useMemo } from "react";
import { useRealtimeSeries, useRealtimeValue } from "@/hooks/useRealtimeData";

const podHealth = [
  { name: "payments-api", status: "critical" as const, restarts: 12, env: "AWS" as const },
  { name: "auth-service", status: "healthy" as const, restarts: 0, env: "AWS" as const },
  { name: "frontend-web", status: "healthy" as const, restarts: 1, env: "OCI" as const },
  { name: "notification-svc", status: "warning" as const, restarts: 4, env: "AWS" as const },
  { name: "data-pipeline", status: "healthy" as const, restarts: 0, env: "OCI" as const },
  { name: "gateway-proxy", status: "warning" as const, restarts: 3, env: "On-Premise" as const },
  { name: "cache-redis", status: "healthy" as const, restarts: 0, env: "AWS" as const },
  { name: "oracle-sync", status: "healthy" as const, restarts: 1, env: "OCI" as const },
  { name: "monitoring-agent", status: "healthy" as const, restarts: 0, env: "On-Premise" as const },
];

const sonarData = [
  { project: "payments-api", bugs: 3, codeSmells: 12, vulns: 1, env: "AWS" },
  { project: "auth-service", bugs: 0, codeSmells: 5, vulns: 0, env: "AWS" },
  { project: "frontend-web", bugs: 1, codeSmells: 22, vulns: 2, env: "OCI" },
  { project: "notification-svc", bugs: 2, codeSmells: 8, vulns: 0, env: "AWS" },
  { project: "data-pipeline", bugs: 0, codeSmells: 3, vulns: 0, env: "OCI" },
  { project: "gateway-proxy", bugs: 1, codeSmells: 6, vulns: 1, env: "On-Premise" },
];

const trivyData = [
  { severity: "Critical", count: 3, color: "hsl(0, 72%, 51%)" },
  { severity: "High", count: 8, color: "hsl(38, 92%, 50%)" },
  { severity: "Medium", count: 15, color: "hsl(199, 80%, 50%)" },
  { severity: "Low", count: 22, color: "hsl(215, 15%, 55%)" },
];

const tooltipStyle = {
  backgroundColor: "hsl(220, 18%, 10%)",
  border: "1px solid hsl(220, 14%, 18%)",
  borderRadius: "6px",
  fontSize: "12px",
};

export default function DevSecOpsPage() {
  const [envFilter, setEnvFilter] = useState<Environment>("all");

  const podsActive = useRealtimeValue(47, 3);
  const errorRate = useRealtimeValue(2.1, 0.8, 4000);
  const qualityGate = useRealtimeValue(89, 3, 5000);

  const podSparkline = useRealtimeSeries(47, 5, 20, 2500);
  const errorSparkline = useRealtimeSeries(2.1, 0.8, 20, 2500);
  const vulnSparkline = useRealtimeSeries(3, 2, 20, 3000);
  const qgSparkline = useRealtimeSeries(89, 4, 20, 3500);

  const filteredPods = useMemo(() =>
    envFilter === "all" ? podHealth : podHealth.filter(p => p.env === envFilter)
  , [envFilter]);

  const filteredSonar = useMemo(() =>
    envFilter === "all" ? sonarData : sonarData.filter(s => s.env === envFilter)
  , [envFilter]);

  const podDrilldown = [
    { label: "AWS (ROSA)", value: podHealth.filter(p => p.env === "AWS").length, env: "AWS" },
    { label: "OCI (OKD)", value: podHealth.filter(p => p.env === "OCI").length, env: "OCI" },
    { label: "On-Premise", value: podHealth.filter(p => p.env === "On-Premise").length, env: "On-Premise" },
  ];

  const vulnDrilldown = [
    { label: "Imagens Quay", value: 2 },
    { label: "Clusters ROSA", value: 1 },
    { label: "Clusters OKD", value: 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard DevSecOps</h1>
          <p className="text-sm text-muted-foreground font-mono">Saúde de Aplicações • SonarQube • Trivy • Pods</p>
        </div>
        <EnvironmentFilter selected={envFilter} onChange={setEnvFilter} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Pods Ativos"
          value={Math.round(podsActive)}
          subtitle={`${filteredPods.filter(p => p.status !== "healthy").length} em alerta`}
          icon={Container}
          sparklineData={podSparkline}
          drilldownItems={podDrilldown}
        />
        <MetricCard
          title="Taxa de Erro API"
          value={`${errorRate.toFixed(1)}%`}
          subtitle="↓ vs ontem"
          icon={Activity}
          trend="up"
          sparklineData={errorSparkline}
          drilldownItems={[
            { label: "payments-api", value: "4.2%", env: "AWS" },
            { label: "gateway-proxy", value: "1.8%", env: "On-Premise" },
            { label: "frontend-web", value: "0.3%", env: "OCI" },
          ]}
        />
        <MetricCard
          title="Vulns Críticas"
          value={3}
          subtitle="Trivy + Quay"
          icon={AlertTriangle}
          trend="down"
          sparklineData={vulnSparkline}
          drilldownItems={vulnDrilldown}
        />
        <MetricCard
          title="Quality Gate"
          value={`${Math.round(qualityGate)}%`}
          subtitle="SonarQube pass rate"
          icon={Code}
          trend="up"
          sparklineData={qgSparkline}
          drilldownItems={[
            { label: "payments-api", value: "Fail", env: "AWS" },
            { label: "auth-service", value: "Pass", env: "AWS" },
            { label: "frontend-web", value: "Pass", env: "OCI" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pod Health */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Container className="h-4 w-4 text-accent" /> Saúde dos Pods
              <Badge variant="outline" className="font-mono text-[10px] ml-auto">{filteredPods.length} pods</Badge>
            </CardTitle>
            <CardDescription className="font-mono text-xs">Status real-time dos workloads Kubernetes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[280px] overflow-auto">
              {filteredPods.map((pod) => (
                <div key={pod.name} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={pod.status} />
                    <span className="text-sm font-mono">{pod.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-[10px]">{pod.env}</Badge>
                    <span className="text-xs text-muted-foreground font-mono">{pod.restarts} restarts</span>
                  </div>
                </div>
              ))}
              {filteredPods.length === 0 && (
                <p className="text-xs text-muted-foreground font-mono text-center py-4">Nenhum pod neste ambiente</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* SonarQube */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bug className="h-4 w-4 text-warning" /> SonarQube — Qualidade de Código
            </CardTitle>
            <CardDescription className="font-mono text-xs">Bugs, Code Smells e Vulnerabilidades por projeto</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={filteredSonar} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis dataKey="project" tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "hsl(210, 20%, 92%)" }} />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Bar dataKey="bugs" fill="hsl(0, 72%, 51%)" radius={[2, 2, 0, 0]} name="Bugs" />
                <Bar dataKey="codeSmells" fill="hsl(38, 92%, 50%)" radius={[2, 2, 0, 0]} name="Code Smells" />
                <Bar dataKey="vulns" fill="hsl(262, 60%, 55%)" radius={[2, 2, 0, 0]} name="Vulns" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Trivy */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-destructive" /> Trivy — Vulnerabilidades de Container
            </CardTitle>
            <CardDescription className="font-mono text-xs">Scan de imagens Quay e clusters OpenShift/OKD</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={trivyData} dataKey="count" nameKey="severity" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                      {trivyData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                {trivyData.map((item) => (
                  <div key={item.severity} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                    <div>
                      <p className="text-sm font-medium">{item.severity}</p>
                      <p className="text-lg font-bold font-mono">{item.count}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
