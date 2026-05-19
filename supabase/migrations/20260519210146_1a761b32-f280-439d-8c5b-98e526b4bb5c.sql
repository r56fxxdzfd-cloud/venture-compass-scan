
-- 1. Helpers de papel
CREATE OR REPLACE FUNCTION public.is_jv_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'jv_admin')
$$;

CREATE OR REPLACE FUNCTION public.is_demo_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'demo_user')
$$;

-- 2. can_access_company / can_operate_company
CREATE OR REPLACE FUNCTION public.can_access_company(_company_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR public.is_jv_admin(_user_id)
    OR (
      public.is_demo_user(_user_id)
      AND EXISTS (
        SELECT 1 FROM public.companies c WHERE c.id = _company_id AND c.is_demo = true
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.can_operate_company(_company_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id) OR public.is_jv_admin(_user_id)
$$;

-- 3. companies
DROP POLICY IF EXISTS "Approved members read companies" ON public.companies;
DROP POLICY IF EXISTS "Admin/analyst write companies" ON public.companies;
DROP POLICY IF EXISTS "Admin/analyst update companies" ON public.companies;
DROP POLICY IF EXISTS "Admin/analyst delete companies" ON public.companies;

CREATE POLICY "Scoped read companies" ON public.companies FOR SELECT
USING (public.can_access_company(id, auth.uid()));
CREATE POLICY "Operators write companies" ON public.companies FOR INSERT
WITH CHECK (public.can_operate_company(id, auth.uid()));
CREATE POLICY "Operators update companies" ON public.companies FOR UPDATE
USING (public.can_operate_company(id, auth.uid()));
CREATE POLICY "Operators delete companies" ON public.companies FOR DELETE
USING (public.can_operate_company(id, auth.uid()));

-- 4. Tabelas com company_id direto
-- assessments
DROP POLICY IF EXISTS "Approved read assessments" ON public.assessments;
DROP POLICY IF EXISTS "Admin/analyst write assessments" ON public.assessments;
DROP POLICY IF EXISTS "Admin/analyst update assessments" ON public.assessments;
DROP POLICY IF EXISTS "Admin/analyst delete assessments" ON public.assessments;
CREATE POLICY "Scoped read assessments" ON public.assessments FOR SELECT
USING (public.can_access_company(company_id, auth.uid()));
CREATE POLICY "Operators write assessments" ON public.assessments FOR INSERT
WITH CHECK (public.can_operate_company(company_id, auth.uid()));
CREATE POLICY "Operators update assessments" ON public.assessments FOR UPDATE
USING (public.can_operate_company(company_id, auth.uid()));
CREATE POLICY "Operators delete assessments" ON public.assessments FOR DELETE
USING (public.can_operate_company(company_id, auth.uid()));

-- council_meetings
DROP POLICY IF EXISTS "JV read council_meetings" ON public.council_meetings;
DROP POLICY IF EXISTS "Admin/analyst write council_meetings" ON public.council_meetings;
DROP POLICY IF EXISTS "Admin/analyst update council_meetings" ON public.council_meetings;
DROP POLICY IF EXISTS "Admin/analyst delete council_meetings" ON public.council_meetings;
CREATE POLICY "Scoped read council_meetings" ON public.council_meetings FOR SELECT
USING (public.can_access_company(company_id, auth.uid()));
CREATE POLICY "Operators write council_meetings" ON public.council_meetings FOR INSERT
WITH CHECK (public.can_operate_company(company_id, auth.uid()));
CREATE POLICY "Operators update council_meetings" ON public.council_meetings FOR UPDATE
USING (public.can_operate_company(company_id, auth.uid()));
CREATE POLICY "Operators delete council_meetings" ON public.council_meetings FOR DELETE
USING (public.can_operate_company(company_id, auth.uid()));

-- council_actions
DROP POLICY IF EXISTS "JV read council_actions" ON public.council_actions;
DROP POLICY IF EXISTS "Admin/analyst write council_actions" ON public.council_actions;
DROP POLICY IF EXISTS "Admin/analyst update council_actions" ON public.council_actions;
DROP POLICY IF EXISTS "Admin/analyst delete council_actions" ON public.council_actions;
CREATE POLICY "Scoped read council_actions" ON public.council_actions FOR SELECT
USING (public.can_access_company(company_id, auth.uid()));
CREATE POLICY "Operators write council_actions" ON public.council_actions FOR INSERT
WITH CHECK (public.can_operate_company(company_id, auth.uid()));
CREATE POLICY "Operators update council_actions" ON public.council_actions FOR UPDATE
USING (public.can_operate_company(company_id, auth.uid()));
CREATE POLICY "Operators delete council_actions" ON public.council_actions FOR DELETE
USING (public.can_operate_company(company_id, auth.uid()));

-- council_dimension_progress
DROP POLICY IF EXISTS "JV read council_dimension_progress" ON public.council_dimension_progress;
DROP POLICY IF EXISTS "Admin/analyst write council_dimension_progress" ON public.council_dimension_progress;
DROP POLICY IF EXISTS "Admin/analyst update council_dimension_progress" ON public.council_dimension_progress;
DROP POLICY IF EXISTS "Admin/analyst delete council_dimension_progress" ON public.council_dimension_progress;
CREATE POLICY "Scoped read council_dimension_progress" ON public.council_dimension_progress FOR SELECT
USING (public.can_access_company(company_id, auth.uid()));
CREATE POLICY "Operators write council_dimension_progress" ON public.council_dimension_progress FOR INSERT
WITH CHECK (public.can_operate_company(company_id, auth.uid()));
CREATE POLICY "Operators update council_dimension_progress" ON public.council_dimension_progress FOR UPDATE
USING (public.can_operate_company(company_id, auth.uid()));
CREATE POLICY "Operators delete council_dimension_progress" ON public.council_dimension_progress FOR DELETE
USING (public.can_operate_company(company_id, auth.uid()));

-- founders
DROP POLICY IF EXISTS "Approved read founders" ON public.founders;
DROP POLICY IF EXISTS "Admin/analyst write founders" ON public.founders;
DROP POLICY IF EXISTS "Admin/analyst update founders" ON public.founders;
DROP POLICY IF EXISTS "Admin/analyst delete founders" ON public.founders;
CREATE POLICY "Scoped read founders" ON public.founders FOR SELECT
USING (public.can_access_company(company_id, auth.uid()));
CREATE POLICY "Operators write founders" ON public.founders FOR INSERT
WITH CHECK (public.can_operate_company(company_id, auth.uid()));
CREATE POLICY "Operators update founders" ON public.founders FOR UPDATE
USING (public.can_operate_company(company_id, auth.uid()));
CREATE POLICY "Operators delete founders" ON public.founders FOR DELETE
USING (public.can_operate_company(company_id, auth.uid()));

-- founder_assessments
DROP POLICY IF EXISTS "Approved read founder_assessments" ON public.founder_assessments;
DROP POLICY IF EXISTS "Admin/analyst write founder_assessments" ON public.founder_assessments;
DROP POLICY IF EXISTS "Admin/analyst update founder_assessments" ON public.founder_assessments;
DROP POLICY IF EXISTS "Admin/analyst delete founder_assessments" ON public.founder_assessments;
CREATE POLICY "Scoped read founder_assessments" ON public.founder_assessments FOR SELECT
USING (public.can_access_company(company_id, auth.uid()));
CREATE POLICY "Operators write founder_assessments" ON public.founder_assessments FOR INSERT
WITH CHECK (public.can_operate_company(company_id, auth.uid()));
CREATE POLICY "Operators update founder_assessments" ON public.founder_assessments FOR UPDATE
USING (public.can_operate_company(company_id, auth.uid()));
CREATE POLICY "Operators delete founder_assessments" ON public.founder_assessments FOR DELETE
USING (public.can_operate_company(company_id, auth.uid()));

-- 5. Tabelas indiretas
-- answers (via assessments)
DROP POLICY IF EXISTS "Approved read answers" ON public.answers;
DROP POLICY IF EXISTS "Admin/analyst write answers" ON public.answers;
DROP POLICY IF EXISTS "Admin/analyst update answers" ON public.answers;
DROP POLICY IF EXISTS "Admin/analyst delete answers" ON public.answers;
CREATE POLICY "Scoped read answers" ON public.answers FOR SELECT
USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = answers.assessment_id AND public.can_access_company(a.company_id, auth.uid())));
CREATE POLICY "Operators write answers" ON public.answers FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = answers.assessment_id AND public.can_operate_company(a.company_id, auth.uid())));
CREATE POLICY "Operators update answers" ON public.answers FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = answers.assessment_id AND public.can_operate_company(a.company_id, auth.uid())));
CREATE POLICY "Operators delete answers" ON public.answers FOR DELETE
USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = answers.assessment_id AND public.can_operate_company(a.company_id, auth.uid())));

