-- FASE 4 — meeting_logs (registro de reunião mínimo)
-- Nível de COMPANY: persiste entre rodadas. RLS igual a action_items.
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.meeting_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  meeting_date date NOT NULL DEFAULT current_date,
  attendees    text,
  decisions    text,
  next_steps   text,
  notes        text,
  created_by   uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_logs_company ON public.meeting_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_meeting_logs_date    ON public.meeting_logs(meeting_date DESC);

ALTER TABLE public.meeting_logs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_meeting_logs_updated_at ON public.meeting_logs;
CREATE TRIGGER trg_meeting_logs_updated_at
  BEFORE UPDATE ON public.meeting_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS:
--  SELECT  = staff OU advisor da company
--  WRITE   = operador (admin/analyst) sempre; advisor só nas companies atribuídas
DROP POLICY IF EXISTS "meeting_logs read" ON public.meeting_logs;
CREATE POLICY "meeting_logs read" ON public.meeting_logs
  FOR SELECT
  USING (public.is_jv_staff() OR public.is_advisor_of(company_id));

DROP POLICY IF EXISTS "meeting_logs insert" ON public.meeting_logs;
CREATE POLICY "meeting_logs insert" ON public.meeting_logs
  FOR INSERT
  WITH CHECK (public.is_jv_operator() OR public.is_advisor_of(company_id));

DROP POLICY IF EXISTS "meeting_logs update" ON public.meeting_logs;
CREATE POLICY "meeting_logs update" ON public.meeting_logs
  FOR UPDATE
  USING (public.is_jv_operator() OR public.is_advisor_of(company_id))
  WITH CHECK (public.is_jv_operator() OR public.is_advisor_of(company_id));

DROP POLICY IF EXISTS "meeting_logs delete" ON public.meeting_logs;
CREATE POLICY "meeting_logs delete" ON public.meeting_logs
  FOR DELETE
  USING (public.is_jv_operator() OR public.is_advisor_of(company_id));
