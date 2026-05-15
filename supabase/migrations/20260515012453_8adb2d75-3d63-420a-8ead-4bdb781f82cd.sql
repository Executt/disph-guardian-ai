
-- Enums
CREATE TYPE public.agent_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE public.agent_autonomy AS ENUM ('manual', 'supervised', 'autonomous');
CREATE TYPE public.agent_channel_type AS ENUM ('teams', 'whatsapp', 'telegram');
CREATE TYPE public.agent_execution_status AS ENUM ('pending', 'running', 'awaiting_approval', 'success', 'failed', 'cancelled');
CREATE TYPE public.agent_trigger_source AS ENUM ('manual', 'auto', 'channel', 'schedule', 'webhook');

-- agents
CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar_url text,
  status public.agent_status NOT NULL DEFAULT 'draft',
  autonomy_level public.agent_autonomy NOT NULL DEFAULT 'manual',
  area text,
  tags text[] DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view agents" ON public.agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins operators create agents" ON public.agents FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins operators update agents" ON public.agents FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins delete agents" ON public.agents FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_agents_updated BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- agent_profiles (1:1 com agents)
CREATE TABLE public.agent_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES public.agents(id) ON DELETE CASCADE,
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  system_prompt text NOT NULL DEFAULT 'Você é um agente especializado de operações de TI.',
  temperature numeric(3,2) NOT NULL DEFAULT 0.30,
  max_tokens integer NOT NULL DEFAULT 2048,
  role_focus text NOT NULL DEFAULT 'general',
  risk_threshold integer NOT NULL DEFAULT 2,
  guardrails jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view agent_profiles" ON public.agent_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins operators create agent_profiles" ON public.agent_profiles FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins operators update agent_profiles" ON public.agent_profiles FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins delete agent_profiles" ON public.agent_profiles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_agent_profiles_updated BEFORE UPDATE ON public.agent_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- agent_skills
CREATE TABLE public.agent_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  category text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, skill_name)
);
ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view agent_skills" ON public.agent_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins operators create agent_skills" ON public.agent_skills FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins operators update agent_skills" ON public.agent_skills FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins delete agent_skills" ON public.agent_skills FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_agent_skills_updated BEFORE UPDATE ON public.agent_skills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- agent_channels
CREATE TABLE public.agent_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  channel_type public.agent_channel_type NOT NULL,
  label text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view agent_channels" ON public.agent_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins operators create agent_channels" ON public.agent_channels FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins operators update agent_channels" ON public.agent_channels FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins delete agent_channels" ON public.agent_channels FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_agent_channels_updated BEFORE UPDATE ON public.agent_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- agent_executions
CREATE TABLE public.agent_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  triggered_by public.agent_trigger_source NOT NULL DEFAULT 'manual',
  triggered_by_user uuid,
  channel_type public.agent_channel_type,
  input text,
  output text,
  status public.agent_execution_status NOT NULL DEFAULT 'pending',
  tokens_used integer DEFAULT 0,
  duration_ms integer,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view agent_executions" ON public.agent_executions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert agent_executions" ON public.agent_executions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins operators update agent_executions" ON public.agent_executions FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));
CREATE POLICY "Admins delete agent_executions" ON public.agent_executions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_agent_executions_updated BEFORE UPDATE ON public.agent_executions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_agent_executions_agent ON public.agent_executions(agent_id, created_at DESC);
CREATE INDEX idx_agent_skills_agent ON public.agent_skills(agent_id);
CREATE INDEX idx_agent_channels_agent ON public.agent_channels(agent_id);
