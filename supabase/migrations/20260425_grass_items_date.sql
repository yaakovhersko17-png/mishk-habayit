-- Add purchase_date to grass_items
ALTER TABLE public.grass_items
  ADD COLUMN IF NOT EXISTS purchase_date DATE DEFAULT CURRENT_DATE;
