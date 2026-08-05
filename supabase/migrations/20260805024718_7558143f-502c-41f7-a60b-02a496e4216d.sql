DROP POLICY IF EXISTS "auth read sync_alerts" ON public.sync_alerts;

CREATE POLICY "Admins auditors operators read sync_alerts"
ON public.sync_alerts FOR SELECT TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin','auditor','operator']::app_role[]));

REVOKE SELECT ON public.sync_alerts FROM anon;
REVOKE SELECT ON public.audit_logs FROM anon;
GRANT SELECT, UPDATE ON public.sync_alerts TO authenticated;
GRANT ALL ON public.sync_alerts TO service_role;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;