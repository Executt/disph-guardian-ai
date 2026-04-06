import { useState, useMemo } from "react";
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Search, Filter, ShieldCheck, CalendarIcon, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AuditAction = "login" | "logout" | "create" | "update" | "delete" | "approve" | "deny" | "export" | "mfa_verify" | "skill_exec";

interface AuditEntry {
  id: string;
  timestamp: Date;
  user: string;
  role: string;
  action: AuditAction;
  resource: string;
  details: string;
  ip: string;
  environment: string;
  risk: "low" | "medium" | "high" | "critical";
}

const actionLabels: Record<AuditAction, string> = {
  login: "Login", logout: "Logout", create: "Criação", update: "Atualização",
  delete: "Exclusão", approve: "Aprovação", deny: "Negação", export: "Exportação",
  mfa_verify: "Verificação MFA", skill_exec: "Execução Skill",
};

const riskColors: Record<string, string> = {
  low: "bg-primary/20 text-primary border-primary/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  critical: "bg-destructive/20 text-destructive border-destructive/30",
};

const generateMockData = (): AuditEntry[] => {
  const users = ["admin@disph.gov.br", "operator01@disph.gov.br", "viewer@disph.gov.br", "operator02@disph.gov.br"];
  const roles = ["admin", "operator", "viewer", "operator"];
  const actions: AuditAction[] = ["login", "logout", "create", "update", "delete", "approve", "deny", "export", "mfa_verify", "skill_exec"];
  const resources = ["Incidente INC-2024-001", "Skill ansible.restart_service", "Configuração ITSM", "Ticket GLPI #4521", "Pipeline CI/CD #892", "Usuário operator03", "Runbook RB-045", "Alerta Zabbix #12033"];
  const envs = ["AWS", "OCI", "On-Premise"];
  const risks: AuditEntry["risk"][] = ["low", "medium", "high", "critical"];
  const entries: AuditEntry[] = [];

  for (let i = 0; i < 80; i++) {
    const ui = Math.floor(Math.random() * users.length);
    const action = actions[Math.floor(Math.random() * actions.length)];
    const risk = action === "delete" || action === "skill_exec" ? risks[2 + Math.floor(Math.random() * 2)] : risks[Math.floor(Math.random() * 3)];
    entries.push({
      id: `AUD-${String(i + 1).padStart(5, "0")}`,
      timestamp: subDays(new Date(), Math.random() * 30),
      user: users[ui],
      role: roles[ui],
      action,
      resource: resources[Math.floor(Math.random() * resources.length)],
      details: `Ação ${actionLabels[action]} executada no recurso`,
      ip: `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      environment: envs[Math.floor(Math.random() * envs.length)],
      risk,
    });
  }
  return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

const mockData = generateMockData();

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 7));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());

  const filtered = useMemo(() => {
    return mockData.filter((e) => {
      if (search && !`${e.user} ${e.resource} ${e.details} ${e.id} ${e.ip}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (userFilter !== "all" && e.user !== userFilter) return false;
      if (riskFilter !== "all" && e.risk !== riskFilter) return false;
      if (dateFrom && dateTo && !isWithinInterval(e.timestamp, { start: startOfDay(dateFrom), end: endOfDay(dateTo) })) return false;
      return true;
    });
  }, [search, actionFilter, userFilter, riskFilter, dateFrom, dateTo]);

  const uniqueUsers = [...new Set(mockData.map((e) => e.user))];

  const exportCSV = () => {
    const header = "ID,Timestamp,Usuário,Role,Ação,Recurso,Detalhes,IP,Ambiente,Risco";
    const rows = filtered.map((e) =>
      `${e.id},${format(e.timestamp, "yyyy-MM-dd HH:mm:ss")},${e.user},${e.role},${actionLabels[e.action]},${e.resource},"${e.details}",${e.ip},${e.environment},${e.risk}`
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_log_lgpd_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório LGPD exportado com sucesso", { description: `${filtered.length} registros exportados` });
  };

  const stats = useMemo(() => ({
    total: filtered.length,
    critical: filtered.filter((e) => e.risk === "critical").length,
    high: filtered.filter((e) => e.risk === "high").length,
    actions: new Set(filtered.map((e) => e.action)).size,
  }), [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Auditoria & Compliance LGPD
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Trilha de auditoria imutável — conformidade IN04/2014 SISP</p>
        </div>
        <Button onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total de Eventos", value: stats.total, icon: FileText, color: "text-accent" },
          { label: "Risco Crítico", value: stats.critical, icon: ShieldCheck, color: "text-destructive" },
          { label: "Risco Alto", value: stats.high, icon: ShieldCheck, color: "text-orange-400" },
          { label: "Tipos de Ação", value: stats.actions, icon: Filter, color: "text-primary" },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={cn("h-8 w-8", s.color)} />
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por ID, usuário, recurso, IP..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary border-border" />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[160px] bg-secondary border-border"><SelectValue placeholder="Tipo de Ação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Ações</SelectItem>
              {Object.entries(actionLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-[200px] bg-secondary border-border"><SelectValue placeholder="Operador" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Operadores</SelectItem>
              {uniqueUsers.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-[140px] bg-secondary border-border"><SelectValue placeholder="Risco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Riscos</SelectItem>
              <SelectItem value="low">Baixo</SelectItem>
              <SelectItem value="medium">Médio</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal bg-secondary border-border">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM", { locale: ptBR }) : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start text-left font-normal bg-secondary border-border">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM", { locale: ptBR }) : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-mono text-xs">ID</TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs">TIMESTAMP</TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs">OPERADOR</TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs">AÇÃO</TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs">RECURSO</TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs">AMBIENTE</TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs">IP</TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs">RISCO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 50).map((e) => (
                <TableRow key={e.id} className="border-border hover:bg-secondary/50 transition-colors">
                  <TableCell className="font-mono text-xs text-accent">{e.id}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{format(e.timestamp, "dd/MM/yy HH:mm:ss")}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs text-foreground">{e.user}</span>
                      <span className="text-[10px] text-muted-foreground">{e.role}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-mono border-border">
                      {actionLabels[e.action]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-foreground max-w-[200px] truncate">{e.resource}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-mono border-border">{e.environment}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{e.ip}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px] font-mono border", riskColors[e.risk])}>
                      {e.risk.toUpperCase()}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShieldCheck className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhum registro encontrado para os filtros aplicados</p>
            </div>
          )}
          {filtered.length > 50 && (
            <div className="text-center py-3 text-xs text-muted-foreground border-t border-border">
              Exibindo 50 de {filtered.length} registros — exporte CSV para visualizar todos
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
