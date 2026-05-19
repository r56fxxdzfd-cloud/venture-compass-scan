-- Fase 1.1 RBAC: isolamento mínimo de Demo User por RLS
-- Objetivo: garantir que demo_user só acesse dados de companies.is_demo = true,
-- preservando acesso global para super_admin/jv_admin e sem ampliar acesso para user comum.

CREATE OR REPLACE FUNCTION public.can_access_company(_company_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    CASE
      WHEN _company_id IS NULL OR _user_id IS NULL THEN false
      WHEN public.is_super_admin(_user_id) THEN true
      WHEN public.is_jv_admin(_user_id) THEN true
      WHEN public.is_demo_user(_user_id) THEN EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE c.id = _company_id
          AND c.is_demo = true
      )
      -- Compatibilidade com comportamento legado de membros aprovados:
      -- mantém acesso de leitura/escrita existente para perfis internos não-demo,
      -- sem nunca ampliar acesso para demo_user em empresas reais.
      WHEN public.is_approved_member(_user_id) THEN true
      ELSE false
    END;
$$;

-- companies
DROP POLICY IF EXISTS "JV members read companies" ON public.companies;
CREATE POLICY "RBAC read companies by role and demo scope"
ON public.companies
FOR SELECT
USING (
  public.can_access_company(id, auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst write companies" ON public.companies;
CREATE POLICY "RBAC write companies admins only"
ON public.companies
FOR INSERT
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst update companies" ON public.companies;
CREATE POLICY "RBAC update companies admins only"
ON public.companies
FOR UPDATE
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
)
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst delete companies" ON public.companies;
CREATE POLICY "RBAC delete companies admins only"
ON public.companies
FOR DELETE
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
);

