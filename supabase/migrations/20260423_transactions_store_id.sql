-- Add store_id FK to transactions (run AFTER 20260423_stores.sql)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
