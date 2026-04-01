import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { EnvironmentFilter, type Environment } from "@/components/EnvironmentFilter";
import { AlertTriangle, Clock, CheckCircle, Play, Terminal, Brain, Activity, Zap } from "lucide-react";
import { useState, useMemo } from "react";
import { useRealtimeSeries, useRealtimeValue } from "@/hooks/useRealtimeData";

const mockIncidents = [
  {
    id: "INC-2024-0847",
    title: "OOMKilled — Pod payments-api no cluster ROSA-PROD",
    severity: "critical" as const,
    environment: "AWS ROSA Produção",
    envGroup: "AWS" as const,
    timestamp: "2024-03-31T14:23:00Z",
    status: "open",
    rootCause: "Memory limit de 512Mi excedido. Leak detectado no módulo de cache Redis. GC não coletando objetos da fila de transações.",
    evidence: [
      "kubectl logs payments-api-7d4f8b-x2k9z: java.lang.OutOfMemoryError: Java heap space",
      "Prometheus: container_memory_usage_bytes{pod='payments-api'} > 540Mi por 15min",
      "Zabbix: Alerta ZBX-MEMORY-HIGH disparado às 14:18",
    ],
    recommendation: "Executar playbook ansible/remediate-oom.yml para restart com limit ajustado para 1Gi e aplicar HPA com threshold 70%.",
    skill: "trigger_ansible_playbook",
  },
  {
    id: "INC-2024-0846",
    title: "CVE-2024-3094 — Vulnerabilidade crítica xz-utils no cluster OKD-DEV",
    severity: "critical" as const,
    environment: "OCI OKD Dev/HMG",
    envGroup: "OCI" as const,
    timestamp: "2024-03-31T12:05:00Z",
    status: "open",
    rootCause: "Imagem base node:18-alpine contém xz-utils 5.6.0 com backdoor confirmado. 14 pods afetados no namespace frontend-dev.",
    evidence: [
      "Trivy scan: CVE-2024-3094 (CRITICAL) em quay.corp/frontend:v2.3.1",
      "Red Hat ACS: Policy 'Critical CVE Block' triggered",
      "SonarQube: 3 code smells relacionados a dependências desatualizadas",
    ],
    recommendation: "Criar MR no GitLab para atualizar imagem base para node:18-alpine@sha256:abc123 (patched). ArgoCD sincronizará automaticamente.",
    skill: "create_gitlab_mr",
  },
  {
    id: "INC-2024-0845",
    title: "Latência elevada — API Gateway Traefik On-Premise",
    severity: "warning" as const,
    environment: "On-Premise Produção",
    envGroup: "On-Premise" as const,
    timestamp: "2024-03-31T10:30:00Z",
    status: "investigating",
    rootCause: "Rate limiting não configurado. Upstream backend-svc respondendo com p99 > 2s. Connection pool do PostgreSQL saturado.",
    evidence: [
      "Grafana: traefik_entrypoint_request_duration_seconds{quantile='0.99'} = 2.3s",
      "Zabbix: TCP connections PostgreSQL = 95/100 (threshold 80)",
    ],
    recommendation: "Aplicar rate limiting via IngressRoute e aumentar pool_size do PostgreSQL para 200 via Ansible.",
    skill: "trigger_ansible_playbook",
  },
  {
    id: "INC-2024-0844",
    title: "Disk pressure — Node worker-03 AWS ROSA-PROD",
    severity: "warning" as const,
    environment: "AWS ROSA Produção",
    envGroup: "AWS" as const,
    timestamp: "2024-03-31T09:15:00Z",
    status: "investigating",
    rootCause: "Volume /var/log com 91% de uso. Logs do Fluentd não rotacionados há 7 dias.",
    evidence: [
      "Zabbix: vfs.fs.pused[/var/log] = 91.2%",
      "Prometheus: node_filesystem_avail_bytes{mountpoint='/var/log'} < 2Gi",
    ],
    recommendation: "Executar playbook ansible/log-rotation.yml e configurar logrotate com retenção de 3 dias.",
    skill: "trigger_ansible_playbook",
  },
];

