import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { EnvironmentFilter, type Environment } from "@/components/EnvironmentFilter";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Server, Cpu, HardDrive, AlertTriangle, Activity, Download, Network, ShieldAlert,
} from "lucide-react";

type Platform = "all" | "vmware" | "hyperv";
type HostStatus = "ok" | "warn" | "crit";

interface HypervisorHost {
  hostname: string;
  platform: "VMware vSphere" | "Microsoft Hyper-V";
  cluster: string;
  envGroup: "AWS" | "OCI" | "On-Premise";
  cpu: number;
  ram: number;
  datastore: number;
  uptimeDays: number;
  status: HostStatus;
  lastCheck: string;
}

interface RiskVM {
  vm: string;
  host: string;
  symptom: string;
  severity: "low" | "medium" | "high" | "critical";
  recommendation: string;
}

interface FailurePoint {
  category: "Storage" | "Rede" | "HA/DRS" | "Snapshots" | "Manutenção" | "Licença/Cert";
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  affected: string;
}

const HOSTS: HypervisorHost[] = [
  { hostname: "esxi-prod-01.disph.local", platform: "VMware vSphere", cluster: "CLU-PROD-A", envGroup: "On-Premise", cpu: 78, ram: 82, datastore: 71, uptimeDays: 142, status: "warn", lastCheck: "há 12s" },
  { hostname: "esxi-prod-02.disph.local", platform: "VMware vSphere", cluster: "CLU-PROD-A", envGroup: "On-Premise", cpu: 64, ram: 70, datastore: 71, uptimeDays: 142, status: "ok", lastCheck: "há 15s" },
  { hostname: "esxi-prod-03.disph.local", platform: "VMware vSphere", cluster: "CLU-PROD-A", envGroup: "On-Premise", cpu: 92, ram: 88, datastore: 94, uptimeDays: 7, status: "crit", lastCheck: "há 18s" },
  { hostname: "esxi-dr-01.disph.local", platform: "VMware vSphere", cluster: "CLU-DR", envGroup: "OCI", cpu: 35, ram: 42, datastore: 38, uptimeDays: 89, status: "ok", lastCheck: "há 22s" },
  { hostname: "hv-prod-01.disph.local", platform: "Microsoft Hyper-V", cluster: "HV-CLU-PROD", envGroup: "On-Premise", cpu: 58, ram: 67, datastore: 55, uptimeDays: 201, status: "ok", lastCheck: "há 11s" },
  { hostname: "hv-prod-02.disph.local", platform: "Microsoft Hyper-V", cluster: "HV-CLU-PROD", envGroup: "On-Premise", cpu: 81, ram: 86, datastore: 79, uptimeDays: 201, status: "warn", lastCheck: "há 13s" },
  { hostname: "hv-hmg-01.disph.local", platform: "Microsoft Hyper-V", cluster: "HV-CLU-HMG", envGroup: "AWS", cpu: 22, ram: 31, datastore: 28, uptimeDays: 56, status: "ok", lastCheck: "há 20s" },
];

const RISK_VMS: RiskVM[] = [
  { vm: "vm-sap-app-03", host: "esxi-prod-03.disph.local", symptom: "CPU Ready acima de 12%", severity: "high", recommendation: "Migrar (vMotion) para host com menor contenção" },
  { vm: "vm-oracle-db-01", host: "esxi-prod-01.disph.local", symptom: "Ballooning de memória 4.2 GB", severity: "high", recommendation: "Aumentar reserva de RAM ou rebalancear cluster" },
  { vm: "vm-legacy-files", host: "esxi-prod-03.disph.local", symptom: "Snapshot ativo há 23 dias (412 GB)", severity: "critical", recommendation: "Consolidar snapshot fora do horário comercial" },
  { vm: "vm-jenkins-master", host: "hv-prod-02.disph.local", symptom: "Datastore principal a 94%", severity: "critical", recommendation: "Expandir LUN ou mover VHDX para outro CSV" },
  { vm: "vm-ad-dc-02", host: "esxi-prod-02.disph.local", symptom: "Perda de heartbeat VMware Tools", severity: "medium", recommendation: "Atualizar/reiniciar VMware Tools" },
  { vm: "vm-gitlab-runner-04", host: "hv-prod-01.disph.local", symptom: "Failover HA nas últimas 24h", severity: "medium", recommendation: "Investigar logs do cluster Hyper-V (FailoverClustering)" },
];

const FAILURE_POINTS: FailurePoint[] = [
  { category: "Storage", description: "Latência média de I/O no Datastore DS-PROD-01 acima de 25 ms", severity: "high", affected: "DS-PROD-01 · 8 VMs" },
  { category: "Rede", description: "vSwitch vSwitch0 sem uplink redundante no host esxi-prod-03", severity: "high", affected: "esxi-prod-03.disph.local" },
  { category: "HA/DRS", description: "Cluster CLU-PROD-A com slot insuficiente para failover de 1 host", severity: "critical", affected: "CLU-PROD-A" },
  { category: "Snapshots", description: "3 VMs com snapshots ativos há mais de 7 dias", severity: "medium", affected: "vm-legacy-files, vm-erp-app, vm-bi-stage" },
  { category: "Manutenção", description: "Host esxi-dr-01 entrou em modo de manutenção há 4h sem janela registrada", severity: "low", affected: "esxi-dr-01.disph.local" },
  { category: "Licença/Cert", description: "Certificado vCenter expira em 21 dias", severity: "medium", affected: "vcenter-prod.disph.local" },
];

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-muted/40 text-muted-foreground border-muted",
  medium: "bg-warning/15 text-warning border-warning/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

function hostStatusToBadge(s: HostStatus): "healthy" | "warning" | "critical" {
  return s === "ok" ? "healthy" : s === "warn" ? "warning" : "critical";
}

