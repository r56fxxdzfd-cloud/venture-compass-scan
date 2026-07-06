-- Repair migration for environments where the startup_documents table exists
-- but the private Storage bucket was not created/applied.

INSERT INTO storage.buckets (id, name, public)
VALUES ('startup-documents', 'startup-documents', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

DROP POLICY IF EXISTS "startup_documents objects read" ON storage.objects;
CREATE POLICY "startup_documents objects read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'startup-documents'
    AND EXISTS (
      SELECT 1
      FROM public.startup_documents d
      WHERE d.file_url = name
        AND (
          public.is_jv_staff()
          OR public.is_advisor_of(d.startup_id)
          OR (
            d.visibility = 'startup_and_internal'
            AND public.can_access_company(d.startup_id, auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "startup_documents objects insert" ON storage.objects;
CREATE POLICY "startup_documents objects insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'startup-documents'
    AND EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND public.can_access_company(c.id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "startup_documents objects update" ON storage.objects;
CREATE POLICY "startup_documents objects update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'startup-documents'
    AND EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (
          public.is_jv_operator()
          OR public.is_advisor_of(c.id)
        )
    )
  )
  WITH CHECK (
    bucket_id = 'startup-documents'
    AND EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (
          public.is_jv_operator()
          OR public.is_advisor_of(c.id)
        )
    )
  );

DROP POLICY IF EXISTS "startup_documents objects delete admins" ON storage.objects;
CREATE POLICY "startup_documents objects delete admins" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'startup-documents'
    AND public.can_operate_platform(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.startup_documents d
      WHERE d.file_url = name
    )
  );
