import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ClipboardCheck, FileCode, CheckCircle2, AlertTriangle, GitBranch,
  Download, Filter, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Severity = "info" | "low" | "medium" | "high" | "critical";
type Status = "resolvido" | "aberto" | "em_progresso" | "wontfix";
type Category = "redundancia" | "inconsistencia" | "dead_code" | "bug" | "documentacao" | "ux";

interface Evidence {
  file: string;
  snippet: string;
  lines?: string;
}

interface AuditFinding {
  id: string;
  title: string;
  description: string;
  category: Category;
  severity: Severity;
  status: Status;
  detectedAt: Date;
  resolvedAt?: Date;
  detectedInVersion: string;
  resolvedInVersion?: string;
  evidences: Evidence[];
  remediation?: string;
}

const CURRENT_VERSION = "v1.4.0";
const LAST_AUDIT_DATE = new Date("2026-06-09T10:30:00");

const FINDINGS: AuditFinding[] = [
  {
    id: "DISPH-AUD-001",
    title: "Constante AI_MODELS triplicada com listas divergentes",
    description:
      "Modelos de IA estavam declarados em três pontos do código (AIChatConsole, agentSkills e AdminPage), com chaves e versões inconsistentes entre si.",
    category: "redundancia",
    severity: "high",
    status: "resolvido",
    detectedAt: new Date("2026-06-08T14:00:00"),
    resolvedAt: new Date("2026-06-08T16:20:00"),
    detectedInVersion: "v1.3.2",
    resolvedInVersion: "v1.4.0",
    evidences: [
      {
        file: "src/lib/aiModels.ts",
        lines: "1-30",
        snippet: `// Fonte ÚNICA dos modelos de IA disponíveis via Lovable AI Gateway.
export const AI_MODELS: AIModel[] = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", tier: "fast" },
  ...
];
export const DEFAULT_AI_MODEL = "google/gemini-2.5-flash";`,
      },
    ],
    remediation: "Criado src/lib/aiModels.ts como fonte única; todos os consumidores passaram a importar daqui.",
  },
  {
    id: "DISPH-AUD-002",
    title: "Componente AppSidebar.tsx órfão (dead code)",
    description:
      "Após migração para top nav, o componente AppSidebar permaneceu no repositório sem ser referenciado em nenhum lugar.",
    category: "dead_code",
    severity: "low",
    status: "resolvido",
    detectedAt: new Date("2026-06-08T14:05:00"),
    resolvedAt: new Date("2026-06-08T16:25:00"),
    detectedInVersion: "v1.3.2",
    resolvedInVersion: "v1.4.0",
    evidences: [
      { file: "src/components/AppSidebar.tsx", snippet: "// arquivo inteiro removido — nenhuma importação ativa" },
    ],
    remediation: "Arquivo removido do projeto.",
  },
  {
    id: "DISPH-AUD-003",
    title: "Toaster duplicado no App.tsx",
    description:
      "Dois componentes <Toaster /> estavam montados em paralelo (shadcn + Sonner), gerando notificações duplicadas em alguns fluxos.",
    category: "redundancia",
    severity: "medium",
    status: "resolvido",
    detectedAt: new Date("2026-06-08T14:10:00"),
    resolvedAt: new Date("2026-06-08T16:30:00"),
    detectedInVersion: "v1.3.2",
    resolvedInVersion: "v1.4.0",
    evidences: [
      {
        file: "src/App.tsx",
        lines: "26-28",
        snippet: `<TooltipProvider>
  <Sonner />          {/* único Toaster mantido */}
  <AuthProvider>`,
      },
    ],
    remediation: "Removido o Toaster shadcn — mantido somente Sonner.",
  },
  {
    id: "DISPH-AUD-004",
    title: "Bug: rota /audit bloqueava role 'auditor'",
    description:
      "A rota de Auditoria & Compliance LGPD exigia apenas role 'admin', impedindo o acesso de usuários com role 'auditor' (que é justamente o perfil destinado à página).",
    category: "bug",
    severity: "high",
    status: "resolvido",
    detectedAt: new Date("2026-06-08T14:15:00"),
    resolvedAt: new Date("2026-06-08T16:35:00"),
    detectedInVersion: "v1.3.0",
    resolvedInVersion: "v1.4.0",
    evidences: [
      {
        file: "src/App.tsx",
        lines: "84-88",
        snippet: `<ProtectedRoute requiredRoles={["admin", "auditor"]}>
  <AuditPage />
</ProtectedRoute>`,
      },
    ],
    remediation: "Adicionada role 'auditor' à lista de roles permitidas.",
  },
  {
    id: "DISPH-AUD-005",
    title: "Skills frontend ↔ backend com nomes divergentes",
    description:
      "Diversas skills tinham nomes diferentes entre o catálogo TypeScript e o registry Python (ex.: run_playbook vs trigger_ansible_playbook, scale_deployment vs k8s_scale_deployment).",
    category: "inconsistencia",
    severity: "high",
    status: "resolvido",
    detectedAt: new Date("2026-06-08T14:20:00"),
    resolvedAt: new Date("2026-06-08T16:45:00"),
    detectedInVersion: "v1.3.1",
    resolvedInVersion: "v1.4.0",
    evidences: [
      {
        file: "src/lib/agentSkills.ts",
        snippet: `// Padronizado para o snake_case do backend:
{ name: "trigger_ansible_playbook", category: "automation" }
{ name: "k8s_scale_deployment", category: "infrastructure" }
{ name: "create_gitlab_mr", category: "devsecops" }`,
      },
      {
        file: "disph-aiops-backend/app/skills/registry.py",
        snippet: "# nomes canônicos mantidos como referência",
      },
    ],
    remediation: "Renomeadas as skills do frontend para o padrão do backend; adicionadas 7 skills BE-only que faltavam no catálogo.",
  },
  {
    id: "DISPH-AUD-006",
    title: "console.error visível ao usuário no chat de IA",
    description:
      "Falhas na chamada ao gateway de IA caíam em console.error sem feedback visível para o operador.",
    category: "ux",
    severity: "low",
    status: "resolvido",
    detectedAt: new Date("2026-06-08T14:25:00"),
    resolvedAt: new Date("2026-06-08T16:50:00"),
    detectedInVersion: "v1.3.2",
    resolvedInVersion: "v1.4.0",
    evidences: [
      {
        file: "src/components/AIChatConsole.tsx",
        snippet: `// antes: console.error(err);
toast.error("Falha ao consultar o assistente DISPH", { description: err.message });`,
      },
    ],
    remediation: "Substituído por toast.error com mensagem amigável.",
  },
  {
    id: "DISPH-AUD-007",
    title: "Sistema SEI referenciado em docs porém não implementado",
    description:
      "Documentação mencionava integração com SEI (Sistema Eletrônico de Informações) que nunca foi implementada e foi descontinuada do escopo.",
    category: "documentacao",
    severity: "medium",
    status: "resolvido",
    detectedAt: new Date("2026-06-08T14:30:00"),
    resolvedAt: new Date("2026-06-08T17:00:00"),
    detectedInVersion: "v1.3.0",
    resolvedInVersion: "v1.4.0",
    evidences: [
      { file: "docs/02-arquitetura.md", snippet: "Integrações ativas: GLPI, Jira, ServiceNow, CITSmart, Freshservice, Azure DevOps." },
      { file: "docs/11-administracao.md", snippet: "Removida seção 'Configuração SEI'." },
    ],
    remediation: "Todas as referências a SEI foram removidas; provedores ITSM atuais documentados.",
  },
  {
    id: "DISPH-AUD-008",
    title: "10 tabelas não documentadas em 03-database-schema.md",
    description:
      "O schema persistido no Lovable Cloud possuía 16 tabelas, mas apenas 6 estavam descritas na documentação.",
    category: "documentacao",
    severity: "medium",
    status: "resolvido",
    detectedAt: new Date("2026-06-08T14:35:00"),
    resolvedAt: new Date("2026-06-08T17:10:00"),
    detectedInVersion: "v1.3.0",
    resolvedInVersion: "v1.4.0",
    evidences: [
      {
        file: "docs/03-database-schema.md",
        snippet: "Adicionadas: agents, agent_profiles, agent_skills, agent_channels, agent_executions, skill_catalog_settings, advisory_environment_assessments, ai_conversations, monitored_environments, clusters.",
      },
    ],
    remediation: "Documentação reescrita com todas as 16 tabelas e suas colunas-chave.",
  },
  {
    id: "DISPH-AUD-009",
    title: "Confirmação ausente para skills de risco ≥ 4",
    description:
      "Skills com riskLevel 4-5 (ex.: k8s_cordon_node, ansible_restart_service em produção) são executadas sem diálogo de confirmação obrigatório.",
    category: "ux",
    severity: "high",
    status: "aberto",
    detectedAt: new Date("2026-06-09T09:00:00"),
    detectedInVersion: "v1.4.0",
    evidences: [
      {
        file: "src/lib/agentSkills.ts",
        snippet: "// skills marcadas com riskLevel >= 4 ainda não disparam AlertDialog antes da execução.",
      },
    ],
    remediation: "Implementar AlertDialog de confirmação dupla + justificativa obrigatória (registrado no roadmap em .lovable/plan.md).",
  },
  {
    id: "DISPH-AUD-010",
    title: "advisory_environment_assessments sem UI exposta",
    description:
      "Tabela criada e populada por edge functions, mas sem visualização no console — operadores não conseguem revisar avaliações por ambiente.",
    category: "inconsistencia",
    severity: "medium",
    status: "aberto",
    detectedAt: new Date("2026-06-09T09:10:00"),
    detectedInVersion: "v1.4.0",
    evidences: [
      { file: "supabase/functions/ar-audit/index.ts", snippet: "// grava avaliações sem consumidor no frontend" },
    ],
    remediation: "Adicionar aba 'Avaliações por Ambiente' em ARPage (registrado no roadmap).",
  },
  {
    id: "DISPH-AUD-011",
    title: "Hypervisores (VMware/Hyper-V) sem coletor real — somente mock",
    description:
      "Nova página /hypervisors exibe hosts, VMs em risco e pontos de falha com dados mockados em memória. Falta integração com vCenter API e Hyper-V WMI/PowerShell para coleta real.",
    category: "inconsistencia",
    severity: "medium",
    status: "aberto",
    detectedAt: new Date("2026-06-15T10:00:00"),
    detectedInVersion: "v1.4.0",
    evidences: [
      {
        file: "src/pages/HypervisorsPage.tsx",
        snippet: "const HOSTS: HypervisorHost[] = [ /* dados mockados em memória */ ];",
      },
    ],
    remediation: "Implementar coletor backend (vCenter REST + Hyper-V WinRM) e persistir snapshot em tabela hypervisor_hosts.",
  },
];

