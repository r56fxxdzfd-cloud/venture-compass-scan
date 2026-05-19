-- Populate coherent dimension progress history for Supertech across existing March/April/May meetings.
-- Rules respected: no schema/RLS changes, no deletes, no duplicate rows (upsert by meeting_id,dimension_id).

WITH supertech AS (
  SELECT id AS company_id
  FROM public.companies
  WHERE lower(trim(name)) = 'supertech'
  LIMIT 1
),
meetings AS (
  SELECT
    cm.id AS meeting_id,
    cm.company_id,
    EXTRACT(MONTH FROM cm.meeting_date)::int AS month_num,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(MONTH FROM cm.meeting_date)
      ORDER BY cm.meeting_date DESC, cm.created_at DESC
    ) AS rn
  FROM public.council_meetings cm
  JOIN supertech s ON s.company_id = cm.company_id
  WHERE EXTRACT(MONTH FROM cm.meeting_date) IN (3,4,5)
),
selected_meetings AS (
  SELECT meeting_id, company_id, month_num
  FROM meetings
  WHERE rn = 1
),
payload AS (
  SELECT sm.company_id, sm.meeting_id, x.*
  FROM selected_meetings sm
  JOIN LATERAL (
    VALUES
      (3, 'gr', 'Governança & Riscos', 2.0::numeric, 2.1::numeric, 'stable'::text, 'Primeiros riscos críticos identificados, mas ainda sem matriz formal.', 'Base de governança iniciada; consolidar matriz e periodicidade de revisão.'),
      (3, 'fs', 'Finanças & Sustentabilidade', 2.0::numeric, 2.2::numeric, 'stable'::text, 'DRE gerencial ainda em implantação.', 'Implantação evoluindo; foco em disciplina de fechamento mensal.'),
      (3, 'pl', 'Pessoas & Liderança', 2.3::numeric, 2.2::numeric, 'worsening'::text, 'Dependência da fundadora ainda sem plano de delegação.', 'Risco de concentração decisória permanece elevado.'),
      (3, 'pm', 'Processos & Métricas', 2.1::numeric, 2.3::numeric, 'stable'::text, 'Rituais de acompanhamento ainda informais.', 'Há avanço inicial; formalização de ritos segue pendente.'),

      (4, 'gr', 'Governança & Riscos', 2.0::numeric, 2.6::numeric, 'improving'::text, 'Início da matriz de riscos e registro de decisões do conselho.', 'Evolução consistente na governança; manter cadência de atualização.'),
      (4, 'fs', 'Finanças & Sustentabilidade', 2.0::numeric, 2.8::numeric, 'improving'::text, 'DRE mensal implantada e rotina financeira iniciada.', 'Maior previsibilidade financeira com rotina recorrente.'),
      (4, 'pl', 'Pessoas & Liderança', 2.3::numeric, 2.2::numeric, 'stable'::text, 'Dependências críticas mapeadas parcialmente, mas sem delegação efetiva.', 'Mapeamento avançou, porém execução da delegação ainda insuficiente.'),
      (4, 'pm', 'Processos & Métricas', 2.1::numeric, 2.6::numeric, 'improving'::text, 'Rotina quinzenal de acompanhamento em estruturação.', 'Ritmo operacional mais claro; consolidar indicadores-chave.'),

      (5, 'gr', 'Governança & Riscos', 2.0::numeric, 3.0::numeric, 'improving'::text, 'Matriz de riscos em andamento e governança de decisões mais clara.', 'A empresa demonstra avanço real na disciplina de governança.'),
      (5, 'fs', 'Finanças & Sustentabilidade', 2.0::numeric, 3.1::numeric, 'improving'::text, 'DRE gerencial recorrente e maior previsibilidade financeira.', 'Controles financeiros mais sólidos e recorrentes.'),
      (5, 'pl', 'Pessoas & Liderança', 2.3::numeric, 2.1::numeric, 'worsening'::text, 'Ação de delegação segue travada e dependência da fundadora permanece crítica.', 'Dimensão em atenção prioritária para destravar escala.'),
      (5, 'pm', 'Processos & Métricas', 2.1::numeric, 2.9::numeric, 'improving'::text, 'Acompanhamento quinzenal e métricas operacionais em consolidação.', 'Execução com melhor cadência e visibilidade de performance.')
  ) AS x(month_num, dimension_id, dimension_label, initial_score, current_perceived_score, trend, evidence_note, counselor_comment)
    ON x.month_num = sm.month_num
)
INSERT INTO public.council_dimension_progress (
  company_id,
  meeting_id,
  dimension_id,
  dimension_label,
  initial_score,
  current_perceived_score,
  trend,
  evidence_note,
  counselor_comment
)
SELECT
  company_id,
  meeting_id,
  dimension_id,
  dimension_label,
  initial_score,
  current_perceived_score,
  trend,
  evidence_note,
  counselor_comment
FROM payload
ON CONFLICT (meeting_id, dimension_id)
DO UPDATE SET
  company_id = EXCLUDED.company_id,
  dimension_label = EXCLUDED.dimension_label,
  initial_score = EXCLUDED.initial_score,
  current_perceived_score = EXCLUDED.current_perceived_score,
  trend = EXCLUDED.trend,
  evidence_note = EXCLUDED.evidence_note,
  counselor_comment = EXCLUDED.counselor_comment,
  updated_at = now();
