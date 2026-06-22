-- FASE 1 RBAC — helpers de papel + atribuição de conselheiros por startup
-- Idempotente. Não altera o modelo demo existente (can_access_company /
-- can_operate_company permanecem intactos). Acesso de jv_advisor é concedido
-- exclusivamente por políticas ADITIVAS escopadas por advisor_assignments,
-- de modo que jv_advisor NÃO herda acesso amplo.

-- ============================================================
-- 1) Helpers (SECURITY DEFINER, STABLE, search_path = public)
-- ============================================================

-- Papel "mais privilegiado" do usuário corrente (texto), para conveniência de UI/policies.
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.role::text
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  ORDER BY CASE ur.role
    WHEN 'super_admin' THEN 1
    WHEN 'jv_admin'    THEN 2
    WHEN 'jv_analyst'  THEN 3
    WHEN 'jv_viewer'   THEN 4
    WHEN 'jv_advisor'  THEN 5
    WHEN 'demo_admin'  THEN 6
    WHEN 'demo_user'   THEN 7
    WHEN 'user'        THEN 8
    ELSE 9
  END
  LIMIT 1
$$;

-- Usuário corrente é membro aprovado?
CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_approved_member(auth.uid())
$$;

-- Staff interno JV (leitura ampla): admin / analyst / viewer (+ super_admin).
CREATE OR REPLACE FUNCTION public.is_jv_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'super_admin'::public.app_role,
        'jv_admin'::public.app_role,
        'jv_analyst'::public.app_role,
        'jv_viewer'::public.app_role
      )
  )
$$;

-- Operadores JV (escrita): admin / analyst (+ super_admin). Viewer NÃO escreve.
CREATE OR REPLACE FUNCTION public.is_jv_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'super_admin'::public.app_role,
        'jv_admin'::public.app_role,
        'jv_analyst'::public.app_role
      )
  )
$$;

-- ============================================================
-- 2) Tabela advisor_assignments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.advisor_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  advisor_id  uuid NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, advisor_id)
);

CREATE INDEX IF NOT EXISTS idx_advisor_assignments_company ON public.advisor_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_advisor_assignments_advisor ON public.advisor_assignments(advisor_id);

ALTER TABLE public.advisor_assignments ENABLE ROW LEVEL SECURITY;

-- is_advisor_of depende da tabela já existir.
CREATE OR REPLACE FUNCTION public.is_advisor_of(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.advisor_assignments aa
    WHERE aa.company_id = p_company_id
      AND aa.advisor_id = auth.uid()
  )
$$;

-- RLS advisor_assignments:
--  SELECT: staff (tudo) OU o próprio advisor (suas linhas)
--  INSERT/DELETE: operadores (admin/analyst)
DROP POLICY IF EXISTS "advisor_assignments read" ON public.advisor_assignments;
CREATE POLICY "advisor_assignments read" ON public.advisor_assignments
  FOR SELECT
  USING (public.is_jv_staff() OR advisor_id = auth.uid());

DROP POLICY IF EXISTS "advisor_assignments insert" ON public.advisor_assignments;
CREATE POLICY "advisor_assignments insert" ON public.advisor_assignments
  FOR INSERT
  WITH CHECK (public.is_jv_operator());

DROP POLICY IF EXISTS "advisor_assignments delete" ON public.advisor_assignments;
CREATE POLICY "advisor_assignments delete" ON public.advisor_assignments
  FOR DELETE
  USING (public.is_jv_operator());

-- ============================================================
-- 3) Políticas ADITIVAS de leitura para jv_advisor
--    (escopadas por advisor_assignments; não tocam a lógica demo)
-- ============================================================

-- companies: advisor lê apenas as atribuídas
DROP POLICY IF EXISTS "Advisor read assigned companies" ON public.companies;
CREATE POLICY "Advisor read assigned companies" ON public.companies
  FOR SELECT
  USING (public.is_advisor_of(id));

-- assessments: advisor lê apenas das companies atribuídas
DROP POLICY IF EXISTS "Advisor read assigned assessments" ON public.assessments;
CREATE POLICY "Advisor read assigned assessments" ON public.assessments
  FOR SELECT
  USING (public.is_advisor_of(company_id));

-- answers: via assessments
DROP POLICY IF EXISTS "Advisor read assigned answers" ON public.answers;
CREATE POLICY "Advisor read assigned answers" ON public.answers
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = answers.assessment_id
      AND public.is_advisor_of(a.company_id)
  ));

-- assessment_red_flags: via assessments
DROP POLICY IF EXISTS "Advisor read assigned assessment_red_flags" ON public.assessment_red_flags;
CREATE POLICY "Advisor read assigned assessment_red_flags" ON public.assessment_red_flags
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_red_flags.assessment_id
      AND public.is_advisor_of(a.company_id)
  ));
