-- Atualiza copy visível de "conselho/conselheiro" para "comitê de crescimento",
-- preservando nomes técnicos existentes como tabelas council_* e campo counselor_comment.

create or replace function pg_temp.growth_committee_copy(input text)
returns text
language sql
immutable
returns null on null input
as $$
  select
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(input,
      'Conselhos Coletivos', 'Comitês de Crescimento coletivos'),
      'conselhos coletivos', 'comitês de crescimento coletivos'),
      'Conselho Coletivo', 'Comitê de Crescimento Coletivo'),
      'conselho coletivo', 'comitê de crescimento coletivo'),
      'Central do Conselheiro', 'Central do Comitê de Crescimento'),
      'Conselheiros', 'Membros do Comitê de Crescimento'),
      'conselheiros', 'membros do comitê de crescimento'),
      'Conselheiro', 'Membro do Comitê de Crescimento'),
      'conselheiro', 'membro do comitê de crescimento'),
      'Conselho OS', 'Comitê de Crescimento OS'),
      'Conselho', 'Comitê de Crescimento'),
      'conselho', 'comitê de crescimento'),
      ' de comitê de crescimento', ' do comitê de crescimento');
$$;

create or replace function pg_temp.growth_committee_copy_array(input text[])
returns text[]
language sql
immutable
as $$
  select case
    when input is null then null
    else array(select pg_temp.growth_committee_copy(item) from unnest(input) as item)
  end;
$$;

update public.council_agenda_templates
set
  title = pg_temp.growth_committee_copy(title),
  objective = pg_temp.growth_committee_copy(objective),
  when_to_use = pg_temp.growth_committee_copy(when_to_use),
  key_questions = pg_temp.growth_committee_copy_array(key_questions),
  expected_evidence = pg_temp.growth_committee_copy_array(expected_evidence),
  suggested_actions = pg_temp.growth_committee_copy_array(suggested_actions)
where
  title ~* 'conselh'
  or objective ~* 'conselh'
  or when_to_use ~* 'conselh'
  or exists (select 1 from unnest(key_questions) as item(value) where value ~* 'conselh')
  or exists (select 1 from unnest(expected_evidence) as item(value) where value ~* 'conselh')
  or exists (select 1 from unnest(suggested_actions) as item(value) where value ~* 'conselh');

update public.council_dimension_progress
set
  evidence = pg_temp.growth_committee_copy(evidence),
  interpretation = pg_temp.growth_committee_copy(interpretation),
  counselor_comment = pg_temp.growth_committee_copy(counselor_comment)
where
  evidence ~* 'conselh'
  or interpretation ~* 'conselh'
  or counselor_comment ~* 'conselh';
