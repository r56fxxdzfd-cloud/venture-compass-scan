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
  pg_temp.add_question_skip_rule(
  pg_temp.add_question_skip_rule(
    config_json,
    'delega|autonomia|centraliza|depend[eê]ncia.*fundador|depend[eê]ncia.*lideran',
    'pap[eé]is.*responsabilidades|responsabilidades.*pap[eé]is|estrutura.*time',
    'Sem papéis e responsabilidades minimamente claros, avaliar delegação/autonomia tende a repetir o mesmo diagnóstico.',
    1
  ),
    'desenvolvimento.*lideran|lideran[cç]as?.*desenvolv|sucess[aã]o|plano.*desenvolvimento',
    'pap[eé]is.*responsabilidades|responsabilidades.*pap[eé]is|estrutura.*time',
    'Sem papéis e responsabilidades minimamente claros, avaliar desenvolvimento de liderança fica prematuro.',
    1
  ),
    'decis(ões|oes).*registr|registro.*decis|hist[oó]rico.*decis',
    'rituais?.*governan|cad[eê]ncia.*governan|reuni(ões|oes).*governan',
    'Sem cadência mínima de governança, avaliar registro formal de decisões fica prematuro.',
    1
  ),
    'mitiga[cç][aã]o.*risco|planos?.*risco|rotina.*risco|revis[aã]o.*risco',
    'riscos?.*conhecidos|riscos?.*identificados|riscos?.*mapead',
    'Sem riscos minimamente identificados, avaliar mitigação ou revisão recorrente fica redundante.',
    1
  ),
    'metas?.*desdobrad|time.*prioridades?|prioridades?.*time|alinhamento.*prioridades',
    'estrat[eé]gia.*clara|prioridades?.*claras',
    'Sem estratégia/prioridades minimamente claras, avaliar desdobramento para o time fica redundante.',
    1
  ),
    'processos?.*documentad|processos?.*padroniz|playbook|sop\\b|rotina.*operacional',
    'processos?.*cr[ií]ticos?.*(identificados|mapeados)|processos?.*mapead|opera[cç][aã]o.*cr[ií]tica',
    'Sem processos críticos minimamente identificados, avaliar documentação ou padronização fica prematuro.',
    1
  ),
    'caixa|runway|burn|capital.*giro|necessidade.*capital',
    'receitas?.*custos?|custos?.*receitas?|financeir.*registr',
    'Sem registros mínimos de receitas e custos, avaliar caixa/runway/burn fica prematuro.',
    1
  ),
    'precifica|pricing|margem|ticket.*m[eé]dio',
    'modelo.*receita|receita.*recorrente|receita.*cliente|proposta.*valor',
    'Sem modelo de receita ou proposta de valor minimamente definidos, avaliar pricing/margem tende a ser prematuro.',
    1
  ),
    'reten[cç][aã]o|churn|nps|csat|satisfa[cç][aã]o',
    'clientes?.*feedback|usu[aá]rios?.*feedback|feedback.*cliente',
    'Sem coleta mínima de feedback de clientes/usuários, avaliar retenção ou satisfação recorrente fica prematuro.',
    1
  ),
    'experimento|hip[oó]teses?.*valid|teste.*mercado|valida[cç][aã]o.*mercado',
    'cliente.*segmento|segmento.*cliente|persona|p[uú]blico.*alvo',
    'Sem segmento/persona minimamente claro, avaliar experimentos de validação fica pouco acionável.',
    1
  )
where config_json ? 'questions';
