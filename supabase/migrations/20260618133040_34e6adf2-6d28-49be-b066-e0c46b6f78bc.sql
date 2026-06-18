
CREATE TABLE public.hypervisor_agent_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid REFERENCES public.monitored_environments(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('vsphere','hyperv')),
  agent_name text NOT NULL,
  hostname text,
  version text,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','degraded','offline')),
  last_collect_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  error_count_24h integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment_id, platform, agent_name)
);

GRANT SELECT ON public.hypervisor_agent_status TO authenticated;
GRANT ALL ON public.hypervisor_agent_status TO service_role;

ALTER TABLE public.hypervisor_agent_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view agent status"
  ON public.hypervisor_agent_status FOR SELECT
  TO authenticated USING (true);

CREATE TRIGGER update_hypervisor_agent_status_updated_at
  BEFORE UPDATE ON public.hypervisor_agent_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.hypervisor_agent_status;

CREATE TABLE public.hypervisor_agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid REFERENCES public.monitored_environments(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('vsphere','hyperv')),
  agent_name text NOT NULL,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error')),
  message text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hypervisor_agent_logs TO authenticated;
GRANT ALL ON public.hypervisor_agent_logs TO service_role;

ALTER TABLE public.hypervisor_agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view agent logs"
  ON public.hypervisor_agent_logs FOR SELECT
  TO authenticated USING (true);

CREATE INDEX hypervisor_agent_logs_env_platform_created_idx
  ON public.hypervisor_agent_logs (environment_id, platform, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.hypervisor_agent_logs;
