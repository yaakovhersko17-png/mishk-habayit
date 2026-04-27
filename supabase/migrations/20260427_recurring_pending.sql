ALTER TABLE public.recurring_rules
  ADD COLUMN IF NOT EXISTS pending_approval BOOLEAN DEFAULT false;
