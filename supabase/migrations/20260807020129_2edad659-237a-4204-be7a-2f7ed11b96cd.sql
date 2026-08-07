CREATE TABLE public.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'ctir_audit',
  tab text NOT NULL,
  format text NOT NULL CHECK (format IN ('csv','pdf')),
  scope text NOT NULL DEFAULT 'all' CHECK (scope IN ('all','page')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed','cancelled')),
  progress integer NOT NULL DEFAULT 0,
  row_count integer NOT NULL DEFAULT 0,
  storage_path text,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.export_jobs TO authenticated;
GRANT ALL ON public.export_jobs TO service_role;

ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own export jobs select" ON public.export_jobs
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own export jobs insert" ON public.export_jobs
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND public.has_any_role(auth.uid(), ARRAY['admin','auditor','operator']::app_role[])
  );
CREATE POLICY "own export jobs update" ON public.export_jobs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own export jobs delete" ON public.export_jobs
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_export_jobs_user_created ON public.export_jobs (user_id, created_at DESC);

CREATE TRIGGER trg_export_jobs_updated
  BEFORE UPDATE ON public.export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();