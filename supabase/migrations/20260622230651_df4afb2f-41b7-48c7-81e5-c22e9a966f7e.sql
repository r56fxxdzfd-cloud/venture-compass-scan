
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  ORDER BY CASE ur.role
    WHEN 'super_admin' THEN 1 WHEN 'jv_admin' THEN 2 WHEN 'jv_analyst' THEN 3
    WHEN 'jv_viewer' THEN 4 WHEN 'jv_advisor' THEN 5 WHEN 'demo_admin' THEN 6
    WHEN 'demo_user' THEN 7 ELSE 9 END LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_approved_member(auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_jv_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin'::public.app_role,'jv_admin'::public.app_role,'jv_analyst'::public.app_role,'jv_viewer'::public.app_role))
$$;

CREATE OR REPLACE FUNCTION public.is_jv_operator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    AND ur.role IN ('super_admin'::public.app_role,'jv_admin'::public.app_role,'jv_analyst'::public.app_role))
$$;

CREATE TABLE IF NOT EXISTS public.advisor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, advisor_id)
);
CREATE INDEX IF NOT EXISTS idx_advisor_assignments_company ON public.advisor_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_advisor_assignments_advisor ON public.advisor_assignments(advisor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advisor_assignments TO authenticated;
GRANT ALL ON public.advisor_assignments TO service_role;
ALTER TABLE public.advisor_assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_advisor_of(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.advisor_assignments aa
    WHERE aa.company_id = p_company_id AND aa.advisor_id = auth.uid())
$$;

DROP POLICY IF EXISTS "advisor_assignments read" ON public.advisor_assignments;
CREATE POLICY "advisor_assignments read" ON public.advisor_assignments FOR SELECT
  USING (public.is_jv_staff() OR advisor_id = auth.uid());
DROP POLICY IF EXISTS "advisor_assignments insert" ON public.advisor_assignments;
CREATE POLICY "advisor_assignments insert" ON public.advisor_assignments FOR INSERT
  WITH CHECK (public.is_jv_operator());
DROP POLICY IF EXISTS "advisor_assignments delete" ON public.advisor_assignments;
CREATE POLICY "advisor_assignments delete" ON public.advisor_assignments FOR DELETE
  USING (public.is_jv_operator());

DROP POLICY IF EXISTS "Advisor read assigned companies" ON public.companies;
CREATE POLICY "Advisor read assigned companies" ON public.companies FOR SELECT USING (public.is_advisor_of(id));
DROP POLICY IF EXISTS "Advisor read assigned assessments" ON public.assessments;
CREATE POLICY "Advisor read assigned assessments" ON public.assessments FOR SELECT USING (public.is_advisor_of(company_id));
DROP POLICY IF EXISTS "Advisor read assigned answers" ON public.answers;
CREATE POLICY "Advisor read assigned answers" ON public.answers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = answers.assessment_id AND public.is_advisor_of(a.company_id)));
DROP POLICY IF EXISTS "Advisor read assigned assessment_red_flags" ON public.assessment_red_flags;
CREATE POLICY "Advisor read assigned assessment_red_flags" ON public.assessment_red_flags FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_red_flags.assessment_id AND public.is_advisor_of(a.company_id)));

CREATE TABLE IF NOT EXISTS public.intake_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE CHECK (char_length(token) >= 32),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','imported','expired')),
  label text, payload jsonb,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz, imported_at timestamptz, expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_status ON public.intake_submissions(status);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_company ON public.intake_submissions(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_submissions TO authenticated;
GRANT ALL ON public.intake_submissions TO service_role;
ALTER TABLE public.intake_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intake read operators" ON public.intake_submissions;
CREATE POLICY "intake read operators" ON public.intake_submissions FOR SELECT USING (public.is_jv_operator());
DROP POLICY IF EXISTS "intake insert operators" ON public.intake_submissions;
CREATE POLICY "intake insert operators" ON public.intake_submissions FOR INSERT WITH CHECK (public.is_jv_operator());
DROP POLICY IF EXISTS "intake update operators" ON public.intake_submissions;
CREATE POLICY "intake update operators" ON public.intake_submissions FOR UPDATE USING (public.is_jv_operator()) WITH CHECK (public.is_jv_operator());
DROP POLICY IF EXISTS "intake delete operators" ON public.intake_submissions;
CREATE POLICY "intake delete operators" ON public.intake_submissions FOR DELETE USING (public.is_jv_operator());

CREATE TABLE IF NOT EXISTS public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  source_action_id text, title text NOT NULL, description text,
  first_step text, done_definition text, dimension_id text, owner_label text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done','blocked')),
  effort text CHECK (effort IN ('S','M','L')),
  priority numeric, due_date date,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_action_items_company ON public.action_items(company_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON public.action_items(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_action_items_company_source ON public.action_items(company_id, source_action_id) WHERE source_action_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_items TO authenticated;
GRANT ALL ON public.action_items TO service_role;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_action_items_updated_at ON public.action_items;
CREATE TRIGGER trg_action_items_updated_at BEFORE UPDATE ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "action_items read" ON public.action_items;
CREATE POLICY "action_items read" ON public.action_items FOR SELECT
  USING (public.is_jv_staff() OR public.is_advisor_of(company_id));
DROP POLICY IF EXISTS "action_items insert" ON public.action_items;
CREATE POLICY "action_items insert" ON public.action_items FOR INSERT
  WITH CHECK (public.is_jv_operator() OR public.is_advisor_of(company_id));
DROP POLICY IF EXISTS "action_items update" ON public.action_items;
CREATE POLICY "action_items update" ON public.action_items FOR UPDATE
  USING (public.is_jv_operator() OR public.is_advisor_of(company_id))
  WITH CHECK (public.is_jv_operator() OR public.is_advisor_of(company_id));
DROP POLICY IF EXISTS "action_items delete" ON public.action_items;
CREATE POLICY "action_items delete" ON public.action_items FOR DELETE
  USING (public.is_jv_operator() OR public.is_advisor_of(company_id));

CREATE TABLE IF NOT EXISTS public.meeting_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  meeting_date date NOT NULL DEFAULT current_date,
  attendees text, decisions text, next_steps text, notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meeting_logs_company ON public.meeting_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_meeting_logs_date ON public.meeting_logs(meeting_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_logs TO authenticated;
GRANT ALL ON public.meeting_logs TO service_role;
ALTER TABLE public.meeting_logs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_meeting_logs_updated_at ON public.meeting_logs;
CREATE TRIGGER trg_meeting_logs_updated_at BEFORE UPDATE ON public.meeting_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "meeting_logs read" ON public.meeting_logs;
CREATE POLICY "meeting_logs read" ON public.meeting_logs FOR SELECT
  USING (public.is_jv_staff() OR public.is_advisor_of(company_id));
DROP POLICY IF EXISTS "meeting_logs insert" ON public.meeting_logs;
CREATE POLICY "meeting_logs insert" ON public.meeting_logs FOR INSERT
  WITH CHECK (public.is_jv_operator() OR public.is_advisor_of(company_id));
DROP POLICY IF EXISTS "meeting_logs update" ON public.meeting_logs;
CREATE POLICY "meeting_logs update" ON public.meeting_logs FOR UPDATE
  USING (public.is_jv_operator() OR public.is_advisor_of(company_id))
  WITH CHECK (public.is_jv_operator() OR public.is_advisor_of(company_id));
DROP POLICY IF EXISTS "meeting_logs delete" ON public.meeting_logs;
CREATE POLICY "meeting_logs delete" ON public.meeting_logs FOR DELETE
  USING (public.is_jv_operator() OR public.is_advisor_of(company_id));
