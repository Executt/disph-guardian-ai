
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer', 'auditor');
CREATE TYPE public.incident_severity AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE public.incident_status AS ENUM ('open', 'investigating', 'mitigating', 'resolved', 'closed');
CREATE TYPE public.cluster_provider AS ENUM ('eks', 'gke', 'aks', 'cce', 'oke', 'openshift', 'openshift_local', 'okd', 'rancher');
CREATE TYPE public.cluster_status AS ENUM ('active', 'inactive', 'provisioning', 'error', 'maintenance');

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ TABLES FIRST ============

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  department TEXT,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- incidents
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  severity incident_severity NOT NULL DEFAULT 'medium',
  status incident_status NOT NULL DEFAULT 'open',
  environment TEXT NOT NULL DEFAULT 'production',
  service TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  assigned_to UUID,
  resolved_at TIMESTAMPTZ,
  mttr_minutes INTEGER,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- audit_logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- clusters
CREATE TABLE public.clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider cluster_provider NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  region TEXT,
  status cluster_status NOT NULL DEFAULT 'active',
  api_endpoint TEXT,
  node_count INTEGER DEFAULT 0,
  kubernetes_version TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_clusters_updated_at BEFORE UPDATE ON public.clusters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ai_conversations
CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SECURITY DEFINER FUNCTIONS ============

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- incidents
CREATE POLICY "Authenticated view incidents" ON public.incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins operators create incidents" ON public.incidents FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[]));
CREATE POLICY "Admins operators update incidents" ON public.incidents FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[]));
CREATE POLICY "Admins delete incidents" ON public.incidents FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- audit_logs
CREATE POLICY "Admins auditors view logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','auditor']::app_role[]));
CREATE POLICY "Authenticated insert logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- clusters
CREATE POLICY "Authenticated view clusters" ON public.clusters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins operators create clusters" ON public.clusters FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[]));
CREATE POLICY "Admins operators update clusters" ON public.clusters FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin','operator']::app_role[]));
CREATE POLICY "Admins delete clusters" ON public.clusters FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ai_conversations
CREATE POLICY "Users view own conversations" ON public.ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own conversations" ON public.ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own conversations" ON public.ai_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own conversations" ON public.ai_conversations FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_incidents_severity ON public.incidents(severity);
CREATE INDEX idx_incidents_status ON public.incidents(status);
CREATE INDEX idx_incidents_environment ON public.incidents(environment);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_clusters_provider ON public.clusters(provider);
CREATE INDEX idx_clusters_status ON public.clusters(status);
CREATE INDEX idx_ai_conversations_user_id ON public.ai_conversations(user_id);
