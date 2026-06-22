-- FASE 3 — action_items (quick win vira tarefa viva)
-- Nível de COMPANY: persiste entre rodadas de diagnóstico. assessment_id é
-- opcional e ON DELETE SET NULL (não some quando o assessment é removido).
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.action_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assessment_id    uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  source_action_id text,                              -- id da ação Pareto (ex 'FS-01')
  title            text NOT NULL,
  description      text,
  first_step       text,
  done_definition  text,
  dimension_id     text,
  owner_label      text,                              -- responsável em texto livre (pode ser o fundador)
  status           text NOT NULL DEFAULT 'todo'  CHECK (status IN ('todo','doing','done','blocked')),
  effort           text CHECK (effort IN ('S','M','L')),
  priority         numeric,
  due_date         date,
  created_by       uuid REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_items_company ON public.action_items(company_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status  ON public.action_items(status);

-- Evita duplicar a mesma ação Pareto na mesma company (mantém manuais livres).
CREATE UNIQUE INDEX IF NOT EXISTS uq_action_items_company_source
  ON public.action_items(company_id, source_action_id)
  WHERE source_action_id IS NOT NULL;

ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

-- updated_at via trigger reutilizando public.set_updated_at() (já existe no schema).
DROP TRIGGER IF EXISTS trg_action_items_updated_at ON public.action_items;
CREATE TRIGGER trg_action_items_updated_at
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS:
--  SELECT  = staff OU advisor da company
--  WRITE   = operador (admin/analyst) sempre; advisor só nas companies atribuídas
DROP POLICY IF EXISTS "action_items read" ON public.action_items;
CREATE POLICY "action_items read" ON public.action_items
  FOR SELECT
  USING (public.is_jv_staff() OR public.is_advisor_of(company_id));

DROP POLICY IF EXISTS "action_items insert" ON public.action_items;
CREATE POLICY "action_items insert" ON public.action_items
  FOR INSERT
  WITH CHECK (public.is_jv_operator() OR public.is_advisor_of(company_id));

DROP POLICY IF EXISTS "action_items update" ON public.action_items;
CREATE POLICY "action_items update" ON public.action_items
  FOR UPDATE
  USING (public.is_jv_operator() OR public.is_advisor_of(company_id))
  WITH CHECK (public.is_jv_operator() OR public.is_advisor_of(company_id));

DROP POLICY IF EXISTS "action_items delete" ON public.action_items;
CREATE POLICY "action_items delete" ON public.action_items
  FOR DELETE
  USING (public.is_jv_operator() OR public.is_advisor_of(company_id));
