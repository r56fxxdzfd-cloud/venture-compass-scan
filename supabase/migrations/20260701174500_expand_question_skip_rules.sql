create or replace function pg_temp.add_question_skip_rule(
  config jsonb,
  target_pattern text,
  source_pattern text,
  reason text,
  threshold numeric default 1
)
returns jsonb
language plpgsql
as $$
declare
  source_question_id text;
  updated_questions jsonb;
begin
  select question ->> 'id'
  into source_question_id
  from jsonb_array_elements(coalesce(config -> 'questions', '[]'::jsonb)) as question
  where question ->> 'text' ~* source_pattern
  order by (question ->> 'sort_order')::int nulls last
  limit 1;

  if source_question_id is null then
    return config;
  end if;

  select jsonb_agg(
    case
      when question ->> 'text' ~* target_pattern
        and not exists (
          select 1
          from jsonb_array_elements(coalesce(question #> '{tags,skip_if}', '[]'::jsonb)) as existing_rule
          where existing_rule ->> 'question_id' = source_question_id
        )
      then jsonb_set(
        question,
        '{tags}',
        coalesce(question -> 'tags', '{}'::jsonb) || jsonb_build_object(
          'skip_if',
          coalesce(question #> '{tags,skip_if}', '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object(
              'question_id', source_question_id,
              'op', '<=',
              'value', threshold,
              'reason', reason
            )
          )
        ),
        true
      )
      else question
    end
    order by ordinality
  )
  into updated_questions
  from jsonb_array_elements(coalesce(config -> 'questions', '[]'::jsonb)) with ordinality as item(question, ordinality);

  return jsonb_set(config, '{questions}', coalesce(updated_questions, '[]'::jsonb), true);
end;
$$;

update public.config_versions
set config_json =
  pg_temp.add_question_skip_rule(
  pg_temp.add_question_skip_rule(
  pg_temp.add_question_skip_rule(
  pg_temp.add_question_skip_rule(
  pg_temp.add_question_skip_rule(
  pg_temp.add_question_skip_rule(
  pg_temp.add_question_skip_rule(
  pg_temp.add_question_skip_rule(
    config_json,
    'rituais?.*cultura|cultura.*rituais?',
    'valores.*definidos.*comunicados',
    'Sem valores minimamente definidos e comunicados, avaliar rituais de reforço cultural fica prematuro.',
    1
  ),
    'okr|metas?.*mensur|indicadores?.*estrat',
    'estrat[eé]gia.*clara|prioridades?.*claras',
    'Sem clareza mínima de estratégia/prioridades, detalhar OKRs ou metas mensuráveis fica redundante.',
    1
  ),
    'dashboard|indicadores?.*acompanha|m[eé]tricas?.*rotina',
    'm[eé]tricas?.*definidas|indicadores?.*definidos',
    'Sem métricas minimamente definidas, avaliar rotina de acompanhamento ou dashboard fica prematuro.',
    1
  ),
    'forecast|dre|demonstrativo|relat[oó]rio financeiro',
    'receitas?.*custos?|custos?.*receitas?|financeir.*registr',
    'Sem registros financeiros mínimos, avaliar DRE, forecast ou relatório financeiro recorrente fica prematuro.',
    1
  ),
    'hiring|contrata|recrutamento|sele[cç][aã]o',
    'pap[eé]is.*responsabilidades|responsabilidades.*pap[eé]is|estrutura.*time',
    'Sem papéis e responsabilidades minimamente claros, avaliar processo de contratação fica prematuro.',
    1
  ),
    'matriz.*risco|riscos?.*mapead|gest[aã]o.*risco',
    'riscos?.*conhecidos|riscos?.*identificados',
    'Sem identificação mínima de riscos, avaliar matriz ou rotina de gestão de riscos fica redundante.',
    1
  ),
    'roadmap|prioriza[cç][aã]o.*produto|backlog',
    'feedback.*cliente|clientes?.*feedback|usu[aá]rios?.*feedback',
    'Sem coleta mínima de feedback de clientes/usuários, avaliar priorização de roadmap por feedback fica prematuro.',
    1
  ),
    'cac|ltv|payback|unit economics',
    'canal.*aquisi[cç][aã]o|aquisi[cç][aã]o.*canal|receita.*cliente',
    'Sem canal/receita minimamente mensurável, avaliar unit economics detalhado fica prematuro.',
    1
  )
where config_json ? 'questions';
