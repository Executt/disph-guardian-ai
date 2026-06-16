import { useEffect, useMemo, useState } from "react";
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
  Server, Cpu, HardDrive, AlertTriangle, Activity, Download, Network, ShieldAlert, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Platform = "all" | "vmware" | "hyperv";

interface HostRow {
  id: string;
  environment_id: string | null;
  platform: "vmware" | "hyperv";
  hostname: string;
  cluster: string | null;
  cpu_pct: number;
  ram_pct: number;
  datastore_pct: number;
  uptime_seconds: number;
  status: "ok" | "warn" | "crit" | "maintenance";
  last_check_at: string;
}
interface VmRow {
  id: string;
  host_id: string;
  name: string;
  symptom: string;
  severity: "info" | "warn" | "crit";
  recommendation: string | null;
  last_check_at: string;
}
interface FpRow {
  id: string;
  environment_id: string | null;
  category: string;
  title: string;
  severity: "info" | "warn" | "crit";
  impact: string | null;
  detected_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-muted/40 text-muted-foreground border-muted",
  warn: "bg-warning/15 text-warning border-warning/30",
  crit: "bg-destructive/15 text-destructive border-destructive/30",
};

const statusToBadge = (s: HostRow["status"]) =>
  s === "ok" ? "healthy" : s === "warn" ? "warning" : s === "crit" ? "critical" : "warning";

const fmtUptime = (sec: number) => {
  if (!sec) return "—";
  const d = Math.floor(sec / 86400);
  return d > 0 ? `${d}d` : `${Math.floor(sec / 3600)}h`;
};

