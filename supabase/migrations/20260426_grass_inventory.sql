-- Weight tracking in grass_items
ALTER TABLE public.grass_items
  ADD COLUMN IF NOT EXISTS initial_weight NUMERIC DEFAULT 10 CHECK (initial_weight >= 0),
  ADD COLUMN IF NOT EXISTS current_weight NUMERIC DEFAULT 10 CHECK (current_weight >= 0);

-- User inventory (tobacco balance)
CREATE TABLE IF NOT EXISTS public.user_inventory (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tobacco_balance NUMERIC    DEFAULT 0 CHECK (tobacco_balance >= 0),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_owner" ON public.user_inventory
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Consumption logs
CREATE TABLE IF NOT EXISTS public.consumption_logs (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  grass_amount  NUMERIC     NOT NULL CHECK (grass_amount >= 0),
  tobacco_amount NUMERIC    NOT NULL CHECK (tobacco_amount >= 0),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.consumption_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consumption_owner" ON public.consumption_logs
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
