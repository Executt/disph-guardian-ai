CREATE TABLE IF NOT EXISTS public.ctir_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_url text NOT NULL UNIQUE,
  etag text,
  last_modified text,
  last_status integer,
  last_fetched_at timestamptz NOT NULL DEFAULT now(),
  last_item_published_at timestamptz,
  items_seen integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ctir_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins operators view sync state"
ON public.ctir_sync_state FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));

CREATE POLICY "Admins operators write sync state"
ON public.ctir_sync_state FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operator'::app_role]));

CREATE TRIGGER trg_ctir_sync_state_updated
BEFORE UPDATE ON public.ctir_sync_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();