const fmtCheck = (iso: string) => {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}m`;
  return `há ${Math.floor(diff / 3600)}h`;
};

function downloadCSV(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")),
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
  const [hosts, setHosts] = useState<HostRow[]>([]);
  const [vms, setVms] = useState<VmRow[]>([]);
  const [fps, setFps] = useState<FpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: h }, { data: v }, { data: f }] = await Promise.all([
      supabase.from("hypervisor_hosts").select("*").order("hostname"),
      supabase.from("hypervisor_vms").select("*").order("last_check_at", { ascending: false }),
      supabase.from("hypervisor_failure_points").select("*").order("detected_at", { ascending: false }),
    ]);
    setHosts((h as HostRow[]) ?? []);
    setVms((v as VmRow[]) ?? []);
    setFps((f as FpRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("hypervisors")
      .on("postgres_changes", { event: "*", schema: "public", table: "hypervisor_hosts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "hypervisor_vms" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "hypervisor_failure_points" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filteredHosts = useMemo(() => hosts.filter((h) => {
    if (platform !== "all" && h.platform !== platform) return false;
    if (query && !h.hostname.toLowerCase().includes(query.toLowerCase()) && !(h.cluster ?? "").toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [hosts, platform, envFilter, query]);

  const hostIdSet = useMemo(() => new Set(filteredHosts.map(h => h.id)), [filteredHosts]);
  const filteredVms = useMemo(() => vms.filter(v => hostIdSet.has(v.host_id)), [vms, hostIdSet]);

  const kpis = useMemo(() => {
    const total = filteredHosts.length;
    const online = filteredHosts.filter(h => h.status !== "crit").length;
    const crit = filteredHosts.filter(h => h.status === "crit").length;
    const avg = (k: "cpu_pct" | "ram_pct" | "datastore_pct") =>
      total ? Math.round(filteredHosts.reduce((s, h) => s + Number(h[k] ?? 0), 0) / total) : 0;
    return {
      hosts: `${online}/${total}`,
      vmsRunning: filteredVms.length,
      critAlerts: crit + filteredVms.filter(v => v.severity === "crit").length,
      avgCpu: avg("cpu_pct"),
      avgRam: avg("ram_pct"),
      avgStorage: avg("datastore_pct"),
    };
  }, [filteredHosts, filteredVms]);

  const triggerCollect = async () => {
    setCollecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("hypervisor-collect");
      if (error) throw error;
      toast({ title: "Coleta disparada", description: `Hosts coletados: ${(data as any)?.collected ?? 0}` });
      await load();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast({
        title: "Coleta indisponível",
        description: msg.includes("412") || msg.includes("no_collector_configured")
          ? "Configure os secrets VSPHERE_* / HYPERV_* ou execute o agente on-prem."
          : msg,
        variant: "destructive",
      });
    } finally {
      setCollecting(false);
    }
  };

  const hostById = useMemo(() => new Map(hosts.map(h => [h.id, h.hostname])), [hosts]);
  const empty = !loading && hosts.length === 0 && vms.length === 0 && fps.length === 0;

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold heading flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            Hypervisores · VMware & Hyper-V
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento em tempo real de hosts, VMs em risco e pontos de falha (dados do coletor / edge function).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <SelectTrigger className="w-[200px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as plataformas</SelectItem>
              <SelectItem value="vmware">VMware vSphere</SelectItem>
              <SelectItem value="hyperv">Microsoft Hyper-V</SelectItem>
            </SelectContent>
          </Select>
          <EnvironmentFilter selected={envFilter} onChange={setEnvFilter} />
          <Input placeholder="Buscar host/cluster..." value={query} onChange={(e) => setQuery(e.target.value)} className="w-[220px] h-9 text-xs" />
          <Button variant="outline" size="sm" className="gap-2" onClick={triggerCollect} disabled={collecting}>
            <RefreshCw className={`h-3.5 w-3.5 ${collecting ? "animate-spin" : ""}`} />
            Coletar agora
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() =>
            downloadCSV("hypervisors-diagnostico.csv", [
              ...filteredHosts.map(h => ({ tipo: "host", hostname: h.hostname, platform: h.platform, cluster: h.cluster ?? "", cpu: h.cpu_pct, ram: h.ram_pct, datastore: h.datastore_pct, status: h.status })),
              ...filteredVms.map(v => ({ tipo: "vm_risco", vm: v.name, host: hostById.get(v.host_id) ?? "", sintoma: v.symptom, severidade: v.severity, recomendacao: v.recommendation ?? "" })),
              ...fps.map(f => ({ tipo: "ponto_falha", categoria: f.category, titulo: f.title, severidade: f.severity, impacto: f.impact ?? "" })),
            ])
          }>
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      {empty && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Sem dados — configure o agente</p>
              <p className="text-xs text-muted-foreground mt-1">
                Instale o agente on-prem (<code className="font-mono">disph-aiops-backend/agents/hypervisor_agent.py</code>) com as credenciais do vCenter e/ou Hyper-V, ou configure os secrets <code className="font-mono">VSPHERE_*</code> / <code className="font-mono">HYPERV_*</code> e use o botão "Coletar agora".
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard title="Hosts online" value={kpis.hosts} icon={Server} subtitle="online/total" />
        <MetricCard title="VMs monitoradas" value={kpis.vmsRunning} icon={Activity} subtitle="em risco" />
        <MetricCard title="Alertas críticos" value={kpis.critAlerts} icon={AlertTriangle} trend="down" subtitle="hosts + VMs" />
        <MetricCard title="CPU média" value={`${kpis.avgCpu}%`} icon={Cpu} subtitle="cluster" />
        <MetricCard title="RAM média" value={`${kpis.avgRam}%`} icon={Network} subtitle="cluster" />
        <MetricCard title="Storage médio" value={`${kpis.avgStorage}%`} icon={HardDrive} subtitle="datastores" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hosts hypervisores</CardTitle>
          <CardDescription className="text-xs">{filteredHosts.length} host(s) após filtros</CardDescription>
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
                <TableRow key={h.id}>
                  <TableCell className="font-mono text-xs">{h.hostname}</TableCell>
                  <TableCell className="text-xs">{h.platform === "vmware" ? "VMware vSphere" : "Microsoft Hyper-V"}</TableCell>
                  <TableCell className="text-xs">{h.cluster ?? "—"}</TableCell>
                  <TableCell className="text-xs">{Number(h.cpu_pct).toFixed(0)}%</TableCell>
                  <TableCell className="text-xs">{Number(h.ram_pct).toFixed(0)}%</TableCell>
                  <TableCell className="text-xs">{Number(h.datastore_pct).toFixed(0)}%</TableCell>
                  <TableCell className="text-xs">{fmtUptime(h.uptime_seconds)}</TableCell>
                  <TableCell><StatusBadge status={statusToBadge(h.status)} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtCheck(h.last_check_at)}</TableCell>
                </TableRow>
              ))}
              {filteredHosts.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-6">
                  {loading ? "Carregando..." : "Nenhum host encontrado."}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning" /> VMs em risco
          </CardTitle>
          <CardDescription className="text-xs">Sintomas detectados pelo coletor (CPU ready, ballooning, snapshots, HA, heartbeat)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VM</TableHead><TableHead>Host</TableHead><TableHead>Sintoma</TableHead>
                <TableHead>Severidade</TableHead><TableHead>Recomendação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVms.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.name}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{hostById.get(v.host_id) ?? "—"}</TableCell>
                  <TableCell className="text-xs">{v.symptom}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] font-mono uppercase ${SEVERITY_COLORS[v.severity]}`}>{v.severity}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{v.recommendation ?? "—"}</TableCell>
                </TableRow>
              ))}
              {filteredVms.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">Sem VMs em risco no momento.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Pontos de falha detectados
          </CardTitle>
          <CardDescription className="text-xs">Storage, Rede, HA/DRS, Snapshots, Manutenção, Licenças/Certificados</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {fps.map((f) => (
            <div key={f.id} className="border border-border rounded-md p-3 bg-card/40 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{f.category}</span>
                <Badge variant="outline" className={`text-[10px] font-mono uppercase ${SEVERITY_COLORS[f.severity]}`}>{f.severity}</Badge>
              </div>
              <p className="text-xs text-foreground">{f.title}</p>
              {f.impact && <p className="text-[11px] text-muted-foreground font-mono">{f.impact}</p>}
            </div>
          ))}
          {fps.length === 0 && (
            <p className="text-xs text-muted-foreground italic col-span-2">Nenhum ponto de falha registrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