function downloadCSV(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HypervisorsPage() {
  const [platform, setPlatform] = useState<Platform>("all");
  const [envFilter, setEnvFilter] = useState<Environment>("all");
  const [query, setQuery] = useState("");

  const filteredHosts = useMemo(() => {
    return HOSTS.filter((h) => {
      if (platform === "vmware" && h.platform !== "VMware vSphere") return false;
      if (platform === "hyperv" && h.platform !== "Microsoft Hyper-V") return false;
      if (envFilter !== "all" && h.envGroup !== envFilter) return false;
      if (query && !h.hostname.toLowerCase().includes(query.toLowerCase()) && !h.cluster.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [platform, envFilter, query]);

  const kpis = useMemo(() => {
    const total = filteredHosts.length;
    const online = filteredHosts.filter((h) => h.status !== "crit").length;
    const crit = filteredHosts.filter((h) => h.status === "crit").length;
    const avg = (k: keyof Pick<HypervisorHost, "cpu" | "ram" | "datastore">) =>
      total ? Math.round(filteredHosts.reduce((s, h) => s + h[k], 0) / total) : 0;
    return {
      hosts: `${online}/${total}`,
      vmsRunning: filteredHosts.length * 14,
      critAlerts: crit + RISK_VMS.filter((v) => v.severity === "critical").length,
      avgCpu: avg("cpu"),
      avgRam: avg("ram"),
      avgStorage: avg("datastore"),
    };
  }, [filteredHosts]);

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold heading flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            Hypervisores · VMware & Hyper-V
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento de hosts, VMs em risco e pontos de falha em clusters virtualizados.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <SelectTrigger className="w-[200px] h-9 text-xs">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as plataformas</SelectItem>
              <SelectItem value="vmware">VMware vSphere</SelectItem>
              <SelectItem value="hyperv">Microsoft Hyper-V</SelectItem>
            </SelectContent>
          </Select>
          <EnvironmentFilter selected={envFilter} onChange={setEnvFilter} />
          <Input
            placeholder="Buscar host/cluster..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-[220px] h-9 text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() =>
              downloadCSV("hypervisors-diagnostico.csv", [
                ...filteredHosts.map((h) => ({ tipo: "host", ...h })),
                ...RISK_VMS.map((v) => ({ tipo: "vm_risco", ...v })),
                ...FAILURE_POINTS.map((f) => ({ tipo: "ponto_falha", ...f })),
              ])
            }
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard title="Hosts online" value={kpis.hosts} icon={Server} subtitle="online/total" />
        <MetricCard title="VMs em execução" value={kpis.vmsRunning} icon={Activity} subtitle="estimado" />
        <MetricCard title="Alertas críticos" value={kpis.critAlerts} icon={AlertTriangle} trend="down" subtitle="hosts + VMs" />
        <MetricCard title="CPU média" value={`${kpis.avgCpu}%`} icon={Cpu} subtitle="cluster" />
        <MetricCard title="RAM média" value={`${kpis.avgRam}%`} icon={Network} subtitle="cluster" />
        <MetricCard title="Storage médio" value={`${kpis.avgStorage}%`} icon={HardDrive} subtitle="datastores" />
      </div>

      {/* Hosts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hosts hypervisores</CardTitle>
          <CardDescription className="text-xs">
            {filteredHosts.length} host(s) após filtros aplicados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hostname</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Cluster</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>RAM</TableHead>
                <TableHead>Datastore</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última checagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHosts.map((h) => (
                <TableRow key={h.hostname}>
                  <TableCell className="font-mono text-xs">{h.hostname}</TableCell>
                  <TableCell className="text-xs">{h.platform}</TableCell>
                  <TableCell className="text-xs">{h.cluster}</TableCell>
                  <TableCell className="text-xs">{h.cpu}%</TableCell>
                  <TableCell className="text-xs">{h.ram}%</TableCell>
                  <TableCell className="text-xs">{h.datastore}%</TableCell>
                  <TableCell className="text-xs">{h.uptimeDays}d</TableCell>
                  <TableCell><StatusBadge status={hostStatusToBadge(h.status)} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{h.lastCheck}</TableCell>
                </TableRow>
              ))}
              {filteredHosts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-6">
                    Nenhum host corresponde aos filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* VMs em risco */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning" />
            VMs em risco
          </CardTitle>
          <CardDescription className="text-xs">
            Diagnóstico automático com base em sintomas conhecidos (CPU ready, ballooning, snapshots, HA, heartbeat)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VM</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Sintoma</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Recomendação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {RISK_VMS.map((v) => (
                <TableRow key={v.vm}>
                  <TableCell className="font-mono text-xs">{v.vm}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{v.host}</TableCell>
                  <TableCell className="text-xs">{v.symptom}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] font-mono uppercase ${SEVERITY_COLORS[v.severity]}`}>
                      {v.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{v.recommendation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pontos de falha */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Pontos de falha detectados
          </CardTitle>
          <CardDescription className="text-xs">
            Achados categorizados em Storage, Rede, HA/DRS, Snapshots, Manutenção e Licenças/Certificados
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {FAILURE_POINTS.map((f, idx) => (
            <div
              key={idx}
              className="border border-border rounded-md p-3 bg-card/40 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{f.category}</span>
                <Badge variant="outline" className={`text-[10px] font-mono uppercase ${SEVERITY_COLORS[f.severity]}`}>
                  {f.severity}
                </Badge>
              </div>
              <p className="text-xs text-foreground">{f.description}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{f.affected}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground italic">
        Dados em modo demonstrativo (mock). Integração real com vCenter API e Hyper-V WMI/PowerShell prevista no roadmap.
      </p>
    </div>
  );
}