-- assessment_red_flags (via assessments)
DROP POLICY IF EXISTS "Approved read assessment_red_flags" ON public.assessment_red_flags;
DROP POLICY IF EXISTS "Admin/analyst write assessment_red_flags" ON public.assessment_red_flags;
DROP POLICY IF EXISTS "Admin/analyst update assessment_red_flags" ON public.assessment_red_flags;
DROP POLICY IF EXISTS "Admin/analyst delete assessment_red_flags" ON public.assessment_red_flags;
CREATE POLICY "Scoped read assessment_red_flags" ON public.assessment_red_flags FOR SELECT
USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_red_flags.assessment_id AND public.can_access_company(a.company_id, auth.uid())));
CREATE POLICY "Operators write assessment_red_flags" ON public.assessment_red_flags FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_red_flags.assessment_id AND public.can_operate_company(a.company_id, auth.uid())));
CREATE POLICY "Operators update assessment_red_flags" ON public.assessment_red_flags FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_red_flags.assessment_id AND public.can_operate_company(a.company_id, auth.uid())));
CREATE POLICY "Operators delete assessment_red_flags" ON public.assessment_red_flags FOR DELETE
USING (EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_red_flags.assessment_id AND public.can_operate_company(a.company_id, auth.uid())));

-- founder_pillar_scores (via founder_assessments)
DROP POLICY IF EXISTS "Approved read founder_pillar_scores" ON public.founder_pillar_scores;
DROP POLICY IF EXISTS "Admin/analyst write founder_pillar_scores" ON public.founder_pillar_scores;
DROP POLICY IF EXISTS "Admin/analyst update founder_pillar_scores" ON public.founder_pillar_scores;
DROP POLICY IF EXISTS "Admin/analyst delete founder_pillar_scores" ON public.founder_pillar_scores;
CREATE POLICY "Scoped read founder_pillar_scores" ON public.founder_pillar_scores FOR SELECT
USING (EXISTS (SELECT 1 FROM public.founder_assessments fa WHERE fa.id = founder_pillar_scores.founder_assessment_id AND public.can_access_company(fa.company_id, auth.uid())));
CREATE POLICY "Operators write founder_pillar_scores" ON public.founder_pillar_scores FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.founder_assessments fa WHERE fa.id = founder_pillar_scores.founder_assessment_id AND public.can_operate_company(fa.company_id, auth.uid())));
CREATE POLICY "Operators update founder_pillar_scores" ON public.founder_pillar_scores FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.founder_assessments fa WHERE fa.id = founder_pillar_scores.founder_assessment_id AND public.can_operate_company(fa.company_id, auth.uid())));
CREATE POLICY "Operators delete founder_pillar_scores" ON public.founder_pillar_scores FOR DELETE
USING (EXISTS (SELECT 1 FROM public.founder_assessments fa WHERE fa.id = founder_pillar_scores.founder_assessment_id AND public.can_operate_company(fa.company_id, auth.uid())));

