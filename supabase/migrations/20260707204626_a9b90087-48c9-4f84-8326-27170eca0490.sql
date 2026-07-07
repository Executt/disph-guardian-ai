GRANT SELECT ON public.ctir_advisories TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ctir_advisories TO service_role;
GRANT SELECT ON public.monitored_environments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitored_environments TO service_role;
GRANT SELECT ON public.advisory_environment_assessments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advisory_environment_assessments TO service_role;
GRANT SELECT ON public.ctir_sync_state TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ctir_sync_state TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ctir_advisories' AND policyname = 'Public app can view advisories'
  ) THEN
    CREATE POLICY "Public app can view advisories"
    ON public.ctir_advisories
    FOR SELECT
    TO anon
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'monitored_environments' AND policyname = 'Public app can view environments'
  ) THEN
    CREATE POLICY "Public app can view environments"
    ON public.monitored_environments
    FOR SELECT
    TO anon
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'advisory_environment_assessments' AND policyname = 'Public app can view assessments'
  ) THEN
    CREATE POLICY "Public app can view assessments"
    ON public.advisory_environment_assessments
    FOR SELECT
    TO anon
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ctir_sync_state' AND policyname = 'Public app can view sync state'
  ) THEN
    CREATE POLICY "Public app can view sync state"
    ON public.ctir_sync_state
    FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;