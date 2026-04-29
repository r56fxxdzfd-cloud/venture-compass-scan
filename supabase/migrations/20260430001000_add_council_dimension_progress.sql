CREATE TABLE IF NOT EXISTS public.council_dimension_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.council_meetings(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  dimension_id TEXT NOT NULL,
  dimension_label TEXT NOT NULL,
  initial_score NUMERIC NULL CHECK (initial_score BETWEEN 1 AND 5),
  current_perceived_score NUMERIC NULL CHECK (current_perceived_score BETWEEN 1 AND 5),
  trend TEXT NOT NULL DEFAULT 'stable' CHECK (trend IN ('improving', 'stable', 'worsening', 'insufficient_evidence')),
  evidence_note TEXT NULL,
  counselor_comment TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, dimension_id)
);

ALTER TABLE public.council_dimension_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV read council_dimension_progress"
  ON public.council_dimension_progress
  FOR SELECT
  USING (public.is_jv_member(auth.uid()));

CREATE POLICY "Admin/analyst write council_dimension_progress"
  ON public.council_dimension_progress
  FOR INSERT
  WITH CHECK (public.is_admin_or_analyst(auth.uid()) AND public.is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst update council_dimension_progress"
  ON public.council_dimension_progress
  FOR UPDATE
  USING (public.is_admin_or_analyst(auth.uid()) AND public.is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst delete council_dimension_progress"
  ON public.council_dimension_progress
  FOR DELETE
  USING (public.is_admin_or_analyst(auth.uid()) AND public.is_approved_member(auth.uid()));

DROP TRIGGER IF EXISTS trg_council_dimension_progress_updated_at ON public.council_dimension_progress;
CREATE TRIGGER trg_council_dimension_progress_updated_at
BEFORE UPDATE ON public.council_dimension_progress
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
