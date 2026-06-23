-- Marcador "Selecionada para Demo Day" na organização.
-- Apoia a priorização do tipo "diagnostico 10, convido 5". Idempotente.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS demo_day_selected boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_companies_demo_day ON public.companies(demo_day_selected);
