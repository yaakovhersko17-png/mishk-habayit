-- Add strain_type column to grass_items
ALTER TABLE public.grass_items
  ADD COLUMN IF NOT EXISTS strain_type TEXT
  CHECK (strain_type IN ('אינדיקה', 'סטיבה', 'היברידי'));
