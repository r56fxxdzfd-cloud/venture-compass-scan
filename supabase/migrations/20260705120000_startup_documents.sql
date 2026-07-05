-- Fase 1: documentos de apoio por startup.
-- Escopo intencionalmente simples: metadados, Storage privado, visibilidade e
-- associação opcional por tipo/id, sem OCR, IA, versionamento ou workflow.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'startup_document_category'
  ) THEN
    CREATE TYPE public.startup_document_category AS ENUM (
      'diagnostic_external',
      'pitch_deck',
      'financial',
      'commercial',
      'product',
      'legal_corporate',
      'board_meeting',
      'action_plan',
      'other'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'startup_document_visibility'
  ) THEN
    CREATE TYPE public.startup_document_visibility AS ENUM (
      'internal_only',
      'startup_and_internal'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.startup_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL CHECK (file_size >= 0),
  document_category public.startup_document_category NOT NULL DEFAULT 'other',
  description text,
  visibility public.startup_document_visibility NOT NULL DEFAULT 'internal_only',
  related_entity_type text CHECK (
    related_entity_type IS NULL
    OR related_entity_type IN ('diagnostic', 'red_flag', 'meeting', 'action_plan')
  ),
  related_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (file_url)
);

CREATE INDEX IF NOT EXISTS idx_startup_documents_startup_created
  ON public.startup_documents(startup_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_startup_documents_category
  ON public.startup_documents(document_category);
CREATE INDEX IF NOT EXISTS idx_startup_documents_related
  ON public.startup_documents(related_entity_type, related_entity_id)
  WHERE related_entity_type IS NOT NULL AND related_entity_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_startup_documents_updated_at ON public.startup_documents;
CREATE TRIGGER trg_startup_documents_updated_at
  BEFORE UPDATE ON public.startup_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.startup_documents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.startup_documents TO authenticated;
GRANT ALL ON public.startup_documents TO service_role;

DROP POLICY IF EXISTS "startup_documents read" ON public.startup_documents;
CREATE POLICY "startup_documents read" ON public.startup_documents
  FOR SELECT TO authenticated
  USING (
    public.is_jv_staff()
    OR public.is_advisor_of(startup_id)
    OR (
      visibility = 'startup_and_internal'
      AND public.can_access_company(startup_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "startup_documents insert" ON public.startup_documents;
CREATE POLICY "startup_documents insert" ON public.startup_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by_user_id = auth.uid()
    AND public.can_access_company(startup_id, auth.uid())
    AND (
      public.is_jv_staff()
      OR public.is_advisor_of(startup_id)
      OR visibility = 'internal_only'
    )
  );

DROP POLICY IF EXISTS "startup_documents update" ON public.startup_documents;
CREATE POLICY "startup_documents update" ON public.startup_documents
  FOR UPDATE TO authenticated
  USING (
    public.is_jv_operator()
    OR public.is_advisor_of(startup_id)
  )
  WITH CHECK (
    public.is_jv_operator()
    OR public.is_advisor_of(startup_id)
  );

DROP POLICY IF EXISTS "startup_documents delete admins" ON public.startup_documents;
CREATE POLICY "startup_documents delete admins" ON public.startup_documents
  FOR DELETE TO authenticated
  USING (public.can_operate_platform(auth.uid()));

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
