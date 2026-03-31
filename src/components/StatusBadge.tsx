import { cn } from "@/lib/utils";

type Status = "healthy" | "warning" | "critical" | "unknown";

const statusConfig: Record<Status, { color: string; label: string }> = {
  healthy: { color: "bg-success", label: "Saudável" },
  warning: { color: "bg-warning", label: "Atenção" },
  critical: { color: "bg-destructive", label: "Crítico" },
  unknown: { color: "bg-muted-foreground", label: "Desconhecido" },
};

export function StatusBadge({ status }: { status: Status }) {
  const config = statusConfig[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono">
      <span className={cn("h-2 w-2 rounded-full", config.color, status === "critical" && "status-pulse")} />
      {config.label}
    </span>
  );
}
