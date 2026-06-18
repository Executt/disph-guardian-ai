import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricCard } from "@/components/MetricCard";
import { Activity, Bot, AlertTriangle, CheckCircle2, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Platform = "all" | "vsphere" | "hyperv";
type LogLevel = "all" | "info" | "warn" | "error";

interface AgentStatusRow {
  id: string;
  environment_id: string | null;
  platform: "vsphere" | "hyperv";
  agent_name: string;
  hostname: string | null;
  version: string | null;
  status: "online" | "degraded" | "offline";
  last_collect_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  error_count_24h: number;
}

interface AgentLogRow {
  id: string;
  environment_id: string | null;
  platform: "vsphere" | "hyperv";
  agent_name: string;
  level: "info" | "warn" | "error";
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface EnvRow { id: string; name: string }

const STATUS_STYLE: Record<AgentStatusRow["status"], string> = {
  online: "bg-accent/15 text-accent border-accent/30",
  degraded: "bg-warning/15 text-warning border-warning/30",
  offline: "bg-destructive/15 text-destructive border-destructive/30",
};

const LEVEL_STYLE: Record<AgentLogRow["level"], string> = {
  info: "bg-muted/40 text-muted-foreground border-muted",
  warn: "bg-warning/15 text-warning border-warning/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
};

const fmtRelative = (iso: string | null) => {
  if (!iso) return "—";
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 60) return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function AgentStatusPage() {
  const [agents, setAgents] = useState<AgentStatusRow[]>([]);
  const [logs, setLogs] = useState<AgentLogRow[]>([]);
  const [envs, setEnvs] = useState<EnvRow[]>([]);
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<Platform>("all");
  const [levelFilter, setLevelFilter] = useState<LogLevel>("all");
  const [search, setSearch] = useState("");

  // Initial load
  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: l }, { data: e }] = await Promise.all([
        (supabase as any).from("hypervisor_agent_status").select("*").order("agent_name"),
        (supabase as any).from("hypervisor_agent_logs").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("monitored_environments").select("id,name").order("name"),
      ]);
      setAgents((a ?? []) as AgentStatusRow[]);
      setLogs((l ?? []) as AgentLogRow[]);
      setEnvs((e ?? []) as EnvRow[]);
    })();
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const chStatus = supabase
      .channel("agent_status_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "hypervisor_agent_status" }, async () => {
        const { data } = await (supabase as any).from("hypervisor_agent_status").select("*").order("agent_name");
        setAgents((data ?? []) as AgentStatusRow[]);
      })
      .subscribe();

    const chLogs = supabase
      .channel("agent_logs_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hypervisor_agent_logs" }, (payload) => {
        setLogs((prev) => [payload.new as AgentLogRow, ...prev].slice(0, 200));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chStatus);
      supabase.removeChannel(chLogs);
    };
  }, []);

  const envName = useMemo(() => {
    const m = new Map(envs.map((e) => [e.id, e.name]));
    return (id: string | null) => (id ? m.get(id) ?? id.slice(0, 8) : "—");
  }, [envs]);

  const filteredAgents = useMemo(() => {
    return agents.filter((a) => {
      if (envFilter !== "all" && a.environment_id !== envFilter) return false;
      if (platformFilter !== "all" && a.platform !== platformFilter) return false;
      if (search && !`${a.agent_name} ${a.hostname ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [agents, envFilter, platformFilter, search]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (envFilter !== "all" && l.environment_id !== envFilter) return false;
      if (platformFilter !== "all" && l.platform !== platformFilter) return false;
      if (levelFilter !== "all" && l.level !== levelFilter) return false;
      if (search && !`${l.agent_name} ${l.message}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, envFilter, platformFilter, levelFilter, search]);

  const kpis = useMemo(() => {
    const online = filteredAgents.filter((a) => a.status === "online").length;
    const degraded = filteredAgents.filter((a) => a.status === "degraded").length;
    const offline = filteredAgents.filter((a) => a.status === "offline").length;
    const errors24h = filteredAgents.reduce((s, a) => s + (a.error_count_24h || 0), 0);
    const lastCollect = filteredAgents
      .map((a) => (a.last_collect_at ? new Date(a.last_collect_at).getTime() : 0))
      .reduce((m, v) => Math.max(m, v), 0);
    return {
      online,
      degraded,
      offline,
      errors24h,
      lastCollectIso: lastCollect ? new Date(lastCollect).toISOString() : null,
    };
  }, [filteredAgents]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold heading flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          Status dos Agentes Coletores
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Heartbeat, última coleta, erros e logs em tempo real por ambiente e plataforma.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Agentes Online" value={String(kpis.online)} icon={CheckCircle2} variant="success" />
        <MetricCard label="Degradados" value={String(kpis.degraded)} icon={AlertTriangle} variant="warning" />
        <MetricCard label="Offline" value={String(kpis.offline)} icon={AlertTriangle} variant="critical" />
        <MetricCard label="Erros (24h)" value={String(kpis.errors24h)} icon={Activity} variant={kpis.errors24h ? "warning" : "default"} />
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={envFilter} onValueChange={setEnvFilter}>
            <SelectTrigger><SelectValue placeholder="Ambiente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os ambientes</SelectItem>
              {envs.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as Platform)}>
            <SelectTrigger><SelectValue placeholder="Plataforma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas plataformas</SelectItem>
              <SelectItem value="vsphere">VMware vSphere</SelectItem>
              <SelectItem value="hyperv">Microsoft Hyper-V</SelectItem>
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as LogLevel)}>
            <SelectTrigger><SelectValue placeholder="Nível de log" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os níveis</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warn</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Buscar agente / mensagem…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </CardContent>
      </Card>

      {/* Tabela de agentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agentes ({filteredAgents.length})</CardTitle>
          <CardDescription>Última coleta: {fmtRelative(kpis.lastCollectIso)}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead>Ambiente</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última coleta</TableHead>
                <TableHead>Último sucesso</TableHead>
                <TableHead>Último erro</TableHead>
                <TableHead className="text-right">Erros 24h</TableHead>
                <TableHead>Versão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum agente reportou heartbeat ainda. Configure o `hypervisor_agent.py` on-prem.
                  </TableCell>
                </TableRow>
              )}
              {filteredAgents.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">
                    <div className="font-medium">{a.agent_name}</div>
                    {a.hostname && <div className="text-muted-foreground">{a.hostname}</div>}
                  </TableCell>
                  <TableCell className="text-xs">{envName(a.environment_id)}</TableCell>
                  <TableCell className="text-xs uppercase">{a.platform}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_STYLE[a.status]}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{fmtRelative(a.last_collect_at)}</TableCell>
                  <TableCell className="text-xs text-accent">{fmtRelative(a.last_success_at)}</TableCell>
                  <TableCell className="text-xs text-destructive">{fmtRelative(a.last_error_at)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    <Badge variant="outline" className={a.error_count_24h > 0 ? LEVEL_STYLE.error : "border-muted"}>
                      {a.error_count_24h}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{a.version ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Logs em tempo real */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logs ({filteredLogs.length})</CardTitle>
          <CardDescription>Atualização em tempo real (últimos 200 eventos).</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto font-mono text-xs">
            {filteredLogs.length === 0 && (
              <div className="text-center text-muted-foreground py-8">Nenhum log corresponde aos filtros.</div>
            )}
            {filteredLogs.map((l) => (
              <div key={l.id} className="flex gap-3 px-4 py-2 border-b border-border/40 hover:bg-secondary/30">
                <span className="text-muted-foreground whitespace-nowrap">{fmtTime(l.created_at)}</span>
                <Badge variant="outline" className={`${LEVEL_STYLE[l.level]} h-5 px-1.5 text-[10px] uppercase`}>{l.level}</Badge>
                <span className="text-primary whitespace-nowrap">{l.platform}</span>
                <span className="text-muted-foreground whitespace-nowrap">{l.agent_name}</span>
                <span className="text-muted-foreground whitespace-nowrap">@{envName(l.environment_id)}</span>
                <span className="text-foreground flex-1 break-all">{l.message}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
