-- Stores table — shared between all household members (no user_id)
CREATE TABLE IF NOT EXISTS public.stores (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read/write (shared household data)
CREATE POLICY "stores_all_authenticated" ON public.stores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
