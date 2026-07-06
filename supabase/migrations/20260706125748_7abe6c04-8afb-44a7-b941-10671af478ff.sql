-- Growth Committee onboarding flow (public intake)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname='public' AND t.typname='startup_pipeline_status') THEN
    CREATE TYPE public.startup_pipeline_status AS ENUM ('invited','registration_started','registration_completed','diagnosis_started','diagnosis_completed','debrief_scheduled','debrief_completed','selected_for_pilot','standby','in_followup');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname='public' AND t.typname='startup_diagnosis_status') THEN
    CREATE TYPE public.startup_diagnosis_status AS ENUM ('not_started','started','completed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.demo_day_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date date NOT NULL,
  start_time time,
  end_time time,
  location_or_format text,
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_demo_day_dates_updated_at ON public.demo_day_dates;
CREATE TRIGGER trg_demo_day_dates_updated_at BEFORE UPDATE ON public.demo_day_dates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS responsible_name text,
  ADD COLUMN IF NOT EXISTS responsible_role text,
  ADD COLUMN IF NOT EXISTS responsible_email text,
  ADD COLUMN IF NOT EXISTS responsible_whatsapp text,
  ADD COLUMN IF NOT EXISTS responsible_birthdate date,
  ADD COLUMN IF NOT EXISTS headcount integer CHECK (headcount IS NULL OR headcount > 0),
  ADD COLUMN IF NOT EXISTS revenue_2025 text,
  ADD COLUMN IF NOT EXISTS revenue_2026_target text,
  ADD COLUMN IF NOT EXISTS expectations_text text,
  ADD COLUMN IF NOT EXISTS demo_day_preferred_date_id uuid REFERENCES public.demo_day_dates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_status public.startup_diagnosis_status NOT NULL DEFAULT 'not_started'::public.startup_diagnosis_status,
  ADD COLUMN IF NOT EXISTS pipeline_status public.startup_pipeline_status NOT NULL DEFAULT 'invited'::public.startup_pipeline_status,
  ADD COLUMN IF NOT EXISTS diagnosis_completed_at timestamptz;

UPDATE public.companies SET company_name = COALESCE(company_name, name) WHERE company_name IS NULL;

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS priority_level text CHECK (priority_level IS NULL OR priority_level IN ('low','medium','high','critical'));

ALTER TABLE public.intake_submissions
  ADD COLUMN IF NOT EXISTS assessment_id uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS flow_completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.onboarding_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key text NOT NULL UNIQUE,
  question_text text NOT NULL,
  field_type text NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_onboarding_questions_updated_at ON public.onboarding_questions;
CREATE TRIGGER trg_onboarding_questions_updated_at BEFORE UPDATE ON public.onboarding_questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.onboarding_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.onboarding_questions(id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  answer_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (startup_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_onboarding_answers_startup ON public.onboarding_answers(startup_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_questions_source_order ON public.onboarding_questions(source, display_order);
DROP TRIGGER IF EXISTS trg_onboarding_answers_updated_at ON public.onboarding_answers;
CREATE TRIGGER trg_onboarding_answers_updated_at BEFORE UPDATE ON public.onboarding_answers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.startup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  old_status text,
  new_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_startup_events_startup_created ON public.startup_events(startup_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_startup_events_type_created ON public.startup_events(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.internal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  startup_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  read_at timestamptz,
  read_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_internal_notifications_created ON public.internal_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_notifications_unread ON public.internal_notifications(read_at) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  value_json jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_settings (key, value, description)
VALUES ('debrief_calendar_url','https://calendly.com/patricia-sepp-boardwise/diagnostico-inicial-darwin-growth?month=2026-07','Calendly externo usado na tela final do diagnostico do empreendedor.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = now();

INSERT INTO public.onboarding_questions (question_key, question_text, field_type, is_required, display_order, is_active, source) VALUES
  ('responsible_name','Nome completo do sócio responsável pela participação no programa (ponto focal)','short_text',true,1,true,'darwin_growth_initial_form'),
  ('company_name','Nome da empresa','short_text',true,2,true,'darwin_growth_initial_form'),
  ('responsible_role','Cargo atual na empresa','short_text',true,3,true,'darwin_growth_initial_form'),
  ('responsible_email','E-mail','email',true,4,true,'darwin_growth_initial_form'),
  ('responsible_whatsapp','WhatsApp','phone_text',true,5,true,'darwin_growth_initial_form'),
  ('responsible_birthdate','Data de nascimento','date',true,6,true,'darwin_growth_initial_form'),
  ('headcount','Quantos colaboradores a empresa possui?','integer',true,7,true,'darwin_growth_initial_form'),
  ('revenue_2025','Faturamento 2025','currency_or_text',true,8,true,'darwin_growth_initial_form'),
  ('revenue_2026_target','Meta de faturamento 2026','currency_or_text',true,9,true,'darwin_growth_initial_form'),
  ('expectations_text','O que você espera obter com a participação no Darwin Growth?','long_text',true,10,true,'darwin_growth_initial_form')
ON CONFLICT (question_key) DO UPDATE SET question_text = EXCLUDED.question_text, field_type = EXCLUDED.field_type, is_required = EXCLUDED.is_required, display_order = EXCLUDED.display_order, is_active = EXCLUDED.is_active, source = EXCLUDED.source, updated_at = now();

ALTER TABLE public.demo_day_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_day_dates TO authenticated;
GRANT SELECT ON public.onboarding_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.startup_events TO authenticated;
GRANT SELECT, UPDATE ON public.internal_notifications TO authenticated;
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.demo_day_dates TO service_role;
GRANT ALL ON public.onboarding_questions TO service_role;
GRANT ALL ON public.onboarding_answers TO service_role;
GRANT ALL ON public.startup_events TO service_role;
GRANT ALL ON public.internal_notifications TO service_role;
GRANT ALL ON public.app_settings TO service_role;

DROP POLICY IF EXISTS "demo_day_dates staff read" ON public.demo_day_dates;
CREATE POLICY "demo_day_dates staff read" ON public.demo_day_dates FOR SELECT TO authenticated USING (public.is_jv_staff());
DROP POLICY IF EXISTS "demo_day_dates operators insert" ON public.demo_day_dates;
CREATE POLICY "demo_day_dates operators insert" ON public.demo_day_dates FOR INSERT TO authenticated WITH CHECK (public.is_jv_operator());
DROP POLICY IF EXISTS "demo_day_dates operators update" ON public.demo_day_dates;
CREATE POLICY "demo_day_dates operators update" ON public.demo_day_dates FOR UPDATE TO authenticated USING (public.is_jv_operator()) WITH CHECK (public.is_jv_operator());
DROP POLICY IF EXISTS "demo_day_dates operators delete" ON public.demo_day_dates;
CREATE POLICY "demo_day_dates operators delete" ON public.demo_day_dates FOR DELETE TO authenticated USING (public.is_jv_operator());

DROP POLICY IF EXISTS "onboarding_questions staff read" ON public.onboarding_questions;
CREATE POLICY "onboarding_questions staff read" ON public.onboarding_questions FOR SELECT TO authenticated USING (public.is_jv_staff());

DROP POLICY IF EXISTS "onboarding_answers staff read" ON public.onboarding_answers;
CREATE POLICY "onboarding_answers staff read" ON public.onboarding_answers FOR SELECT TO authenticated USING (public.is_jv_staff() OR public.is_advisor_of(startup_id));
DROP POLICY IF EXISTS "onboarding_answers operators insert" ON public.onboarding_answers;
CREATE POLICY "onboarding_answers operators insert" ON public.onboarding_answers FOR INSERT TO authenticated WITH CHECK (public.is_jv_operator());
DROP POLICY IF EXISTS "onboarding_answers operators update" ON public.onboarding_answers;
CREATE POLICY "onboarding_answers operators update" ON public.onboarding_answers FOR UPDATE TO authenticated USING (public.is_jv_operator()) WITH CHECK (public.is_jv_operator());
DROP POLICY IF EXISTS "onboarding_answers operators delete" ON public.onboarding_answers;
CREATE POLICY "onboarding_answers operators delete" ON public.onboarding_answers FOR DELETE TO authenticated USING (public.is_jv_operator());

DROP POLICY IF EXISTS "startup_events staff read" ON public.startup_events;
CREATE POLICY "startup_events staff read" ON public.startup_events FOR SELECT TO authenticated USING (public.is_jv_staff() OR (startup_id IS NOT NULL AND public.is_advisor_of(startup_id)));
DROP POLICY IF EXISTS "startup_events operators insert" ON public.startup_events;
CREATE POLICY "startup_events operators insert" ON public.startup_events FOR INSERT TO authenticated WITH CHECK (public.is_jv_operator());
DROP POLICY IF EXISTS "startup_events operators update" ON public.startup_events;
CREATE POLICY "startup_events operators update" ON public.startup_events FOR UPDATE TO authenticated USING (public.is_jv_operator()) WITH CHECK (public.is_jv_operator());
DROP POLICY IF EXISTS "startup_events operators delete" ON public.startup_events;
CREATE POLICY "startup_events operators delete" ON public.startup_events FOR DELETE TO authenticated USING (public.is_jv_operator());

DROP POLICY IF EXISTS "internal_notifications staff read" ON public.internal_notifications;
CREATE POLICY "internal_notifications staff read" ON public.internal_notifications FOR SELECT TO authenticated USING (public.is_jv_staff() OR (startup_id IS NOT NULL AND public.is_advisor_of(startup_id)));
DROP POLICY IF EXISTS "internal_notifications staff update" ON public.internal_notifications;
CREATE POLICY "internal_notifications staff update" ON public.internal_notifications FOR UPDATE TO authenticated USING (public.is_jv_staff()) WITH CHECK (public.is_jv_staff());

DROP POLICY IF EXISTS "app_settings staff read" ON public.app_settings;
CREATE POLICY "app_settings staff read" ON public.app_settings FOR SELECT TO authenticated USING (public.is_jv_staff());
DROP POLICY IF EXISTS "app_settings operators update" ON public.app_settings;
CREATE POLICY "app_settings operators update" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_jv_operator()) WITH CHECK (public.is_jv_operator());

CREATE OR REPLACE FUNCTION public.log_company_pipeline_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.pipeline_status IS DISTINCT FROM OLD.pipeline_status THEN
    INSERT INTO public.startup_events (startup_id, event_type, old_status, new_status, metadata, created_by)
    VALUES (NEW.id, 'pipeline_status_changed', OLD.pipeline_status::text, NEW.pipeline_status::text,
      jsonb_build_object('company_name', COALESCE(NEW.company_name, NEW.name)), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_pipeline_status_changed ON public.companies;
CREATE TRIGGER trg_companies_pipeline_status_changed AFTER UPDATE OF pipeline_status ON public.companies FOR EACH ROW EXECUTE FUNCTION public.log_company_pipeline_status_change();

REVOKE EXECUTE ON FUNCTION public.log_company_pipeline_status_change() FROM PUBLIC, anon, authenticated;