export default function IncidentsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(mockIncidents[0].id);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [envFilter, setEnvFilter] = useState<Environment>("all");

  const incidentsOpen = useRealtimeValue(12, 2, 5000);
  const mttr = useRealtimeValue(23, 5, 4000);
  const autoRemediation = useRealtimeValue(47, 3, 6000);

  const incidentSparkline = useRealtimeSeries(12, 3, 20, 3000);
  const mttrSparkline = useRealtimeSeries(23, 5, 20, 3500);
  const autoSparkline = useRealtimeSeries(47, 4, 20, 4000);
  const resolvedSparkline = useRealtimeSeries(8, 2, 20, 3000);

  const filteredIncidents = useMemo(() =>
    envFilter === "all" ? mockIncidents : mockIncidents.filter(inc => inc.envGroup === envFilter)
  , [envFilter]);

  const handleExecute = (incident: typeof mockIncidents[0]) => {
    setExecutingId(incident.id);
    setTerminalLines([]);
    const lines = [
      `$ disph-aiops execute --skill ${incident.skill} --incident ${incident.id}`,
      `[MFA] Verificação TOTP requerida... ✓ Aprovado`,
      `[GUARDRAIL] Validando comando contra políticas Red Hat ACS...`,
      `[GUARDRAIL] ✓ Nenhum comando destrutivo detectado`,
      `[AUDIT] Registrando ação no schema audit.action_logs`,
      `[SKILL] Executando ${incident.skill}()...`,
      `[SKILL] Conectando ao endpoint configurado...`,
      `[PROGRESS] ████████░░░░░░░░ 50%`,
      `[PROGRESS] ████████████████ 100%`,
      `[SUCCESS] Remediação concluída. GLPI ticket atualizado.`,
      `[TEAMS] Notificação enviada ao canal #ops-alerts`,
    ];
    lines.forEach((line, i) => {
      setTimeout(() => {
        setTerminalLines((prev) => [...prev, line]);
        if (i === lines.length - 1) {
          setTimeout(() => setExecutingId(null), 2000);
        }
      }, (i + 1) * 600);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Console de Incidentes AIOps</h1>
          <p className="text-sm text-muted-foreground font-mono">Motor de IA com Guardrails • Busca Híbrida RAG • MCP</p>
        </div>
        <EnvironmentFilter selected={envFilter} onChange={setEnvFilter} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Incidentes Abertos"
          value={Math.round(incidentsOpen)}
          subtitle="↑ 3 nas últimas 24h"
          icon={AlertTriangle}
          trend="down"
          sparklineData={incidentSparkline}
          drilldownItems={[
            { label: "AWS (ROSA)", value: mockIncidents.filter(i => i.envGroup === "AWS").length, env: "AWS" },
            { label: "OCI (OKD)", value: mockIncidents.filter(i => i.envGroup === "OCI").length, env: "OCI" },
            { label: "On-Premise", value: mockIncidents.filter(i => i.envGroup === "On-Premise").length, env: "On-Premise" },
          ]}
        />
        <MetricCard
          title="MTTR Médio"
          value={`${Math.round(mttr)}min`}
          subtitle="↓ 8min vs semana anterior"
          icon={Clock}
          trend="up"
          sparklineData={mttrSparkline}
          drilldownItems={[
            { label: "Críticos", value: "18min" },
            { label: "Warnings", value: "31min" },
            { label: "Info", value: "45min" },
          ]}
        />
        <MetricCard
          title="Auto-Remediações"
          value={Math.round(autoRemediation)}
          subtitle="Taxa de sucesso: 94%"
          icon={Zap}
          trend="up"
          sparklineData={autoSparkline}
          drilldownItems={[
            { label: "Ansible Playbooks", value: 28 },
            { label: "GitLab MRs", value: 12 },
            { label: "GLPI Tickets", value: 7 },
          ]}
        />
        <MetricCard
          title="Resolvidos Hoje"
          value={8}
          subtitle="5 automáticos, 3 manuais"
          icon={CheckCircle}
          trend="up"
          sparklineData={resolvedSparkline}
          drilldownItems={[
            { label: "Auto-remediação", value: 5 },
            { label: "Intervenção manual", value: 3 },
          ]}
        />
      </div>

      <div className="space-y-4">
        {filteredIncidents.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground font-mono">Nenhum incidente neste ambiente</p>
            </CardContent>
          </Card>
        )}
        {filteredIncidents.map((incident) => {
          const isExpanded = expandedId === incident.id;
          const isExecuting = executingId === incident.id;

          return (
            <Card
              key={incident.id}
              className={`bg-card border-border transition-all cursor-pointer ${
                incident.severity === "critical" ? "border-l-2 border-l-destructive" : "border-l-2 border-l-warning"
              }`}
              onClick={() => setExpandedId(isExpanded ? null : incident.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{incident.id}</span>
                      <Badge variant={incident.severity === "critical" ? "destructive" : "secondary"} className="text-[10px] font-mono uppercase">
                        {incident.severity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">{incident.envGroup}</Badge>
                      <StatusBadge status={incident.severity === "critical" ? "critical" : "warning"} />
                    </div>
                    <CardTitle className="text-base">{incident.title}</CardTitle>
                    <CardDescription className="font-mono text-xs">{incident.environment} • {new Date(incident.timestamp).toLocaleString("pt-BR")}</CardDescription>
                  </div>
                  <Brain className="h-5 w-5 text-accent shrink-0 mt-1" />
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-accent flex items-center gap-1.5">
                        <Activity className="h-3 w-3" /> Causa Raiz
                      </h4>
                      <p className="text-sm text-foreground/80 leading-relaxed">{incident.rootCause}</p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-accent flex items-center gap-1.5">
                        <Terminal className="h-3 w-3" /> Evidências
                      </h4>
                      <ul className="space-y-1">
                        {incident.evidence.map((ev, i) => (
                          <li key={i} className="text-xs font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1.5 break-all">{ev}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Zap className="h-3 w-3" /> Solução Recomendada
                      </h4>
                      <p className="text-sm text-foreground/80 leading-relaxed">{incident.recommendation}</p>
                      <Badge variant="outline" className="font-mono text-[10px]">Skill: {incident.skill}</Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    <Button
                      onClick={() => handleExecute(incident)}
                      disabled={isExecuting}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-xs gap-2"
                    >
                      <Play className="h-3 w-3" />
                      {isExecuting ? "Executando..." : "Aprovar e Executar"}
                    </Button>
                    <span className="text-[10px] text-muted-foreground font-mono">Requer MFA (TOTP) para aprovação</span>
                  </div>

                  {isExecuting && (
                    <div className="bg-background rounded-md border border-border p-4 font-mono text-xs space-y-0.5 max-h-60 overflow-auto">
                      {terminalLines.map((line, i) => (
                        <div key={i} className={`${
                          line.includes("SUCCESS") ? "text-success" :
                          line.includes("GUARDRAIL") ? "text-accent" :
                          line.includes("PROGRESS") ? "text-warning" :
                          line.includes("ERROR") ? "text-destructive" :
                          "text-muted-foreground"
                        }`}>{line}</div>
                      ))}
                      <span className="inline-block w-2 h-4 bg-primary/70 status-pulse" />
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
