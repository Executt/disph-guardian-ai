
-- 1) Unique index for watchlist (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS nvd_watchlist_unique_kind_value
  ON public.nvd_watchlist (kind, lower(value));

-- 2) CVE change history
CREATE TABLE IF NOT EXISTS public.nvd_vulnerability_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cve_id text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  field text NOT NULL,
  old_value jsonb,
  new_value jsonb
);
CREATE INDEX IF NOT EXISTS nvd_vuln_history_cve_idx ON public.nvd_vulnerability_history (cve_id, changed_at DESC);
GRANT SELECT ON public.nvd_vulnerability_history TO authenticated;
GRANT ALL ON public.nvd_vulnerability_history TO service_role;
ALTER TABLE public.nvd_vulnerability_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read nvd history" ON public.nvd_vulnerability_history
  FOR SELECT TO authenticated USING (true);

-- 3) Trigger to record changes
CREATE OR REPLACE FUNCTION public.nvd_vuln_track_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.cvss_score IS DISTINCT FROM OLD.cvss_score THEN
    INSERT INTO public.nvd_vulnerability_history(cve_id, field, old_value, new_value)
    VALUES (NEW.cve_id, 'cvss_score', to_jsonb(OLD.cvss_score), to_jsonb(NEW.cvss_score));
  END IF;
  IF NEW.severity IS DISTINCT FROM OLD.severity THEN
    INSERT INTO public.nvd_vulnerability_history(cve_id, field, old_value, new_value)
    VALUES (NEW.cve_id, 'severity', to_jsonb(OLD.severity), to_jsonb(NEW.severity));
  END IF;
  IF NEW.last_modified IS DISTINCT FROM OLD.last_modified THEN
    INSERT INTO public.nvd_vulnerability_history(cve_id, field, old_value, new_value)
    VALUES (NEW.cve_id, 'last_modified', to_jsonb(OLD.last_modified), to_jsonb(NEW.last_modified));
  END IF;
  IF NEW.summary IS DISTINCT FROM OLD.summary THEN
    INSERT INTO public.nvd_vulnerability_history(cve_id, field, old_value, new_value)
    VALUES (NEW.cve_id, 'summary', to_jsonb(OLD.summary), to_jsonb(NEW.summary));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS nvd_vuln_history_tg ON public.nvd_vulnerabilities;
CREATE TRIGGER nvd_vuln_history_tg
  AFTER UPDATE ON public.nvd_vulnerabilities
  FOR EACH ROW EXECUTE FUNCTION public.nvd_vuln_track_changes();

-- 4) Sync alerts
CREATE TABLE IF NOT EXISTS public.sync_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,             -- 'ctir' | 'nvd'
  kind text NOT NULL,               -- 'empty_feed'|'timeout'|'rate_limit'|'http_error'|'fatal'
  severity text NOT NULL DEFAULT 'warning', -- warning|error|critical
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ticket_ref text,
  notified_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sync_alerts_created_idx ON public.sync_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS sync_alerts_source_idx ON public.sync_alerts (source, resolved_at);
GRANT SELECT, UPDATE ON public.sync_alerts TO authenticated;
GRANT ALL ON public.sync_alerts TO service_role;
ALTER TABLE public.sync_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sync_alerts" ON public.sync_alerts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/operator resolve sync_alerts" ON public.sync_alerts
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[]));

-- 5) Watchlist mutation policies (admin/operator only)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='nvd_watchlist' AND policyname='admin ops manage watchlist') THEN
    CREATE POLICY "admin ops manage watchlist" ON public.nvd_watchlist
      FOR ALL TO authenticated
      USING (public.has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[]))
      WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[]));
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nvd_watchlist TO authenticated;

-- 6) Sync health view
CREATE OR REPLACE VIEW public.sync_health_v AS
SELECT
  CASE WHEN feed_url LIKE 'nvd:%' THEN 'nvd' ELSE 'ctir' END AS source,
  feed_url,
  last_status,
  last_fetched_at,
  last_item_published_at,
  items_seen,
  updated_at
FROM public.ctir_sync_state;
GRANT SELECT ON public.sync_health_v TO authenticated;
