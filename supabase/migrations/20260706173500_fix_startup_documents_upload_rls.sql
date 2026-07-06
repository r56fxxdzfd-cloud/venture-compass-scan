-- Allow internal operators and assigned advisors to upload support documents
-- before the document metadata row exists. Entrepreneurs still depend on
-- can_access_company and their uploads remain internal_only by app default.

DROP POLICY IF EXISTS "startup_documents insert" ON public.startup_documents;
CREATE POLICY "startup_documents insert" ON public.startup_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by_user_id = auth.uid()
    AND (
      public.is_jv_operator()
      OR public.is_advisor_of(startup_id)
      OR (
        public.can_access_company(startup_id, auth.uid())
        AND visibility = 'internal_only'
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
        AND (
          public.is_jv_operator()
          OR public.is_advisor_of(c.id)
          OR public.can_access_company(c.id, auth.uid())
        )
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
