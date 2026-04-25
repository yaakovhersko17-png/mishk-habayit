-- Private grass management table — RLS enforces user_id isolation
CREATE TABLE IF NOT EXISTS public.grass_items (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID         REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT         NOT NULL,
  effect      INT          CHECK (effect >= 1 AND effect <= 5),
  flower_size TEXT         CHECK (flower_size IN ('גדול', 'בינוני', 'קטן', 'קטן מאוד')),
  dealer      TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE public.grass_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grass_owner_only" ON public.grass_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
