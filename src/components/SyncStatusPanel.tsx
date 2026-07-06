import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Props = {
  source: "ctir" | "nvd";
  functionName: string;
};

type Health = {
  feed_url: string;
  last_status: number | null;
  last_fetched_at: string | null;
  last_item_published_at: string | null;
  items_seen: number | null;
};

type Alert = {
  id: string;
  kind: string;
  severity: string;
  message: string;
  created_at: string;
  resolved_at: string | null;
};

export default function SyncStatusPanel({ source, functionName }: Props) {
  const [rows, setRows] = useState<Health[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [h, a] = await Promise.all([
      (supabase as any).from("sync_health_v").select("*").eq("source", source),
      supabase
        .from("sync_alerts" as any)
        .select("id,kind,severity,message,created_at,resolved_at")
        .eq("source", source)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setRows((h.data as Health[]) ?? []);
    setAlerts(((a.data as unknown) as Alert[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`sync-${source}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sync_alerts" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [source]);

  const runSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body: {} });
      if (error) throw error;
      toast.success(`Sync ${source.toUpperCase()} concluído`, {
        description: JSON.stringify(data).slice(0, 120),
      });
      await load();
    } catch (e: any) {
      toast.error(`Falha ${source}: ${e?.message ?? e}`);
    } finally { setSyncing(false); }
  };

  const resolveAlert = async (id: string) => {
    const { error } = await supabase
      .from("sync_alerts" as any)
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Alerta resolvido");
    load();
  };

  const lastFetch = rows.reduce<string | null>((acc, r) => {
    if (!r.last_fetched_at) return acc;
    if (!acc || new Date(r.last_fetched_at) > new Date(acc)) return r.last_fetched_at;
    return acc;
  }, null);

  const totalItems = rows.reduce((s, r) => s + (r.items_seen ?? 0), 0);
  const errorCount = rows.filter(r => (r.last_status ?? 0) >= 400).length;
  const openAlerts = alerts.filter(a => !a.resolved_at);

  const status: "ok" | "warn" | "err" =
    openAlerts.some(a => a.severity === "critical" || a.severity === "error") ? "err" :
    openAlerts.length > 0 || errorCount > 0 ? "warn" : "ok";

  const statusMeta = {
    ok:   { icon: CheckCircle2, cls: "text-success", label: "Saudável" },
    warn: { icon: AlertTriangle, cls: "text-warning", label: "Atenção" },
    err:  { icon: XCircle, cls: "text-destructive", label: "Falha" },
  }[status];
  const StatusIcon = statusMeta.icon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm heading flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${statusMeta.cls}`} />
            Sincronização · {source.toUpperCase()}
            <Badge variant="outline" className={`text-[10px] font-mono ${statusMeta.cls}`}>
              {statusMeta.label}
            </Badge>
          </CardTitle>
          <Button size="sm" variant="outline" onClick={runSync} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar agora
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Última execução</div>
            <div className="flex items-center gap-1"><Clock className="h-3 w-3" />
              {lastFetch ? formatDistanceToNow(new Date(lastFetch), { addSuffix: true, locale: ptBR }) : "nunca"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Feeds/Watches</div>
            <div>{rows.length}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Itens vistos</div>
            <div>{totalItems}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Alertas abertos</div>
            <div className={openAlerts.length > 0 ? "text-warning" : ""}>{openAlerts.length}</div>
          </div>
        </div>

        {loading ? null : alerts.length === 0 ? (
          <div className="text-[11px] font-mono text-muted-foreground">Sem alertas recentes.</div>
        ) : (
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-mono text-muted-foreground">Alertas recentes</div>
            {alerts.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-2 text-[11px] font-mono border border-border/40 rounded px-2 py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className={
                    a.severity === "critical" ? "text-destructive border-destructive/40" :
                    a.severity === "error" ? "text-destructive border-destructive/40" :
                    "text-warning border-warning/40"
                  }>{a.kind}</Badge>
                  <span className="truncate">{a.message}</span>
                  <span className="text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                {a.resolved_at ? (
                  <Badge variant="outline" className="text-success border-success/40">resolvido</Badge>
                ) : (
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => resolveAlert(a.id)}>
                    Resolver
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
