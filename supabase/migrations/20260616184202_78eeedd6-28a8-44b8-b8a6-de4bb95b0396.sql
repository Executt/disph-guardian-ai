-- Hypervisor monitoring tables
CREATE TABLE public.hypervisor_hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid REFERENCES public.monitored_environments(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('vmware','hyperv')),
  hostname text NOT NULL,
  cluster text,
  cpu_pct numeric DEFAULT 0,
  ram_pct numeric DEFAULT 0,
  datastore_pct numeric DEFAULT 0,
  uptime_seconds bigint DEFAULT 0,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','warn','crit','maintenance')),
  last_check_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, hostname)
);
GRANT SELECT ON public.hypervisor_hosts TO authenticated;
GRANT ALL ON public.hypervisor_hosts TO service_role;
ALTER TABLE public.hypervisor_hosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hv_hosts_select" ON public.hypervisor_hosts FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operator','viewer','auditor']::app_role[]));

CREATE TABLE public.hypervisor_vms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid REFERENCES public.hypervisor_hosts(id) ON DELETE CASCADE,
  name text NOT NULL,
  symptom text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','crit')),
  recommendation text,
  last_check_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hypervisor_vms TO authenticated;
GRANT ALL ON public.hypervisor_vms TO service_role;
ALTER TABLE public.hypervisor_vms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hv_vms_select" ON public.hypervisor_vms FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operator','viewer','auditor']::app_role[]));

CREATE TABLE public.hypervisor_failure_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid REFERENCES public.monitored_environments(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'warn' CHECK (severity IN ('info','warn','crit')),
  impact text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hypervisor_failure_points TO authenticated;
GRANT ALL ON public.hypervisor_failure_points TO service_role;
ALTER TABLE public.hypervisor_failure_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hv_fp_select" ON public.hypervisor_failure_points FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operator','viewer','auditor']::app_role[]));

CREATE TRIGGER trg_hv_hosts_updated BEFORE UPDATE ON public.hypervisor_hosts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.hypervisor_hosts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hypervisor_vms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hypervisor_failure_points;