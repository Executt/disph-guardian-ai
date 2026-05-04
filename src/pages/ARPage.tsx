import { useMemo, useState } from "react";
import {
  ShieldAlert, Search, Filter, ExternalLink, CheckCircle2, AlertTriangle,
  XCircle, Clock, TrendingUp, Database, Server, Lock, FileWarning,
  Activity, Eye, Zap, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Severity = "critical" | "high" | "medium" | "low";
type Compliance = "compliant" | "partial" | "non_compliant" | "not_applicable";
type Kind = "alert" | "recommendation";

interface AR {
  id: string;
  code: string;
  kind: Kind;
  title: string;
  source: string;
  publishedAt: string;
  severity: Severity;
  category: string;
  cve?: string[];
  affectedAssets: number;
  totalAssets: number;
  compliance: Compliance;
  description: string;
  recommendation: string;
  link: string;
}

const MOCK_AR: AR[] = [
  {
    id: "1", code: "CTIR-AL-2026-014", kind: "alert",
    title: "Vulnerabilidade Crítica em Servidores Apache HTTP",
    source: "CTIR Gov", publishedAt: "2026-04-28",
    severity: "critical", category: "Web Server",
    cve: ["CVE-2026-1234", "CVE-2026-1235"],
    affectedAssets: 12, totalAssets: 47,
    compliance: "non_compliant",
    description: "RCE em mod_proxy permite execução remota de código sem autenticação em versões 2.4.x < 2.4.59.",
    recommendation: "Atualizar imediatamente para Apache HTTP Server 2.4.59 ou superior. Aplicar WAF rule temporária.",
    link: "https://www.gov.br/ctir/pt-br/assuntos/alertas-e-recomendacoes/alertas",
  },
  {
    id: "2", code: "CTIR-AL-2026-013", kind: "alert",
    title: "Campanha de Phishing direcionada a órgãos federais",
    source: "CTIR Gov", publishedAt: "2026-04-25",
    severity: "high", category: "Phishing",
    affectedAssets: 0, totalAssets: 1240,
    compliance: "compliant",
    description: "Campanha utilizando domínios typosquatting de gov.br para roubo de credenciais SIAPE.",
    recommendation: "Reforçar treinamento anti-phishing, habilitar DMARC quarantine, bloquear IOCs no email gateway.",
    link: "https://www.gov.br/ctir/pt-br/assuntos/alertas-e-recomendacoes/alertas",
  },
  {
    id: "3", code: "CTIR-RC-2026-008", kind: "recommendation",
    title: "Hardening de Kubernetes em Produção",
    source: "CTIR Gov", publishedAt: "2026-04-20",
    severity: "high", category: "Container Security",
    affectedAssets: 4, totalAssets: 8,
    compliance: "partial",
    description: "Recomendações CIS Kubernetes Benchmark v1.9 para clusters em ambiente governamental.",
    recommendation: "Habilitar PodSecurityPolicy, NetworkPolicy default-deny, audit logs e RBAC granular.",
    link: "https://www.gov.br/ctir/pt-br/assuntos/alertas-e-recomendacoes/recomendacoes",
  },
  {
    id: "4", code: "CTIR-AL-2026-012", kind: "alert",
    title: "Exploração ativa de OpenSSH CVE-2026-9876",
    source: "CTIR Gov", publishedAt: "2026-04-18",
    severity: "critical", category: "SSH",
    cve: ["CVE-2026-9876"],
    affectedAssets: 23, totalAssets: 156,
    compliance: "non_compliant",
    description: "Pre-auth RCE em OpenSSH < 9.7. Exploits públicos disponíveis e em uso ativo.",
    recommendation: "Atualizar OpenSSH para 9.7+, restringir SSH a redes confiáveis, habilitar fail2ban.",
    link: "https://www.gov.br/ctir/pt-br/assuntos/alertas-e-recomendacoes/alertas",
  },
  {
    id: "5", code: "CTIR-RC-2026-007", kind: "recommendation",
    title: "Implementação de MFA em sistemas críticos",
    source: "CTIR Gov", publishedAt: "2026-04-15",
    severity: "high", category: "IAM",
    affectedAssets: 2, totalAssets: 8,
    compliance: "partial",
    description: "Recomendação SISP para uso obrigatório de MFA em contas administrativas.",
    recommendation: "Implementar TOTP/FIDO2 em todas as contas privilegiadas. Auditar mensalmente.",
    link: "https://www.gov.br/ctir/pt-br/assuntos/alertas-e-recomendacoes/recomendacoes",
  },
  {
    id: "6", code: "CTIR-AL-2026-011", kind: "alert",
    title: "Ransomware LockBit 5.0 visando setor público",
    source: "CTIR Gov", publishedAt: "2026-04-10",
    severity: "critical", category: "Ransomware",
    affectedAssets: 0, totalAssets: 47,
    compliance: "compliant",
    description: "Nova variante LockBit explora RDP exposto e CVE-2026-5555 em VPN gateways.",
    recommendation: "Validar backups offline, segmentar rede, bloquear RDP externo, atualizar VPN gateways.",
    link: "https://www.gov.br/ctir/pt-br/assuntos/alertas-e-recomendacoes/alertas",
  },
  {
    id: "7", code: "CTIR-RC-2026-006", kind: "recommendation",
    title: "Conformidade LGPD para dados pessoais em logs",
    source: "CTIR Gov", publishedAt: "2026-04-05",
    severity: "medium", category: "LGPD",
    affectedAssets: 18, totalAssets: 52,
    compliance: "partial",
    description: "Mascaramento de dados pessoais (CPF, email) em logs aplicacionais e de auditoria.",
    recommendation: "Implementar log scrubbing, retenção máxima de 6 meses e criptografia em repouso.",
    link: "https://www.gov.br/ctir/pt-br/assuntos/alertas-e-recomendacoes/recomendacoes",
  },
  {
    id: "8", code: "CTIR-AL-2026-010", kind: "alert",
    title: "Vulnerabilidade em PostgreSQL 16.x",
    source: "CTIR Gov", publishedAt: "2026-04-01",
    severity: "medium", category: "Database",
    cve: ["CVE-2026-3322"],
    affectedAssets: 6, totalAssets: 14,
    compliance: "partial",
    description: "Privilege escalation via funções SQL em PostgreSQL 16.0-16.2.",
    recommendation: "Atualizar para PostgreSQL 16.3+. Revisar grants de funções customizadas.",
    link: "https://www.gov.br/ctir/pt-br/assuntos/alertas-e-recomendacoes/alertas",
  },
];

const SEVERITY_STYLE: Record<Severity, { label: string; cls: string; icon: typeof ShieldAlert }> = {
  critical: { label: "Crítico", cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
  high: { label: "Alto", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: AlertTriangle },
  medium: { label: "Médio", cls: "bg-warning/15 text-warning border-warning/30", icon: Clock },
  low: { label: "Baixo", cls: "bg-accent/15 text-accent border-accent/30", icon: CheckCircle2 },
};

const COMPLIANCE_STYLE: Record<Compliance, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  compliant: { label: "Conforme", cls: "bg-accent/15 text-accent border-accent/30", icon: CheckCircle2 },
  partial: { label: "Parcial", cls: "bg-warning/15 text-warning border-warning/30", icon: AlertTriangle },
  non_compliant: { label: "Não Conforme", cls: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
  not_applicable: { label: "N/A", cls: "bg-muted text-muted-foreground border-border", icon: Eye },
};

export default function ARPage() {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");
  const [compliance, setCompliance] = useState<string>("all");
  const [selected, setSelected] = useState<AR | null>(null);

  const filtered = useMemo(() => {
    return MOCK_AR.filter((a) => {
      if (search && !a.title.toLowerCase().includes(search.toLowerCase()) &&
          !a.code.toLowerCase().includes(search.toLowerCase())) return false;
      if (severity !== "all" && a.severity !== severity) return false;
      if (kind !== "all" && a.kind !== kind) return false;
      if (compliance !== "all" && a.compliance !== compliance) return false;
      return true;
    });
  }, [search, severity, kind, compliance]);

  const stats = useMemo(() => {
    const total = MOCK_AR.length;
    const critical = MOCK_AR.filter((a) => a.severity === "critical").length;
    const nonCompliant = MOCK_AR.filter((a) => a.compliance === "non_compliant").length;
    const partial = MOCK_AR.filter((a) => a.compliance === "partial").length;
    const compliant = MOCK_AR.filter((a) => a.compliance === "compliant").length;
    const totalAffected = MOCK_AR.reduce((s, a) => s + a.affectedAssets, 0);
    const score = Math.round((compliant / total) * 100);
    return { total, critical, nonCompliant, partial, compliant, totalAffected, score };
  }, []);

  return (
    <div className="space-y-6">
      {/* Hero / Header inspirado em Trend Vision One */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8">
        <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-mono text-[10px]">
                MÓDULO AR · CTIR Gov
              </Badge>
              <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30 font-mono text-[10px]">
                <Activity className="h-3 w-3 mr-1" /> SYNC ATIVO
              </Badge>
            </div>
            <h1 className="heading text-3xl lg:text-4xl font-bold mb-3 tracking-tight">
              Alertas e Recomendações
            </h1>
            <p className="text-muted-foreground text-sm lg:text-base mb-4">
              Descubra, classifique, rastreie e correlacione alertas do CTIR Gov com o ambiente monitorado.
              Análise cruzada em tempo real com priorização inteligente de riscos e resposta orientada a compliance.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-2">
                <Zap className="h-4 w-4" /> Executar Análise Cruzada
              </Button>
              <Button size="sm" variant="outline" className="gap-2" asChild>
                <a href="https://www.gov.br/ctir/pt-br/assuntos/alertas-e-recomendacoes" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Fonte Oficial CTIR
                </a>
              </Button>
            </div>
          </div>
          {/* Score card */}
          <Card className="w-full lg:w-80 shrink-0 border-primary/20 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardDescription className="font-mono text-[10px] tracking-wider">SECURITY POSTURE SCORE</CardDescription>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold heading text-primary">{stats.score}</span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={stats.score} className="h-2" />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>{stats.compliant} conformes</span>
                <span>{stats.partial} parciais</span>
                <span className="text-destructive">{stats.nonCompliant} críticos</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={ShieldAlert} label="Total Alertas/Recs" value={stats.total} hint="Sincronizados CTIR" tone="primary" />
        <KpiCard icon={XCircle} label="Severidade Crítica" value={stats.critical} hint="Ação imediata" tone="destructive" />
        <KpiCard icon={FileWarning} label="Não Conformes" value={stats.nonCompliant} hint="Gap de compliance" tone="warning" />
        <KpiCard icon={Server} label="Ativos Afetados" value={stats.totalAffected} hint="Cross-env exposure" tone="accent" />
      </div>

      {/* Tabs principais */}
      <Tabs defaultValue="cross" className="space-y-4">
        <TabsList className="grid grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="cross" className="gap-2"><BarChart3 className="h-3.5 w-3.5" /> Análise Cruzada</TabsTrigger>
          <TabsTrigger value="catalog" className="gap-2"><Database className="h-3.5 w-3.5" /> Catálogo CTIR</TabsTrigger>
          <TabsTrigger value="coverage" className="gap-2"><Lock className="h-3.5 w-3.5" /> Cobertura</TabsTrigger>
        </TabsList>

        {/* === Análise Cruzada === */}
        <TabsContent value="cross" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <CardTitle className="heading text-lg">Correlação Ambiente × CTIR</CardTitle>
                  <CardDescription>Análise automática do gap entre alertas publicados e ativos monitorados</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar AR ou CVE..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-9 pl-8 w-56 text-xs"
                    />
                  </div>
                  <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos tipos</SelectItem>
                      <SelectItem value="alert">Alertas</SelectItem>
                      <SelectItem value="recommendation">Recomendações</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Severidade</SelectItem>
                      <SelectItem value="critical">Crítico</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                      <SelectItem value="medium">Médio</SelectItem>
                      <SelectItem value="low">Baixo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={compliance} onValueChange={setCompliance}>
                    <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Compliance</SelectItem>
                      <SelectItem value="compliant">Conforme</SelectItem>
                      <SelectItem value="partial">Parcial</SelectItem>
                      <SelectItem value="non_compliant">Não Conforme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Código</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Título</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Severidade</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Categoria</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Exposição</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider">Compliance</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase tracking-wider text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const SevIcon = SEVERITY_STYLE[a.severity].icon;
                    const CompIcon = COMPLIANCE_STYLE[a.compliance].icon;
                    const exposure = a.totalAssets > 0 ? Math.round((a.affectedAssets / a.totalAssets) * 100) : 0;
                    return (
                      <TableRow key={a.id} className="cursor-pointer" onClick={() => setSelected(a)}>
                        <TableCell className="font-mono text-xs text-primary">{a.code}</TableCell>
                        <TableCell className="max-w-md">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] font-mono uppercase">
                              {a.kind === "alert" ? "ALT" : "REC"}
                            </Badge>
                            <span className="text-sm truncate">{a.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-mono uppercase gap-1 ${SEVERITY_STYLE[a.severity].cls}`}>
                            <SevIcon className="h-3 w-3" />
                            {SEVERITY_STYLE[a.severity].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.category}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={exposure} className="h-1.5 flex-1" />
                            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                              {a.affectedAssets}/{a.totalAssets}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-mono uppercase gap-1 ${COMPLIANCE_STYLE[a.compliance].cls}`}>
                            <CompIcon className="h-3 w-3" />
                            {COMPLIANCE_STYLE[a.compliance].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-xs">Detalhar</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                        Nenhum item encontrado para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Catálogo === */}
        <TabsContent value="catalog" className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((a) => {
              const SevIcon = SEVERITY_STYLE[a.severity].icon;
              return (
                <Card key={a.id} className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => setSelected(a)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className="text-[9px] font-mono uppercase">
                        {a.kind === "alert" ? "ALERTA" : "RECOMENDAÇÃO"}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] font-mono uppercase gap-1 ${SEVERITY_STYLE[a.severity].cls}`}>
                        <SevIcon className="h-3 w-3" />
                        {SEVERITY_STYLE[a.severity].label}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm leading-snug heading">{a.title}</CardTitle>
                    <CardDescription className="font-mono text-[10px]">{a.code} · {a.publishedAt}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                    {a.cve && (
                      <div className="flex flex-wrap gap-1">
                        {a.cve.map((c) => (
                          <Badge key={c} variant="outline" className="text-[9px] font-mono">{c}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {a.affectedAssets}/{a.totalAssets} ativos
                      </span>
                      <Badge variant="outline" className={`text-[10px] font-mono ${COMPLIANCE_STYLE[a.compliance].cls}`}>
                        {COMPLIANCE_STYLE[a.compliance].label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* === Cobertura === */}
        <TabsContent value="coverage" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <CoverageCard title="Conformes" count={stats.compliant} total={stats.total} tone="accent" icon={CheckCircle2} />
            <CoverageCard title="Conformidade Parcial" count={stats.partial} total={stats.total} tone="warning" icon={AlertTriangle} />
            <CoverageCard title="Não Conformes" count={stats.nonCompliant} total={stats.total} tone="destructive" icon={XCircle} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="heading text-lg">Cobertura por Categoria</CardTitle>
              <CardDescription>Mapeamento de domínios técnicos vs. alertas CTIR ativos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from(new Set(MOCK_AR.map((a) => a.category))).map((cat) => {
                const items = MOCK_AR.filter((a) => a.category === cat);
                const ok = items.filter((a) => a.compliance === "compliant").length;
                const pct = Math.round((ok / items.length) * 100);
                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{cat}</span>
                      <span className="font-mono text-muted-foreground">{ok}/{items.length} conformes ({pct}%)</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog detalhe */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{selected.code}</Badge>
                  <Badge variant="outline" className={`font-mono text-[10px] ${SEVERITY_STYLE[selected.severity].cls}`}>
                    {SEVERITY_STYLE[selected.severity].label}
                  </Badge>
                  <Badge variant="outline" className={`font-mono text-[10px] ${COMPLIANCE_STYLE[selected.compliance].cls}`}>
                    {COMPLIANCE_STYLE[selected.compliance].label}
                  </Badge>
                </div>
                <DialogTitle className="heading">{selected.title}</DialogTitle>
                <DialogDescription className="font-mono text-xs">
                  {selected.source} · Publicado em {selected.publishedAt}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <section>
                  <h4 className="font-semibold mb-1 text-xs uppercase tracking-wider text-muted-foreground">Descrição</h4>
                  <p className="text-muted-foreground">{selected.description}</p>
                </section>
                <section>
                  <h4 className="font-semibold mb-1 text-xs uppercase tracking-wider text-muted-foreground">Recomendação</h4>
                  <p className="text-muted-foreground">{selected.recommendation}</p>
                </section>
                {selected.cve && (
                  <section>
                    <h4 className="font-semibold mb-1 text-xs uppercase tracking-wider text-muted-foreground">CVEs</h4>
                    <div className="flex flex-wrap gap-1">
                      {selected.cve.map((c) => (
                        <Badge key={c} variant="outline" className="font-mono text-xs">{c}</Badge>
                      ))}
                    </div>
                  </section>
                )}
                <section className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Ativos afetados</p>
                    <p className="text-2xl font-bold heading text-destructive">{selected.affectedAssets}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Ativos totais</p>
                    <p className="text-2xl font-bold heading">{selected.totalAssets}</p>
                  </div>
                </section>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="gap-2"><Zap className="h-3.5 w-3.5" /> Criar Plano de Remediação</Button>
                  <Button size="sm" variant="outline" className="gap-2" asChild>
                    <a href={selected.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Ver no CTIR
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint, tone }: {
  icon: typeof ShieldAlert; label: string; value: number; hint: string;
  tone: "primary" | "destructive" | "warning" | "accent";
}) {
  const toneCls = {
    primary: "text-primary bg-primary/10 border-primary/20",
    destructive: "text-destructive bg-destructive/10 border-destructive/20",
    warning: "text-warning bg-warning/10 border-warning/20",
    accent: "text-accent bg-accent/10 border-accent/20",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-9 w-9 rounded-lg border flex items-center justify-center ${toneCls}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold heading">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  );
}

function CoverageCard({ title, count, total, tone, icon: Icon }: {
  title: string; count: number; total: number;
  tone: "accent" | "warning" | "destructive";
  icon: typeof CheckCircle2;
}) {
  const pct = Math.round((count / total) * 100);
  const toneCls = {
    accent: "text-accent",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <Icon className={`h-5 w-5 ${toneCls}`} />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`text-3xl font-bold heading ${toneCls}`}>{count}</span>
          <span className="text-xs text-muted-foreground">/ {total} ({pct}%)</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </CardContent>
    </Card>
  );
}
