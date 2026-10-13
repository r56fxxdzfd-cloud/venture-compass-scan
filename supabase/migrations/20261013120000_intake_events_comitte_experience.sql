-- Eventos com link público único (ex.: Comitte Experience).
--
-- Um link de evento é compartilhável: abrir o link NÃO cria nada. O intake
-- individual (intake_submissions) nasce só no envio do cadastro, via
-- intake-submit action=event_start — mesma razão pela qual o intake-validate
-- deixou de criar companies placeholder (scanners de link poluíam o pipeline).
--
-- Fluxo do evento: cadastro -> diagnóstico -> confirmação de data(s) -> confirmação.
-- As datas do evento ficam em demo_day_dates com event_id preenchido e só aparecem
-- nos links daquele evento; datas sem event_id seguem no fluxo normal de Demo Day.

CREATE TABLE IF NOT EXISTS public.intake_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  public_token text NOT NULL UNIQUE
    DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_events ENABLE ROW LEVEL SECURITY;

-- Nenhum acesso anon: o público só chega ao evento pelas edge functions (service role).
DROP POLICY IF EXISTS "intake_events staff read" ON public.intake_events;
CREATE POLICY "intake_events staff read" ON public.intake_events
  FOR SELECT TO authenticated USING (public.is_jv_staff());

DROP POLICY IF EXISTS "intake_events operators insert" ON public.intake_events;
CREATE POLICY "intake_events operators insert" ON public.intake_events
  FOR INSERT TO authenticated WITH CHECK (public.is_jv_operator());

DROP POLICY IF EXISTS "intake_events operators update" ON public.intake_events;
CREATE POLICY "intake_events operators update" ON public.intake_events
  FOR UPDATE TO authenticated USING (public.is_jv_operator()) WITH CHECK (public.is_jv_operator());

DROP POLICY IF EXISTS "intake_events operators delete" ON public.intake_events;
CREATE POLICY "intake_events operators delete" ON public.intake_events
  FOR DELETE TO authenticated USING (public.is_jv_operator());

ALTER TABLE public.demo_day_dates
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.intake_events(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS demo_day_dates_event_id_idx ON public.demo_day_dates(event_id);

ALTER TABLE public.intake_submissions
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.intake_events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS intake_submissions_event_id_idx ON public.intake_submissions(event_id);

-- Seed: Comitte Experience, 10 e 11 de novembro de 2026.
INSERT INTO public.intake_events (slug, name, description)
VALUES ('comitte-experience-2026', 'Comitte Experience', '10 e 11 de novembro de 2026')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.demo_day_dates (title, date, date_label, is_active, event_id)
SELECT v.title, v.day, v.label, true, e.id
FROM public.intake_events e
CROSS JOIN (VALUES
  ('Comitte Experience — Dia 1', DATE '2026-11-10', '10 de novembro de 2026 (terça-feira)'),
  ('Comitte Experience — Dia 2', DATE '2026-11-11', '11 de novembro de 2026 (quarta-feira)')
) AS v(title, day, label)
WHERE e.slug = 'comitte-experience-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.demo_day_dates d WHERE d.event_id = e.id AND d.date = v.day
  );
