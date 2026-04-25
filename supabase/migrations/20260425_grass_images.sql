-- Add image_url column
ALTER TABLE public.grass_items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create public storage bucket for grass images
INSERT INTO storage.buckets (id, name, public)
VALUES ('grass-images', 'grass-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: each user can only upload into their own folder (user_id/)
CREATE POLICY "grass_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'grass-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "grass_images_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'grass-images');

CREATE POLICY "grass_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'grass-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
