ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN public.companies.logo_url IS 'Public URL for the startup logo shown in portfolio and startup profile.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('startup-logos', 'startup-logos', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

DROP POLICY IF EXISTS "startup_logos objects read" ON storage.objects;
CREATE POLICY "startup_logos objects read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'startup-logos');

DROP POLICY IF EXISTS "startup_logos objects insert" ON storage.objects;
CREATE POLICY "startup_logos objects insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'startup-logos'
    AND public.is_jv_operator()
  );

DROP POLICY IF EXISTS "startup_logos objects update" ON storage.objects;
CREATE POLICY "startup_logos objects update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'startup-logos'
    AND public.is_jv_operator()
  )
  WITH CHECK (
    bucket_id = 'startup-logos'
    AND public.is_jv_operator()
  );

DROP POLICY IF EXISTS "startup_logos objects delete" ON storage.objects;
CREATE POLICY "startup_logos objects delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'startup-logos'
    AND public.is_jv_operator()
  );
