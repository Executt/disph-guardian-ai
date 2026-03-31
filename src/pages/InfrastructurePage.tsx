import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Server, Cpu, HardDrive, Network, Database, Cloud } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const cpuData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}h`,
  "ROSA-PROD": 40 + Math.random() * 30,
  "OKD-PROD": 35 + Math.random() * 25,
  "On-Premise": 50 + Math.random() * 20,
}));

const clusters = [
  { name: "OpenShift ROSA", env: "AWS Produção", status: "healthy" as const, nodes: 12, cpu: "62%", mem: "71%", pods: 148 },
  { name: "OpenShift ROSA", env: "AWS Dev/HMG", status: "healthy" as const, nodes: 6, cpu: "34%", mem: "45%", pods: 82 },
  { name: "OKD Cluster", env: "OCI Produção", status: "healthy" as const, nodes: 8, cpu: "55%", mem: "63%", pods: 96 },
  { name: "OKD Cluster", env: "OCI Dev/HMG", status: "warning" as const, nodes: 4, cpu: "78%", mem: "82%", pods: 67 },
  { name: "OpenShift Hub", env: "On-Premise", status: "healthy" as const, nodes: 6, cpu: "41%", mem: "52%", pods: 34 },
];

const services = [
  { name: "Traefik Proxy", status: "healthy" as const, type: "Proxy Reverso", location: "On-Premise" },
  { name: "ExaCS Oracle DB", status: "healthy" as const, type: "Database", location: "OCI" },
  { name: "RDS PostgreSQL", status: "healthy" as const, type: "Database", location: "AWS" },
  { name: "S3 Buckets", status: "healthy" as const, type: "Storage", location: "AWS" },
  { name: "Red Hat ACM", status: "healthy" as const, type: "Management", location: "On-Premise Hub" },
  { name: "Quay Registry", status: "healthy" as const, type: "Registry", location: "On-Premise Hub" },
];

export default function InfrastructurePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard de Infraestrutura</h1>
        <p className="text-sm text-muted-foreground font-mono">Multi-Cloud • Zabbix/Prometheus • ACM • ExaCS</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Clusters Ativos" value={5} subtitle="36 nós totais" icon={Cloud} />
        <MetricCard title="CPU Média" value="54%" subtitle="Todos os clusters" icon={Cpu} />
        <MetricCard title="Memória Média" value="63%" subtitle="↑ 2% vs ontem" icon={HardDrive} trend="down" />
        <MetricCard title="Total de Pods" value={427} subtitle="3 ambientes" icon={Server} />
      </div>

      {/* CPU Timeline */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-accent" /> Consumo de CPU — Últimas 24h
          </CardTitle>
          <CardDescription className="font-mono text-xs">Zabbix + Prometheus aggregation</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={cpuData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="cpuRosa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cpuOkd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(199, 80%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(199, 80%, 50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cpuOnprem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: "6px", fontSize: "12px" }} />
              <Area type="monotone" dataKey="ROSA-PROD" stroke="hsl(142, 60%, 45%)" fill="url(#cpuRosa)" strokeWidth={2} />
              <Area type="monotone" dataKey="OKD-PROD" stroke="hsl(199, 80%, 50%)" fill="url(#cpuOkd)" strokeWidth={2} />
              <Area type="monotone" dataKey="On-Premise" stroke="hsl(38, 92%, 50%)" fill="url(#cpuOnprem)" strokeWidth={2} />
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
            </CardTitle>
            <CardDescription className="font-mono text-xs">Status ACM — OpenShift, ROSA, OKD</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {clusters.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-3 min-w-0">
                  <StatusBadge status={c.status} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{c.env}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground shrink-0">
                  <span>{c.nodes}n</span>
                  <span>CPU {c.cpu}</span>
                  <span>MEM {c.mem}</span>
                  <Badge variant="outline" className="text-[10px]">{c.pods} pods</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Services */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-accent" /> Serviços de Infraestrutura
            </CardTitle>
            <CardDescription className="font-mono text-xs">Traefik, ExaCS, RDS, S3, ACM, Quay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {services.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
