-- Alinha os templates da agenda do conselho às dimensões oficiais publicadas
-- sem alterar estrutura, RLS, triggers, rotas, layout ou lógica.

DO $$
DECLARE
  v_official_count integer;
  v_template_count integer;
BEGIN
  SELECT count(*) INTO v_official_count
  FROM public.dimensions d
  JOIN public.config_versions cv ON cv.id = d.config_version_id
  WHERE cv.is_active = true
    AND d.is_active = true;

  IF v_official_count <> 9 THEN
    RAISE EXCEPTION 'Esperadas 9 dimensões oficiais ativas na configuração ativa. Encontradas: %', v_official_count;
  END IF;

  SELECT count(*) INTO v_template_count
  FROM public.council_agenda_templates
  WHERE is_active = true;

  IF v_template_count <> 9 THEN
    RAISE EXCEPTION 'Esperados 9 templates ativos antes do alinhamento. Encontrados: %', v_template_count;
  END IF;
END $$;

WITH official_dimensions AS (
  SELECT
    d.id,
    d.label,
    d.sort_order,
    row_number() OVER (ORDER BY d.sort_order, d.id) AS rn
  FROM public.dimensions d
  JOIN public.config_versions cv ON cv.id = d.config_version_id
  WHERE cv.is_active = true
    AND d.is_active = true
),
templates_ranked AS (
  SELECT
    t.id,
    t.sort_order,
    row_number() OVER (ORDER BY t.sort_order, t.id) AS rn
  FROM public.council_agenda_templates t
  WHERE t.is_active = true
)
UPDATE public.council_agenda_templates t
SET
  dimension_id = od.id,
  dimension_label = od.label,
  title = 'Conselho OS — ' || od.label || ': foco do ciclo',
  objective = 'Avaliar a evolução da dimensão ' || od.label || ' no ciclo atual e pactuar próximos passos objetivos com responsáveis e prazo.',
  key_questions = ARRAY[
    'O que evoluiu na dimensão ' || od.label || ' desde o último conselho?',
    'Quais bloqueios estão reduzindo a performance desta dimensão?',
    'Que decisão de conselho destrava avanço mensurável até o próximo ciclo?'
  ],
  expected_evidence = ARRAY[
    'Indicadores e fatos objetivos da dimensão ' || od.label || ' no período.',
    'Comparativo entre meta planejada e resultado realizado.',
    'Riscos, dependências e trade-offs explicitados para decisão.'
  ],
  suggested_actions = ARRAY[
    'Definir 1 a 3 ações priorizadas para a dimensão ' || od.label || '.',
    'Nomear owner, prazo e métrica de sucesso para cada ação.',
    'Registrar checkpoint intermediário e critério de conclusão.'
  ],
  when_to_use = 'Usar quando houver necessidade de calibrar prioridade, remover bloqueios e acelerar a evolução da dimensão ' || od.label || '.',
  priority = CASE WHEN od.sort_order <= 3 THEN 'high' WHEN od.sort_order <= 6 THEN 'medium' ELSE 'low' END,
  sort_order = od.sort_order,
  is_active = true,
  updated_at = now()
FROM templates_ranked tr
JOIN official_dimensions od ON od.rn = tr.rn
WHERE t.id = tr.id;

-- Segurança: garante exatamente um template ativo por dimensão oficial.
WITH duplicate_dims AS (
  SELECT dimension_id
  FROM public.council_agenda_templates
  WHERE is_active = true
  GROUP BY dimension_id
  HAVING count(*) > 1
)
UPDATE public.council_agenda_templates t
SET is_active = false,
    updated_at = now()
WHERE t.id IN (
  SELECT t2.id
  FROM public.council_agenda_templates t2
  JOIN duplicate_dims dd ON dd.dimension_id = t2.dimension_id
  WHERE t2.is_active = true
    AND t2.id NOT IN (
      SELECT min(t3.id)
      FROM public.council_agenda_templates t3
      WHERE t3.is_active = true
      GROUP BY t3.dimension_id
    )
);
