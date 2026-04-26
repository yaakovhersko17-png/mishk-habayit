-- Backfill initial_weight and current_weight for grass_items added before inventory system
UPDATE public.grass_items
SET
  initial_weight = 10,
  current_weight = 10
WHERE
  initial_weight IS NULL OR current_weight IS NULL;
