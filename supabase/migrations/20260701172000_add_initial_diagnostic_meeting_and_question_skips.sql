do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.council_meetings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%meeting_type%'
      and pg_get_constraintdef(oid) ilike '%collective%'
      and pg_get_constraintdef(oid) ilike '%individual%'
      and pg_get_constraintdef(oid) ilike '%extraordinary%'
  loop
    execute format('alter table public.council_meetings drop constraint %I', constraint_name);
  end loop;

  alter table public.council_meetings
    add constraint council_meetings_meeting_type_check
    check (meeting_type in ('diagnostic_initial', 'collective', 'individual', 'extraordinary'));
end $$;

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
set config_json = pg_temp.add_question_skip_rule(
  pg_temp.add_question_skip_rule(
    pg_temp.add_question_skip_rule(
      config_json,
      'prop[oó]sito.*valores.*decis',
      'clareza.*(miss[aã]o|prop[oó]sito)',
      'Sem clareza mínima de missão/propósito, o uso de propósito e valores como critério decisório fica redundante.',
      1
    ),
    'valores.*vivenciados|coer[eê]ncia.*discurso.*pr[aá]tica',
    'valores.*definidos.*comunicados',
    'Sem valores minimamente definidos e comunicados, avaliar vivência cotidiana dos valores fica prematuro.',
    1
  ),
  'valores.*crit[eé]rio.*decis',
  'valores.*definidos.*comunicados',
  'Sem valores minimamente definidos e comunicados, seu uso como critério decisório fica redundante.',
  1
)
where config_json ? 'questions';