const SEVERITY_STYLES: Record<Severity, string> = {
  info: "bg-muted text-muted-foreground border-border",
  low: "bg-primary/15 text-primary border-primary/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

const STATUS_STYLES: Record<Status, string> = {
  resolvido: "bg-accent/15 text-accent border-accent/30",
  aberto: "bg-destructive/15 text-destructive border-destructive/30",
  em_progresso: "bg-primary/15 text-primary border-primary/30",
  wontfix: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABELS: Record<Status, string> = {
  resolvido: "Resolvido",
  aberto: "Aberto",
  em_progresso: "Em Progresso",
  wontfix: "Não Será Corrigido",
};

const CATEGORY_LABELS: Record<Category, string> = {
  redundancia: "Redundância",
  inconsistencia: "Inconsistência",
  dead_code: "Código Morto",
  bug: "Bug Funcional",
  documentacao: "Documentação",
  ux: "UX/UI",
};

export default function SystemAuditPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return FINDINGS.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const haystack = `${f.id} ${f.title} ${f.description} ${f.evidences.map((e) => e.file).join(" ")}`.toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      return true;
    });
  }, [search, statusFilter, categoryFilter, severityFilter]);

  const stats = useMemo(() => ({
    total: FINDINGS.length,
    open: FINDINGS.filter((f) => f.status === "aberto" || f.status === "em_progresso").length,
    resolved: FINDINGS.filter((f) => f.status === "resolvido").length,
    critical: FINDINGS.filter((f) => f.severity === "critical" || f.severity === "high").length,
  }), []);

  const exportJSON = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      version: CURRENT_VERSION,
      lastAuditAt: LAST_AUDIT_DATE.toISOString(),
      findings: filtered,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disph_system_audit_${format(new Date(), "yyyyMMdd_HHmmss")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório de auditoria exportado", { description: `${filtered.length} achados` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 heading">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Auditoria Técnica do Sistema
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inconsistências, redundâncias e dead code identificados no console — com evidências, versão e data.
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" /> Versão atual: <span className="text-accent">{CURRENT_VERSION}</span>
            </span>
            <span>·</span>
            <span>
              Última auditoria: {format(LAST_AUDIT_DATE, "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
          </div>
        </div>
        <Button onClick={exportJSON} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar Relatório
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total de Achados", value: stats.total, icon: ClipboardCheck, color: "text-primary" },
          { label: "Resolvidos", value: stats.resolved, icon: CheckCircle2, color: "text-accent" },
          { label: "Em Aberto", value: stats.open, icon: AlertTriangle, color: "text-destructive" },
          { label: "Severidade Alta+", value: stats.critical, icon: AlertTriangle, color: "text-orange-400" },
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

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID, título, arquivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px] bg-secondary border-border"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px] bg-secondary border-border"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[150px] bg-secondary border-border"><SelectValue placeholder="Severidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="critical">Crítica</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-mono text-xs w-[140px]">ID</TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs">ACHADO</TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs w-[130px]">CATEGORIA</TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs w-[110px]">SEVERIDADE</TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs w-[130px]">STATUS</TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs w-[110px]">DETECTADO</TableHead>
                <TableHead className="text-muted-foreground font-mono text-xs w-[100px]">VERSÃO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((f) => (
                <TableRow key={f.id} className="border-border align-top">
                  <TableCell className="font-mono text-xs text-accent pt-4">{f.id}</TableCell>
                  <TableCell className="pt-3 pb-3">
                    <Accordion type="single" collapsible>
                      <AccordionItem value={f.id} className="border-0">
                        <AccordionTrigger className="hover:no-underline py-0 text-left">
                          <div className="flex flex-col gap-0.5 pr-3">
                            <span className="text-sm text-foreground font-medium">{f.title}</span>
                            <span className="text-xs text-muted-foreground line-clamp-1">{f.description}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-3 pb-1">
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">{f.description}</p>
                            {f.remediation && (
                              <div className="text-xs">
                                <span className="text-accent font-semibold">Remediação: </span>
                                <span className="text-foreground/80">{f.remediation}</span>
                              </div>
                            )}
                            <div className="space-y-2">
                              <p className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">
                                Evidências ({f.evidences.length})
                              </p>
                              {f.evidences.map((ev, i) => (
                                <div key={i} className="rounded border border-border bg-background/60 overflow-hidden">
                                  <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 border-b border-border">
                                    <FileCode className="h-3 w-3 text-primary" />
                                    <code className="text-[11px] font-mono text-foreground">{ev.file}</code>
                                    {ev.lines && (
                                      <Badge variant="outline" className="text-[9px] font-mono ml-auto">
                                        L{ev.lines}
                                      </Badge>
                                    )}
                                  </div>
                                  <pre className="text-[11px] font-mono text-muted-foreground p-3 overflow-x-auto whitespace-pre-wrap">
{ev.snippet}
                                  </pre>
                                </div>
                              ))}
                            </div>
                            {f.resolvedAt && (
                              <p className="text-[11px] text-accent font-mono">
                                ✓ Resolvido em {format(f.resolvedAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                {f.resolvedInVersion && ` · ${f.resolvedInVersion}`}
                              </p>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </TableCell>
                  <TableCell className="pt-4">
                    <Badge variant="outline" className="text-[10px] font-mono border-border">
                      {CATEGORY_LABELS[f.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="pt-4">
                    <Badge className={cn("text-[10px] font-mono border", SEVERITY_STYLES[f.severity])}>
                      {f.severity.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="pt-4">
                    <Badge className={cn("text-[10px] font-mono border", STATUS_STYLES[f.status])}>
                      {STATUS_LABELS[f.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground pt-4">
                    {format(f.detectedAt, "dd/MM/yy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="font-mono text-xs pt-4">
                    <div className="flex flex-col leading-tight">
                      <span className="text-foreground/80">{f.detectedInVersion}</span>
                      {f.resolvedInVersion && (
                        <span className="text-accent text-[10px]">→ {f.resolvedInVersion}</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhum achado para os filtros aplicados</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
