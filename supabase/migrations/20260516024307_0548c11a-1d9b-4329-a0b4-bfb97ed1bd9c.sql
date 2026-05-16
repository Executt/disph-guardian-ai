CREATE TABLE public.skill_catalog_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_name text NOT NULL UNIQUE,
  category text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  default_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skill_catalog_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view skill_catalog_settings"
  ON public.skill_catalog_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins operators insert skill_catalog_settings"
  ON public.skill_catalog_settings FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));

CREATE POLICY "Admins operators update skill_catalog_settings"
  ON public.skill_catalog_settings FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));

CREATE POLICY "Admins delete skill_catalog_settings"
  ON public.skill_catalog_settings FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_skill_catalog_settings_updated
  BEFORE UPDATE ON public.skill_catalog_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();