-- founder_action_plans (via founder_assessments)
DROP POLICY IF EXISTS "Approved read founder_action_plans" ON public.founder_action_plans;
DROP POLICY IF EXISTS "Admin/analyst write founder_action_plans" ON public.founder_action_plans;
DROP POLICY IF EXISTS "Admin/analyst update founder_action_plans" ON public.founder_action_plans;
DROP POLICY IF EXISTS "Admin/analyst delete founder_action_plans" ON public.founder_action_plans;
CREATE POLICY "Scoped read founder_action_plans" ON public.founder_action_plans FOR SELECT
USING (EXISTS (SELECT 1 FROM public.founder_assessments fa WHERE fa.id = founder_action_plans.founder_assessment_id AND public.can_access_company(fa.company_id, auth.uid())));
CREATE POLICY "Operators write founder_action_plans" ON public.founder_action_plans FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.founder_assessments fa WHERE fa.id = founder_action_plans.founder_assessment_id AND public.can_operate_company(fa.company_id, auth.uid())));
CREATE POLICY "Operators update founder_action_plans" ON public.founder_action_plans FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.founder_assessments fa WHERE fa.id = founder_action_plans.founder_assessment_id AND public.can_operate_company(fa.company_id, auth.uid())));
CREATE POLICY "Operators delete founder_action_plans" ON public.founder_action_plans FOR DELETE
USING (EXISTS (SELECT 1 FROM public.founder_assessments fa WHERE fa.id = founder_action_plans.founder_assessment_id AND public.can_operate_company(fa.company_id, auth.uid())));

-- founder_checkins (via founder_assessments)
DROP POLICY IF EXISTS "Approved read founder_checkins" ON public.founder_checkins;
DROP POLICY IF EXISTS "Admin/analyst write founder_checkins" ON public.founder_checkins;
DROP POLICY IF EXISTS "Admin/analyst update founder_checkins" ON public.founder_checkins;
DROP POLICY IF EXISTS "Admin/analyst delete founder_checkins" ON public.founder_checkins;
CREATE POLICY "Scoped read founder_checkins" ON public.founder_checkins FOR SELECT
USING (EXISTS (SELECT 1 FROM public.founder_assessments fa WHERE fa.id = founder_checkins.founder_assessment_id AND public.can_access_company(fa.company_id, auth.uid())));
CREATE POLICY "Operators write founder_checkins" ON public.founder_checkins FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.founder_assessments fa WHERE fa.id = founder_checkins.founder_assessment_id AND public.can_operate_company(fa.company_id, auth.uid())));
CREATE POLICY "Operators update founder_checkins" ON public.founder_checkins FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.founder_assessments fa WHERE fa.id = founder_checkins.founder_assessment_id AND public.can_operate_company(fa.company_id, auth.uid())));
CREATE POLICY "Operators delete founder_checkins" ON public.founder_checkins FOR DELETE
USING (EXISTS (SELECT 1 FROM public.founder_assessments fa WHERE fa.id = founder_checkins.founder_assessment_id AND public.can_operate_company(fa.company_id, auth.uid())));
