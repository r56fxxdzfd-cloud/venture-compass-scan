-- Repair production drift for the public intake Demo Day step.
-- Idempotent: safe to run even when part of the schema already exists.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS demo_day_selected boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_companies_demo_day
  ON public.companies(demo_day_selected);

ALTER TABLE public.demo_day_dates
  ADD COLUMN IF NOT EXISTS date_label text;

CREATE TABLE IF NOT EXISTS public.company_demo_day_preferences (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  demo_day_date_id uuid NOT NULL REFERENCES public.demo_day_dates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, demo_day_date_id)
);

CREATE INDEX IF NOT EXISTS idx_company_demo_day_preferences_demo_day_date_id
  ON public.company_demo_day_preferences(demo_day_date_id);

ALTER TABLE public.company_demo_day_preferences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.company_demo_day_preferences TO authenticated;
GRANT ALL ON public.company_demo_day_preferences TO service_role;

DROP POLICY IF EXISTS "company_demo_day_preferences staff read" ON public.company_demo_day_preferences;
CREATE POLICY "company_demo_day_preferences staff read" ON public.company_demo_day_preferences
  FOR SELECT TO authenticated
  USING (public.is_jv_staff() OR public.is_advisor_of(company_id));

DROP POLICY IF EXISTS "company_demo_day_preferences operators insert" ON public.company_demo_day_preferences;
CREATE POLICY "company_demo_day_preferences operators insert" ON public.company_demo_day_preferences
  FOR INSERT TO authenticated
  WITH CHECK (public.is_jv_operator());

DROP POLICY IF EXISTS "company_demo_day_preferences operators delete" ON public.company_demo_day_preferences;
CREATE POLICY "company_demo_day_preferences operators delete" ON public.company_demo_day_preferences
  FOR DELETE TO authenticated
  USING (public.is_jv_operator());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.demo_day_dates WHERE title = 'Demo Day São Paulo - Opção 1') THEN
    UPDATE public.demo_day_dates
    SET date = '2026-07-22',
        date_label = '22 e 23 de julho de 2026',
        start_time = NULL,
        end_time = NULL,
        location_or_format = 'São Paulo - SP',
        capacity = NULL,
        is_active = true,
        updated_at = now()
    WHERE title = 'Demo Day São Paulo - Opção 1';
  ELSE
    INSERT INTO public.demo_day_dates (
      title,
      date,
      date_label,
      start_time,
      end_time,
      location_or_format,
      capacity,
      is_active
    )
    VALUES (
      'Demo Day São Paulo - Opção 1',
      '2026-07-22',
      '22 e 23 de julho de 2026',
      NULL,
      NULL,
      'São Paulo - SP',
      NULL,
      true
    );
  END IF;

  IF EXISTS (SELECT 1 FROM public.demo_day_dates WHERE title = 'Demo Day São Paulo - Opção 2') THEN
    UPDATE public.demo_day_dates
    SET date = '2026-07-28',
        date_label = '28 e 30 de julho de 2026',
        start_time = NULL,
        end_time = NULL,
        location_or_format = 'São Paulo - SP',
        capacity = NULL,
        is_active = true,
        updated_at = now()
    WHERE title = 'Demo Day São Paulo - Opção 2';
  ELSE
    INSERT INTO public.demo_day_dates (
      title,
      date,
      date_label,
      start_time,
      end_time,
      location_or_format,
      capacity,
      is_active
    )
    VALUES (
      'Demo Day São Paulo - Opção 2',
      '2026-07-28',
      '28 e 30 de julho de 2026',
      NULL,
      NULL,
      'São Paulo - SP',
      NULL,
      true
    );
  END IF;
END $$;

UPDATE public.demo_day_dates
SET is_active = false,
    updated_at = now()
WHERE is_active = true
  AND title NOT IN ('Demo Day São Paulo - Opção 1', 'Demo Day São Paulo - Opção 2')
  AND (
    title ILIKE '%demo day%'
    OR title ILIKE '%darwin growth%'
  );
