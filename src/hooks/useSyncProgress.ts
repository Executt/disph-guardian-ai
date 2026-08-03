import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveEvent = {
  id: string;
  source: string;
  kind: string;
  severity: string;
  message: string;
  details?: any;
  created_at: string;
};

export type Transport = "connecting" | "websocket" | "polling";

/**
 * Progresso em tempo real das execuções de sync.
 * Usa o canal WebSocket (Realtime) e cai automaticamente para polling
 * quando a conexão falha, com reconexão em backoff exponencial.
 */
export function useSyncProgress(source: "ctir" | "nvd", enabled = true) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [transport, setTransport] = useState<Transport>("connecting");
  const [reconnects, setReconnects] = useState(0);

  const sinceRef = useRef<string>(new Date().toISOString());
  const seenRef = useRef<Set<string>>(new Set());
  const attemptRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback((rows: LiveEvent[]) => {
    if (rows.length === 0) return;
    setEvents(prev => {
      const next = [...rows.filter(r => !seenRef.current.has(r.id)), ...prev];
      rows.forEach(r => seenRef.current.add(r.id));
      return next.slice(0, 50);
    });
    const newest = rows.map(r => r.created_at).sort().pop();
    if (newest && newest > sinceRef.current) sinceRef.current = newest;
  }, []);

  const poll = useCallback(async () => {
    const { data } = await supabase
      .from("sync_alerts" as any)
      .select("id,source,kind,severity,message,details,created_at")
      .eq("source", source)
      .gt("created_at", sinceRef.current)
      .order("created_at", { ascending: false })
      .limit(20);
    push(((data as unknown) as LiveEvent[]) ?? []);
  }, [source, push]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setTransport("polling");
    pollRef.current = setInterval(poll, 3000);
  }, [poll]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const connect = () => {
      if (disposed) return;
      channel = supabase
        .channel(`sync-progress-${source}-${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "sync_alerts" },
          (payload: any) => {
            const row = payload.new as LiveEvent;
            if (row?.source !== source) return;
            push([row]);
          },
        )
        .subscribe((status: string) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            attemptRef.current = 0;
            stopPolling();
            setTransport("websocket");
            // recupera eventos perdidos durante a queda
            poll();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            startPolling();
            const delay = Math.min(30000, 1000 * 2 ** attemptRef.current++);
            setReconnects(n => n + 1);
            if (channel) supabase.removeChannel(channel);
            channel = null;
            retryRef.current = setTimeout(connect, delay);
          }
        });
    };

    connect();
    // se o WebSocket não conectar em 5s, garante progresso via polling
    const guard = setTimeout(() => { if (!disposed) startPolling(); }, 5000);

    return () => {
      disposed = true;
      clearTimeout(guard);
      if (retryRef.current) clearTimeout(retryRef.current);
      stopPolling();
      if (channel) supabase.removeChannel(channel);
    };
  }, [source, enabled, push, poll, startPolling, stopPolling]);

  const reset = useCallback(() => {
    setEvents([]);
    seenRef.current = new Set();
    sinceRef.current = new Date().toISOString();
  }, []);

  return { events, transport, reconnects, reset, poll };
}