-- Tabelas com company_id direto
DROP POLICY IF EXISTS "JV read assessments" ON public.assessments;
DROP POLICY IF EXISTS "Approved read assessments" ON public.assessments;
CREATE POLICY "RBAC read assessments by company scope"
ON public.assessments
FOR SELECT
USING (public.can_access_company(company_id, auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst write assessments" ON public.assessments;
CREATE POLICY "RBAC write assessments admins only"
ON public.assessments
FOR INSERT
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst update assessments" ON public.assessments;
CREATE POLICY "RBAC update assessments admins only"
ON public.assessments
FOR UPDATE
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
)
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst delete assessments" ON public.assessments;
CREATE POLICY "RBAC delete assessments admins only"
ON public.assessments
FOR DELETE
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "Approved read founders" ON public.founders;
CREATE POLICY "RBAC read founders by company scope"
ON public.founders
FOR SELECT
TO authenticated
USING (public.can_access_company(company_id, auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst write founders" ON public.founders;
CREATE POLICY "RBAC write founders admins only"
ON public.founders
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst update founders" ON public.founders;
CREATE POLICY "RBAC update founders admins only"
ON public.founders
FOR UPDATE
TO authenticated
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
)
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst delete founders" ON public.founders;
CREATE POLICY "RBAC delete founders admins only"
ON public.founders
FOR DELETE
TO authenticated
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "JV read council_meetings" ON public.council_meetings;
CREATE POLICY "RBAC read council_meetings by company scope"
ON public.council_meetings
FOR SELECT
USING (public.can_access_company(company_id, auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst write council_meetings" ON public.council_meetings;
CREATE POLICY "RBAC write council_meetings admins only"
ON public.council_meetings
FOR INSERT
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst update council_meetings" ON public.council_meetings;
CREATE POLICY "RBAC update council_meetings admins only"
ON public.council_meetings
FOR UPDATE
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
)
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst delete council_meetings" ON public.council_meetings;
CREATE POLICY "RBAC delete council_meetings admins only"
ON public.council_meetings
FOR DELETE
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "JV read council_actions" ON public.council_actions;
CREATE POLICY "RBAC read council_actions by company scope"
ON public.council_actions
FOR SELECT
USING (public.can_access_company(company_id, auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst write council_actions" ON public.council_actions;
CREATE POLICY "RBAC write council_actions admins only"
ON public.council_actions
FOR INSERT
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst update council_actions" ON public.council_actions;
CREATE POLICY "RBAC update council_actions admins only"
ON public.council_actions
FOR UPDATE
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
)
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst delete council_actions" ON public.council_actions;
CREATE POLICY "RBAC delete council_actions admins only"
ON public.council_actions
FOR DELETE
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "JV read council_dimension_progress" ON public.council_dimension_progress;
CREATE POLICY "RBAC read council_dimension_progress by company scope"
ON public.council_dimension_progress
FOR SELECT
USING (public.can_access_company(company_id, auth.uid()));

DROP POLICY IF EXISTS "Admin/analyst write council_dimension_progress" ON public.council_dimension_progress;
CREATE POLICY "RBAC write council_dimension_progress admins only"
ON public.council_dimension_progress
FOR INSERT
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst update council_dimension_progress" ON public.council_dimension_progress;
CREATE POLICY "RBAC update council_dimension_progress admins only"
ON public.council_dimension_progress
FOR UPDATE
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
)
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst delete council_dimension_progress" ON public.council_dimension_progress;
CREATE POLICY "RBAC delete council_dimension_progress admins only"
ON public.council_dimension_progress
FOR DELETE
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

-- Tabelas indiretas (relacionamento por founder / founder_assessment)
DROP POLICY IF EXISTS "Approved read founder_assessments" ON public.founder_assessments;
CREATE POLICY "RBAC read founder_assessments by company scope"
ON public.founder_assessments
FOR SELECT
TO authenticated
USING (
  public.can_access_company(company_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.founders f
    WHERE f.id = founder_assessments.founder_id
      AND public.can_access_company(f.company_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Admin/analyst write founder_assessments" ON public.founder_assessments;
CREATE POLICY "RBAC write founder_assessments admins only"
ON public.founder_assessments
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst update founder_assessments" ON public.founder_assessments;
CREATE POLICY "RBAC update founder_assessments admins only"
ON public.founder_assessments
FOR UPDATE
TO authenticated
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND (
    public.can_access_company(company_id, auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.founders f
      WHERE f.id = founder_assessments.founder_id
        AND public.can_access_company(f.company_id, auth.uid())
    )
  )
)
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND public.can_access_company(company_id, auth.uid())
);

DROP POLICY IF EXISTS "Admin/analyst delete founder_assessments" ON public.founder_assessments;
CREATE POLICY "RBAC delete founder_assessments admins only"
ON public.founder_assessments
FOR DELETE
TO authenticated
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND (
    public.can_access_company(company_id, auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.founders f
      WHERE f.id = founder_assessments.founder_id
        AND public.can_access_company(f.company_id, auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Approved read founder_pillar_scores" ON public.founder_pillar_scores;
CREATE POLICY "RBAC read founder_pillar_scores by company scope"
ON public.founder_pillar_scores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.founder_assessments fa
    JOIN public.founders f ON f.id = fa.founder_id
    WHERE fa.id = founder_pillar_scores.founder_assessment_id
      AND public.can_access_company(COALESCE(fa.company_id, f.company_id), auth.uid())
  )
);

DROP POLICY IF EXISTS "Admin/analyst write founder_pillar_scores" ON public.founder_pillar_scores;
CREATE POLICY "RBAC write founder_pillar_scores admins only"
ON public.founder_pillar_scores
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.founder_assessments fa
    JOIN public.founders f ON f.id = fa.founder_id
    WHERE fa.id = founder_pillar_scores.founder_assessment_id
      AND public.can_access_company(COALESCE(fa.company_id, f.company_id), auth.uid())
  )
);

DROP POLICY IF EXISTS "Admin/analyst update founder_pillar_scores" ON public.founder_pillar_scores;
CREATE POLICY "RBAC update founder_pillar_scores admins only"
ON public.founder_pillar_scores
FOR UPDATE
TO authenticated
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.founder_assessments fa
    JOIN public.founders f ON f.id = fa.founder_id
    WHERE fa.id = founder_pillar_scores.founder_assessment_id
      AND public.can_access_company(COALESCE(fa.company_id, f.company_id), auth.uid())
  )
)
WITH CHECK (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.founder_assessments fa
    JOIN public.founders f ON f.id = fa.founder_id
    WHERE fa.id = founder_pillar_scores.founder_assessment_id
      AND public.can_access_company(COALESCE(fa.company_id, f.company_id), auth.uid())
  )
);

DROP POLICY IF EXISTS "Admin/analyst delete founder_pillar_scores" ON public.founder_pillar_scores;
CREATE POLICY "RBAC delete founder_pillar_scores admins only"
ON public.founder_pillar_scores
FOR DELETE
TO authenticated
USING (
  public.can_operate_platform(auth.uid())
  AND public.is_approved_member(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.founder_assessments fa
    JOIN public.founders f ON f.id = fa.founder_id
    WHERE fa.id = founder_pillar_scores.founder_assessment_id
      AND public.can_access_company(COALESCE(fa.company_id, f.company_id), auth.uid())
  )
);
