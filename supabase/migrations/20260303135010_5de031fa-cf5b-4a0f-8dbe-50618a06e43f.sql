
-- Table: founders
CREATE TABLE public.founders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.founders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved read founders" ON public.founders FOR SELECT TO authenticated
  USING (is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst write founders" ON public.founders FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst update founders" ON public.founders FOR UPDATE TO authenticated
  USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst delete founders" ON public.founders FOR DELETE TO authenticated
  USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

-- Table: founder_assessments
CREATE TABLE public.founder_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id uuid NOT NULL REFERENCES public.founders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  semester text NOT NULL,
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  score_auto numeric,
  score_jv numeric,
  score_used numeric,
  stage_label text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (founder_id, semester)
);

ALTER TABLE public.founder_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved read founder_assessments" ON public.founder_assessments FOR SELECT TO authenticated
  USING (is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst write founder_assessments" ON public.founder_assessments FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst update founder_assessments" ON public.founder_assessments FOR UPDATE TO authenticated
  USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst delete founder_assessments" ON public.founder_assessments FOR DELETE TO authenticated
  USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

-- Table: founder_pillar_scores
CREATE TABLE public.founder_pillar_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_assessment_id uuid NOT NULL REFERENCES public.founder_assessments(id) ON DELETE CASCADE,
  pillar_number int NOT NULL CHECK (pillar_number >= 0 AND pillar_number <= 5),
  pillar_name text NOT NULL,
  weight numeric NOT NULL DEFAULT 0,
  score_auto numeric,
  score_jv numeric,
  evidence_auto text,
  evidence_jv text,
  delta numeric GENERATED ALWAYS AS (COALESCE(score_jv, 0) - COALESCE(score_auto, 0)) STORED,
  UNIQUE (founder_assessment_id, pillar_number)
);

ALTER TABLE public.founder_pillar_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved read founder_pillar_scores" ON public.founder_pillar_scores FOR SELECT TO authenticated
  USING (is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst write founder_pillar_scores" ON public.founder_pillar_scores FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst update founder_pillar_scores" ON public.founder_pillar_scores FOR UPDATE TO authenticated
  USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst delete founder_pillar_scores" ON public.founder_pillar_scores FOR DELETE TO authenticated
  USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

-- Table: founder_action_plans
CREATE TABLE public.founder_action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_assessment_id uuid NOT NULL REFERENCES public.founder_assessments(id) ON DELETE CASCADE,
  pillar_focus_1 int,
  pillar_focus_2 int,
  actions_30d jsonb DEFAULT '[]'::jsonb,
  notes_60d text,
  notes_90d text
);

ALTER TABLE public.founder_action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved read founder_action_plans" ON public.founder_action_plans FOR SELECT TO authenticated
  USING (is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst write founder_action_plans" ON public.founder_action_plans FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst update founder_action_plans" ON public.founder_action_plans FOR UPDATE TO authenticated
  USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst delete founder_action_plans" ON public.founder_action_plans FOR DELETE TO authenticated
  USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

-- Table: founder_checkins
CREATE TABLE public.founder_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_assessment_id uuid NOT NULL REFERENCES public.founder_assessments(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  delivered_summary text NOT NULL DEFAULT '',
  evidence_link text,
  next_step text NOT NULL DEFAULT '',
  next_step_owner text NOT NULL DEFAULT '',
  next_step_due date,
  blocked text,
  decision_made text,
  quick_score int CHECK (quick_score >= 1 AND quick_score <= 5)
);

ALTER TABLE public.founder_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved read founder_checkins" ON public.founder_checkins FOR SELECT TO authenticated
  USING (is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst write founder_checkins" ON public.founder_checkins FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst update founder_checkins" ON public.founder_checkins FOR UPDATE TO authenticated
  USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst delete founder_checkins" ON public.founder_checkins FOR DELETE TO authenticated
  USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

-- Validation trigger: block founder_assessments insert if same founder has assessment within 180 days
CREATE OR REPLACE FUNCTION public.check_founder_assessment_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.founder_assessments
    WHERE founder_id = NEW.founder_id
      AND assessment_date > (CURRENT_DATE - INTERVAL '180 days')
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Avaliação recente encontrada para este founder. A próxima avaliação pode ser criada após 180 dias da última.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_founder_assessment_cooldown
  BEFORE INSERT ON public.founder_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_founder_assessment_cooldown();
