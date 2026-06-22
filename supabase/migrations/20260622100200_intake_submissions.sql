-- FASE 2 — Intake nativo por link tokenizado
-- Fundador preenche por link público SEM login; JV revisa e importa.
-- Segurança: nenhuma leitura/escrita por anon/advisor/viewer via RLS.
-- O acesso público (validate/submit) ocorre SOMENTE por edge function com
-- service role + token. Idempotente.

CREATE TABLE IF NOT EXISTS public.intake_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token        text NOT NULL UNIQUE CHECK (char_length(token) >= 32),
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','submitted','imported','expired')),
  label        text,
  payload      jsonb,
  company_id   uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  imported_at  timestamptz,
  expires_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_intake_submissions_status ON public.intake_submissions(status);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_company ON public.intake_submissions(company_id);

ALTER TABLE public.intake_submissions ENABLE ROW LEVEL SECURITY;

-- RLS: SOMENTE operadores (admin/analyst). Advisor, viewer e anon: sem acesso.
DROP POLICY IF EXISTS "intake read operators" ON public.intake_submissions;
CREATE POLICY "intake read operators" ON public.intake_submissions
  FOR SELECT USING (public.is_jv_operator());

DROP POLICY IF EXISTS "intake insert operators" ON public.intake_submissions;
CREATE POLICY "intake insert operators" ON public.intake_submissions
  FOR INSERT WITH CHECK (public.is_jv_operator());

DROP POLICY IF EXISTS "intake update operators" ON public.intake_submissions;
CREATE POLICY "intake update operators" ON public.intake_submissions
  FOR UPDATE USING (public.is_jv_operator()) WITH CHECK (public.is_jv_operator());

DROP POLICY IF EXISTS "intake delete operators" ON public.intake_submissions;
CREATE POLICY "intake delete operators" ON public.intake_submissions
  FOR DELETE USING (public.is_jv_operator());
