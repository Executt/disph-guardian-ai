import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildCsvBlob, buildPdfBlob, downloadBlob, exportFilename,
  type ExportMeta, type ExportScope,
} from "@/lib/ctirAuditExport";

export type ExportJob = {
  id: string;
  tab: string;
  format: "csv" | "pdf";
  scope: ExportScope;
  filters: any;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  progress: number;
  row_count: number;
  storage_path: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
};

export type ExportPayload = {
  headers: string[];
  rows: (string | number)[][];
  meta: ExportMeta;
};

const BUCKET = "ctir-exports";
const CHUNK = 250;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Fila de exportação CSV/PDF com geração em background.
 * - O pedido é persistido em `export_jobs` (RLS: cada usuário só vê os próprios).
 * - Um worker local processa a fila em fatias (sem travar a UI) e reporta progresso.
 * - O artefato é gravado em bucket privado sob `<uid>/<jobId>.<ext>` e baixado
 *   por URL assinada de curta duração (download seguro).
 */
export function useExportQueue(source = "ctir_audit") {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [busy, setBusy] = useState(false);
  const payloadsRef = useRef<Map<string, ExportPayload>>(new Map());
  const workingRef = useRef(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("export_jobs" as any)
      .select("id,tab,format,scope,filters,status,progress,row_count,storage_path,error,created_at,finished_at")
      .eq("source", source)
      .order("created_at", { ascending: false })
      .limit(20);
    setJobs(((data as unknown) as ExportJob[]) ?? []);
  }, [source]);

  useEffect(() => { refresh(); }, [refresh]);

  const patch = useCallback(async (id: string, values: Partial<ExportJob> & Record<string, any>) => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, ...values } as ExportJob : j)));
    await supabase.from("export_jobs" as any).update(values).eq("id", id);
  }, []);

  const process = useCallback(async (job: ExportJob) => {
    const payload = payloadsRef.current.get(job.id);
    if (!payload) {
      await patch(job.id, {
        status: "failed",
        error: "Payload indisponível — refaça a exportação nesta sessão.",
        finished_at: new Date().toISOString(),
      });
      return;
    }
    try {
      await patch(job.id, { status: "running", progress: 5, started_at: new Date().toISOString() });

      // fatiamento cooperativo: mantém a UI responsiva em grandes volumes
      const total = payload.rows.length;
      const built: (string | number)[][] = [];
      for (let i = 0; i < total; i += CHUNK) {
        built.push(...payload.rows.slice(i, i + CHUNK));
        await sleep(0);
        await patch(job.id, { progress: Math.min(80, 5 + Math.round((built.length / Math.max(1, total)) * 75)) });
      }

      const blob = job.format === "csv"
        ? buildCsvBlob(payload.headers, built, payload.meta)
        : buildPdfBlob(payload.headers, built, payload.meta);

      await patch(job.id, { progress: 90 });

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const path = `${uid}/${job.id}.${job.format}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: job.format === "csv" ? "text/csv" : "application/pdf",
        upsert: true,
      });
      if (upErr) throw upErr;

      await patch(job.id, {
        status: "done", progress: 100, storage_path: path,
        row_count: total, finished_at: new Date().toISOString(),
      });
    } catch (e: any) {
      await patch(job.id, {
        status: "failed", error: String(e?.message ?? e), finished_at: new Date().toISOString(),
      });
    } finally {
      payloadsRef.current.delete(job.id);
    }
  }, [patch]);

  const drain = useCallback(async () => {
    if (workingRef.current) return;
    workingRef.current = true;
    setBusy(true);
    try {
      // processa sequencialmente, na ordem de chegada
      let pending = jobs.filter(j => j.status === "queued");
      while (pending.length > 0) {
        const next = pending[pending.length - 1];
        await process(next);
        pending = pending.slice(0, -1);
      }
    } finally {
      workingRef.current = false;
      setBusy(false);
    }
  }, [jobs, process]);

  useEffect(() => {
    if (jobs.some(j => j.status === "queued")) void drain();
  }, [jobs, drain]);

  const enqueue = useCallback(async (
    opts: { tab: string; format: "csv" | "pdf"; scope: ExportScope; filters: any },
    payload: ExportPayload,
  ) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error("É necessário estar autenticado para exportar.");
    const { data, error } = await supabase
      .from("export_jobs" as any)
      .insert({
        user_id: uid, source,
        tab: opts.tab, format: opts.format, scope: opts.scope,
        filters: opts.filters, row_count: payload.rows.length,
      })
      .select()
      .single();
    if (error) throw error;
    const job = (data as unknown) as ExportJob;
    payloadsRef.current.set(job.id, payload);
    setJobs(prev => [job, ...prev]);
    return job;
  }, [source]);

  const download = useCallback(async (job: ExportJob) => {
    if (!job.storage_path) return;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(job.storage_path, 60, { download: exportFilename(job.filters ?? { tab: job.tab } as any, job.format) });
    if (error || !data?.signedUrl) throw error ?? new Error("Não foi possível gerar o link de download.");
    const res = await fetch(data.signedUrl);
    downloadBlob(await res.blob(), `${job.tab}-${job.id.slice(0, 8)}.${job.format}`);
  }, []);

  const remove = useCallback(async (job: ExportJob) => {
    if (job.storage_path) await supabase.storage.from(BUCKET).remove([job.storage_path]);
    await supabase.from("export_jobs" as any).delete().eq("id", job.id);
    setJobs(prev => prev.filter(j => j.id !== job.id));
  }, []);

  return { jobs, busy, enqueue, download, remove, refresh };
}
