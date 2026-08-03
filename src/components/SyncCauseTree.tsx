import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Play, Rss, AlertTriangle, RefreshCw, Bug, CircleDot } from "lucide-react";
import { format } from "date-fns";

export type TreeNode = {
  id: string;
  label: string;
  kind: "run" | "feed" | "retry" | "error" | "alert";
  severity?: "ok" | "warning" | "error" | "critical";
  meta?: Record<string, unknown>;
  children: TreeNode[];
};

type Run = { id: string; created_at: string; details: any };
type Alert = { id: string; kind: string; severity: string; message: string; details: any; created_at: string };

const ICONS = {
  run: Play, feed: Rss, retry: RefreshCw, error: Bug, alert: AlertTriangle,
} as const;

const toneOf = (s?: string) =>
  s === "critical" || s === "error" ? "text-destructive"
  : s === "warning" ? "text-warning"
  : "text-accent";

export function buildCauseTree(run: Run, alerts: Alert[]): TreeNode {
  const d = run.details ?? {};
  const failures: any[] = Array.isArray(d.failures) ? d.failures : [];
  const runWindowStart = new Date(run.created_at).getTime() - (d.duration_ms ?? 60000) - 5000;
  const runAlerts = alerts.filter(a => {
    const t = new Date(a.created_at).getTime();
    return t >= runWindowStart && t <= new Date(run.created_at).getTime() + 5000;
  });

  const feedNodes: TreeNode[] = failures.map((f, i) => {
    const url = f.feed_url ?? `feed-${i}`;
    const related = runAlerts.filter(a => a.details?.feed_url === url);
    const children: TreeNode[] = [];
    if ((f.attempts ?? 1) > 1) {
      children.push({
        id: `${run.id}-f${i}-retry`,
        label: `${f.attempts} tentativas com backoff`,
        kind: "retry",
        severity: "warning",
        meta: { attempts: f.attempts },
        children: [],
      });
    }
    children.push({
      id: `${run.id}-f${i}-err`,
      label: f.reason ?? "erro desconhecido",
      kind: "error",
      severity: "error",
      meta: { feed_url: url, status: f.status, reason: f.reason },
      children: [],
    });
    related.forEach(a => children.push({
      id: `${run.id}-f${i}-a-${a.id}`,
      label: `${a.kind}: ${a.message}`,
      kind: "alert",
      severity: a.severity as any,
      meta: { ...a.details, created_at: a.created_at },
      children: [],
    }));
    return {
      id: `${run.id}-f${i}`,
      label: `${f.kind ?? "feed"}/${f.year ?? "—"}`,
      kind: "feed",
      severity: "error",
      meta: { feed_url: url, attempts: f.attempts },
      children,
    };
  });

  const orphanAlerts = runAlerts
    .filter(a => !failures.some(f => f.feed_url === a.details?.feed_url))
    .map(a => ({
      id: `${run.id}-oa-${a.id}`,
      label: `${a.kind}: ${a.message}`,
      kind: "alert" as const,
      severity: a.severity as any,
      meta: { ...a.details, created_at: a.created_at },
      children: [],
    }));

  return {
    id: run.id,
    label: `Execução ${format(new Date(run.created_at), "dd/MM HH:mm")} · ${d.trigger_source ?? "manual"}`,
    kind: "run",
    severity: (d.errors ?? 0) > 0 ? "error" : "ok",
    meta: {
      feeds_checked: d.feeds_checked, inserted: d.inserted, updated: d.updated,
      retries: d.retries, errors: d.errors, duration_ms: d.duration_ms,
      trigger_source: d.trigger_source,
    },
    children: [...feedNodes, ...orphanAlerts],
  };
}

function NodeRow({ node, depth, selected, onSelect, open, toggle }: {
  node: TreeNode; depth: number; selected: string | null;
  onSelect: (n: TreeNode) => void; open: Set<string>; toggle: (id: string) => void;
}) {
  const Icon = ICONS[node.kind] ?? CircleDot;
  const isOpen = open.has(node.id);
  const hasKids = node.children.length > 0;
  return (
    <div>
      <button
        type="button"
        onClick={() => { onSelect(node); if (hasKids) toggle(node.id); }}
        style={{ paddingLeft: depth * 18 + 8 }}
        className={`w-full flex items-center gap-2 text-left py-1.5 pr-2 rounded text-xs font-mono border-l border-border/40 hover:bg-muted/40 ${
          selected === node.id ? "bg-muted/60 ring-1 ring-primary/40" : ""
        }`}
      >
        {hasKids
          ? (isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />)
          : <span className="w-3 shrink-0" />}
        <Icon className={`h-3.5 w-3.5 shrink-0 ${toneOf(node.severity)}`} />
        <span className="truncate">{node.label}</span>
        {hasKids && <Badge variant="outline" className="ml-auto text-[9px]">{node.children.length}</Badge>}
      </button>
      {isOpen && node.children.map(c => (
        <NodeRow key={c.id} node={c} depth={depth + 1} selected={selected}
          onSelect={onSelect} open={open} toggle={toggle} />
      ))}
    </div>
  );
}

export default function SyncCauseTree({ runs, alerts }: { runs: Run[]; alerts: Alert[] }) {
  const trees = useMemo(() => runs.slice(0, 20).map(r => buildCauseTree(r, alerts)), [runs, alerts]);
  const [open, setOpen] = useState<Set<string>>(new Set(trees.slice(0, 1).map(t => t.id)));
  const [selected, setSelected] = useState<TreeNode | null>(null);

  const toggle = (id: string) => setOpen(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <div className="grid md:grid-cols-[1.6fr_1fr] gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="heading text-sm">Árvore de causa-raiz</CardTitle>
          <CardDescription>Execução → feed → retentativas → erro → alerta</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[520px] overflow-y-auto" data-testid="cause-tree">
          {trees.length === 0 ? (
            <div className="text-xs font-mono text-muted-foreground py-6 text-center">
              Nenhuma execução no período selecionado.
            </div>
          ) : trees.map(t => (
            <NodeRow key={t.id} node={t} depth={0} selected={selected?.id ?? null}
              onSelect={setSelected} open={open} toggle={toggle} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="heading text-sm">Detalhes do nó</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!selected ? (
            <div className="text-xs font-mono text-muted-foreground">Selecione um nó na árvore.</div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{selected.kind}</Badge>
                {selected.severity && (
                  <Badge variant="outline" className={`text-[10px] ${toneOf(selected.severity)}`}>
                    {selected.severity}
                  </Badge>
                )}
              </div>
              <div className="text-xs">{selected.label}</div>
              <pre className="text-[10px] font-mono bg-muted/30 rounded p-2 overflow-x-auto max-h-72">
                {JSON.stringify(selected.meta ?? {}, null, 2)}
              </pre>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
