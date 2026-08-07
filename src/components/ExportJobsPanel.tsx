import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Trash2, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { ExportJob } from "@/hooks/useExportQueue";

const STATUS = {
  queued: { label: "na fila", icon: Clock, cls: "text-muted-foreground border-border" },
  running: { label: "gerando", icon: Loader2, cls: "text-primary border-primary/40" },
  done: { label: "pronto", icon: CheckCircle2, cls: "text-accent border-accent/40" },
  failed: { label: "falhou", icon: XCircle, cls: "text-destructive border-destructive/40" },
  cancelled: { label: "cancelado", icon: XCircle, cls: "text-warning border-warning/40" },
} as const;

export default function ExportJobsPanel({
  jobs, onDownload, onRemove,
}: {
  jobs: ExportJob[];
  onDownload: (j: ExportJob) => Promise<void>;
  onRemove: (j: ExportJob) => Promise<void>;
}) {
  if (jobs.length === 0) return null;

  return (
    <Card data-testid="export-jobs-panel">
      <CardHeader className="pb-2">
        <CardTitle className="heading text-sm">Fila de exportações</CardTitle>
        <CardDescription>
          Geração em background · download por link assinado de curta duração
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {jobs.map(job => {
          const s = STATUS[job.status] ?? STATUS.queued;
          const Icon = s.icon;
          return (
            <div key={job.id} data-testid={`export-job-${job.id}`}
              className="flex items-center gap-3 border border-border/50 rounded px-3 py-2">
              <Icon className={`h-4 w-4 shrink-0 ${s.cls.split(" ")[0]} ${job.status === "running" ? "animate-spin" : ""}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="uppercase">{job.format}</span>
                  <span className="text-muted-foreground">· {job.tab}</span>
                  <span className="text-muted-foreground">
                    · {job.scope === "page" ? "página atual" : "todos filtrados"}
                  </span>
                  <Badge variant="outline" className={`text-[10px] ${s.cls}`}>{s.label}</Badge>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground">
                  {format(new Date(job.created_at), "dd/MM HH:mm")} · {job.row_count} registro(s)
                  {job.error ? ` · ${job.error}` : ""}
                </div>
                {(job.status === "queued" || job.status === "running") && (
                  <Progress className="h-1 mt-1" value={job.progress} />
                )}
              </div>
              {job.status === "done" && (
                <Button size="sm" variant="outline" aria-label="Baixar exportação"
                  onClick={() => onDownload(job).catch(e => toast.error(String(e?.message ?? e)))}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="sm" variant="ghost" aria-label="Remover exportação"
                onClick={() => onRemove(job).catch(e => toast.error(String(e?.message ?? e)))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
