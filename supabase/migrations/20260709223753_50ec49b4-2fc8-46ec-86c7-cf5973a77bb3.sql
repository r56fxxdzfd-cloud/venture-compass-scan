CREATE OR REPLACE FUNCTION public.can_upload_startup_document_object(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  v_company_id := NULLIF((storage.foldername(p_object_name))[1], '')::uuid;

  RETURN
    public.is_jv_operator()
    OR public.is_advisor_of(v_company_id)
    OR public.can_access_company(v_company_id, auth.uid());
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_upload_startup_document_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_upload_startup_document_object(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "startup_documents objects insert" ON storage.objects;
CREATE POLICY "startup_documents objects insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'startup-documents'
    AND public.can_upload_startup_document_object(name)
  );

DROP POLICY IF EXISTS "startup_documents objects update" ON storage.objects;
CREATE POLICY "startup_documents objects update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'startup-documents'
    AND public.can_upload_startup_document_object(name)
  )
  WITH CHECK (
    bucket_id = 'startup-documents'
    AND public.can_upload_startup_document_object(name)
  );