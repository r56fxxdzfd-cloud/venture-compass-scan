-- Arquivar / excluir organizações — exclusivo de Super Admin.
-- Idempotente. Arquivar é reversível (esconde da lista). Excluir é permanente
-- e remove em cascata todo o histórico ligado à organização.

-- 1) Coluna de arquivamento
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_companies_archived ON public.companies(archived_at);

-- 2) Arquivar / desarquivar (Super Admin only)
CREATE OR REPLACE FUNCTION public.set_company_archived(p_company_id uuid, p_archived boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas Super Admin pode arquivar/desarquivar organizações';
  END IF;
  UPDATE public.companies
     SET archived_at = CASE WHEN p_archived THEN now() ELSE NULL END
   WHERE id = p_company_id;
END;
$$;

-- 3) Exclusão permanente em cascata (Super Admin only).
CREATE OR REPLACE FUNCTION public.delete_company(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas Super Admin pode excluir organizações';
  END IF;

  DELETE FROM public.founder_pillar_scores WHERE founder_assessment_id IN (
    SELECT fa.id FROM public.founder_assessments fa
    LEFT JOIN public.founders f ON f.id = fa.founder_id
    WHERE fa.company_id = p_company_id OR f.company_id = p_company_id);
  DELETE FROM public.founder_action_plans WHERE founder_assessment_id IN (
    SELECT fa.id FROM public.founder_assessments fa
    LEFT JOIN public.founders f ON f.id = fa.founder_id
    WHERE fa.company_id = p_company_id OR f.company_id = p_company_id);
  DELETE FROM public.founder_checkins WHERE founder_assessment_id IN (
    SELECT fa.id FROM public.founder_assessments fa
    LEFT JOIN public.founders f ON f.id = fa.founder_id
    WHERE fa.company_id = p_company_id OR f.company_id = p_company_id);
  DELETE FROM public.founder_assessments
   WHERE company_id = p_company_id
      OR founder_id IN (SELECT id FROM public.founders WHERE company_id = p_company_id);
  DELETE FROM public.founders WHERE company_id = p_company_id;

  DELETE FROM public.council_dimension_progress WHERE company_id = p_company_id;
  DELETE FROM public.council_actions WHERE company_id = p_company_id;
  DELETE FROM public.council_meetings WHERE company_id = p_company_id;

  DELETE FROM public.answers WHERE assessment_id IN (
    SELECT id FROM public.assessments WHERE company_id = p_company_id);
  DELETE FROM public.assessment_red_flags WHERE assessment_id IN (
    SELECT id FROM public.assessments WHERE company_id = p_company_id);
  DELETE FROM public.assessments WHERE company_id = p_company_id;

  UPDATE public.intake_submissions SET company_id = NULL WHERE company_id = p_company_id;

  DELETE FROM public.companies WHERE id = p_company_id;
END;
$$;

-- 4) Política DELETE
DROP POLICY IF EXISTS "Operators delete companies" ON public.companies;
DROP POLICY IF EXISTS "RBAC delete companies admins only" ON public.companies;
DROP POLICY IF EXISTS "Super admin delete companies" ON public.companies;
CREATE POLICY "Super admin delete companies" ON public.companies
  FOR DELETE USING (public.is_super_admin(auth.uid()));