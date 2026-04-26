ALTER TABLE public.grass_items
  ADD COLUMN IF NOT EXISTS price NUMERIC CHECK (price >= 0);
