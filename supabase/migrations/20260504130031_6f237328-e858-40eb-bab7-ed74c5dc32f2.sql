-- Enums
CREATE TYPE public.advisory_kind AS ENUM ('alert', 'recommendation');
CREATE TYPE public.advisory_severity AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE public.compliance_status AS ENUM ('compliant', 'partial', 'non_compliant', 'not_applicable', 'pending');
CREATE TYPE public.environment_type AS ENUM ('production', 'staging', 'development', 'dr', 'sandbox');
CREATE TYPE public.environment_criticality AS ENUM ('mission_critical', 'high', 'medium', 'low');

-- ctir_advisories
CREATE TABLE public.ctir_advisories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  kind public.advisory_kind NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  recommendation TEXT,
  severity public.advisory_severity NOT NULL DEFAULT 'medium',
  category TEXT,
  cves TEXT[] DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'CTIR Gov',
  source_url TEXT,
  published_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ctir_advisories_severity ON public.ctir_advisories(severity);
CREATE INDEX idx_ctir_advisories_kind ON public.ctir_advisories(kind);
CREATE INDEX idx_ctir_advisories_published ON public.ctir_advisories(published_at DESC);

-- monitored_environments
CREATE TABLE public.monitored_environments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type public.environment_type NOT NULL DEFAULT 'production',
  criticality public.environment_criticality NOT NULL DEFAULT 'medium',
  total_assets INTEGER NOT NULL DEFAULT 0,
  owner TEXT,
  tags TEXT[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_monitored_environments_type ON public.monitored_environments(type);

-- advisory_environment_assessments (cross analysis)
CREATE TABLE public.advisory_environment_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advisory_id UUID NOT NULL REFERENCES public.ctir_advisories(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES public.monitored_environments(id) ON DELETE CASCADE,
  status public.compliance_status NOT NULL DEFAULT 'pending',
  affected_assets INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  remediation_plan TEXT,
  assessed_by UUID,
  assessed_at TIMESTAMPTZ,
  remediated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (advisory_id, environment_id)
);

CREATE INDEX idx_assessments_advisory ON public.advisory_environment_assessments(advisory_id);
CREATE INDEX idx_assessments_environment ON public.advisory_environment_assessments(environment_id);
CREATE INDEX idx_assessments_status ON public.advisory_environment_assessments(status);

-- Enable RLS
ALTER TABLE public.ctir_advisories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitored_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisory_environment_assessments ENABLE ROW LEVEL SECURITY;

-- ctir_advisories policies
CREATE POLICY "Authenticated view advisories" ON public.ctir_advisories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins operators create advisories" ON public.ctir_advisories
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins operators update advisories" ON public.ctir_advisories
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins delete advisories" ON public.ctir_advisories
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- monitored_environments policies
CREATE POLICY "Authenticated view environments" ON public.monitored_environments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins operators create environments" ON public.monitored_environments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins operators update environments" ON public.monitored_environments
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins delete environments" ON public.monitored_environments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- assessments policies
CREATE POLICY "Authenticated view assessments" ON public.advisory_environment_assessments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins operators create assessments" ON public.advisory_environment_assessments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins operators update assessments" ON public.advisory_environment_assessments
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins delete assessments" ON public.advisory_environment_assessments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at triggers
CREATE TRIGGER trg_ctir_advisories_updated_at
  BEFORE UPDATE ON public.ctir_advisories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_monitored_environments_updated_at
  BEFORE UPDATE ON public.monitored_environments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_assessments_updated_at
  BEFORE UPDATE ON public.advisory_environment_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();