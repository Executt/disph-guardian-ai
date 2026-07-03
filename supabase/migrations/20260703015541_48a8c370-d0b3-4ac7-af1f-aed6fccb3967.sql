
-- 1. Incident stage (NIST funnel)
DO $$ BEGIN
  CREATE TYPE public.incident_stage AS ENUM ('identified','contained','eradicated','recovered','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS stage public.incident_stage NOT NULL DEFAULT 'identified';

UPDATE public.incidents SET stage = CASE
  WHEN status::text IN ('closed') THEN 'closed'::public.incident_stage
  WHEN status::text IN ('resolved') THEN 'recovered'::public.incident_stage
  WHEN status::text IN ('mitigating','in_progress') THEN 'contained'::public.incident_stage
  WHEN status::text IN ('investigating','triaged','acknowledged') THEN 'identified'::public.incident_stage
  ELSE 'identified'::public.incident_stage
END;

-- 2. NVD Watchlist
CREATE TABLE IF NOT EXISTS public.nvd_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('vendor','product','cpe','keyword')),
  value text NOT NULL,
  category text,
  enabled boolean NOT NULL DEFAULT true,
  severity_floor text NOT NULL DEFAULT 'medium' CHECK (severity_floor IN ('low','medium','high','critical')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nvd_watchlist TO authenticated;
GRANT ALL ON public.nvd_watchlist TO service_role;
ALTER TABLE public.nvd_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist read auth" ON public.nvd_watchlist FOR SELECT TO authenticated USING (true);
CREATE POLICY "watchlist write admin/operator" ON public.nvd_watchlist FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[]));

CREATE TRIGGER trg_nvd_watchlist_updated BEFORE UPDATE ON public.nvd_watchlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. NVD Vulnerabilities
CREATE TABLE IF NOT EXISTS public.nvd_vulnerabilities (
  cve_id text PRIMARY KEY,
  published_at timestamptz,
  last_modified timestamptz,
  cvss_score numeric(3,1),
  cvss_vector text,
  severity text CHECK (severity IN ('low','medium','high','critical','none')),
  summary text,
  cwe text,
  refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  cpe_matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_watch_ids uuid[] NOT NULL DEFAULT '{}',
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nvd_vulns_published ON public.nvd_vulnerabilities (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_nvd_vulns_severity ON public.nvd_vulnerabilities (severity);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nvd_vulnerabilities TO authenticated;
GRANT ALL ON public.nvd_vulnerabilities TO service_role;
ALTER TABLE public.nvd_vulnerabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nvd vulns read auth" ON public.nvd_vulnerabilities FOR SELECT TO authenticated USING (true);
CREATE POLICY "nvd vulns write admin/operator" ON public.nvd_vulnerabilities FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[]));

-- 4. Seed watchlist
INSERT INTO public.nvd_watchlist (label, kind, value, category, severity_floor) VALUES
  ('Windows','keyword','Microsoft Windows','os','high'),
  ('Linux Kernel','keyword','linux kernel','os','high'),
  ('Kubernetes','keyword','kubernetes','container','high'),
  ('Docker','keyword','docker','container','high'),
  ('OpenShift / OKD','keyword','openshift','container','high'),
  ('PostgreSQL','keyword','postgresql','database','medium'),
  ('MySQL','keyword','mysql','database','medium'),
  ('Oracle Database','keyword','oracle database','database','high'),
  ('Microsoft SQL Server','keyword','sql server','database','high'),
  ('MongoDB','keyword','mongodb','database','medium'),
  ('Supabase','keyword','supabase','database','medium'),
  ('Node.js','keyword','node.js','language','medium'),
  ('Python','keyword','python','language','medium'),
  ('Java','keyword','java','language','high'),
  ('Go (Golang)','keyword','golang','language','medium'),
  ('React','keyword','react','framework','medium'),
  ('WordPress','keyword','wordpress','cms','high'),
  ('VMware vSphere','keyword','vmware vsphere','virtualization','high'),
  ('Cisco IOS','keyword','cisco ios','network','high'),
  ('Fortinet FortiOS','keyword','fortios','network','critical'),
  ('OpenSSH','keyword','openssh','network','high'),
  ('Apache HTTP','keyword','apache http server','web','medium'),
  ('Nginx','keyword','nginx','web','medium'),
  ('Google Chrome','keyword','google chrome','browser','high'),
  ('Mozilla Firefox','keyword','firefox','browser','high'),
  ('Microsoft Edge','keyword','microsoft edge','browser','high'),
  ('Brave','keyword','brave browser','browser','medium'),
  ('LibreOffice','keyword','libreoffice','productivity','medium'),
  ('Microsoft Office','keyword','microsoft office','productivity','high'),
  ('Adobe Acrobat Reader','keyword','adobe acrobat reader','productivity','high'),
  ('Microsoft Teams','keyword','microsoft teams','collaboration','medium'),
  ('Google Meet','keyword','google meet','collaboration','medium')
ON CONFLICT (kind, value) DO NOTHING;
