create table if not exists public.council_agenda_templates (
  id uuid primary key default gen_random_uuid(),
  dimension_id text not null,
  dimension_label text not null,
  title text not null,
  objective text not null,
  key_questions text[] not null default '{}',
  expected_evidence text[] not null default '{}',
  suggested_actions text[] not null default '{}',
  associated_red_flags text[] not null default '{}',
  when_to_use text null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.council_agenda_templates enable row level security;

create policy if not exists "JV members can read council agenda templates"
on public.council_agenda_templates
for select
using (is_jv_member(auth.uid()));

create policy if not exists "Admins and analysts can insert council agenda templates"
on public.council_agenda_templates
for insert
with check (is_admin_or_analyst(auth.uid()) and is_approved_member(auth.uid()));

create policy if not exists "Admins and analysts can update council agenda templates"
on public.council_agenda_templates
for update
using (is_admin_or_analyst(auth.uid()) and is_approved_member(auth.uid()))
with check (is_admin_or_analyst(auth.uid()) and is_approved_member(auth.uid()));

create policy if not exists "Admins and analysts can delete council agenda templates"
on public.council_agenda_templates
for delete
using (is_admin_or_analyst(auth.uid()) and is_approved_member(auth.uid()));

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    execute $fn$
      create function public.set_updated_at()
      returns trigger
      language plpgsql
      security invoker
      set search_path = public, pg_temp
      as $$
      begin
        new.updated_at = now();
        return new;
      end;
      $$;
    $fn$;
  end if;
end
$$;

drop trigger if exists trg_council_agenda_templates_updated_at on public.council_agenda_templates;
create trigger trg_council_agenda_templates_updated_at
before update on public.council_agenda_templates
for each row execute function public.set_updated_at();

insert into public.council_agenda_templates (
  dimension_id, dimension_label, title, objective, key_questions, expected_evidence, suggested_actions, when_to_use, priority, sort_order
)
values
('identidade-cultura', 'Identidade & Cultura', 'Clareza de propósito e coerência cultural', 'avaliar se propósito, valores e cultura estão claros e sendo usados nas decisões.',
  array[
    'A liderança consegue explicar com clareza por que a organização existe?',
    'Os valores aparecem em decisões reais ou são apenas discurso?',
    'Que comportamentos são tolerados hoje e prejudicam a cultura?',
    'Onde há incoerência entre intenção e prática?'
  ],
  array['Missão/visão/valores documentados', 'Exemplos de decisões alinhadas aos valores', 'Rituais de cultura ou comunicação interna'],
  array['Revisar narrativa institucional', 'Definir valores comportamentais observáveis', 'Criar ritual de alinhamento mensal'],
  'Quando houver desalinhamento cultural percebido ou baixa clareza de propósito em decisões recentes.', 'high', 10),

('pessoas-lideranca', 'Pessoas & Liderança', 'Centralização, papéis e desenvolvimento da liderança', 'identificar gargalos de liderança, dependência da fundadora/liderança principal e clareza de papéis.',
  array[
    'O que ainda depende excessivamente da liderança principal?',
    'Quais decisões poderiam ser delegadas?',
    'As pessoas sabem claramente seus papéis e responsabilidades?',
    'Há sucessores ou backups para funções críticas?'
  ],
  array['Organograma', 'Papéis e responsabilidades', 'Rotina de feedback', 'Plano de desenvolvimento de lideranças'],
  array['Mapear decisões centralizadas', 'Criar matriz de responsabilidades', 'Definir backups para funções críticas'],
  'Útil quando o time reporta gargalos por centralização ou baixa autonomia.', 'high', 20),

('governanca-riscos', 'Governança & Riscos', 'Ritos, decisões e riscos críticos', 'avaliar se a organização possui governança mínima, registros decisórios e gestão de riscos.',
  array[
    'Quais decisões importantes foram tomadas recentemente e onde estão registradas?',
    'Quais são os 3 principais riscos da organização nos próximos 6 meses?',
    'Existem alçadas claras de decisão?',
    'Há prestação de contas periódica para conselho, diretoria ou parceiros?'
  ],
  array['Atas', 'Matriz de riscos', 'Políticas internas', 'Relatórios de prestação de contas'],
  array['Criar registro simples de decisões', 'Mapear riscos críticos', 'Definir rito mensal de governança'],
  'Aplicar quando houver decisões críticas sem registro ou baixa previsibilidade de riscos.', 'high', 30),

('estrategia-execucao', 'Estratégia & Execução', 'Foco estratégico e execução dos combinados', 'verificar se há clareza de prioridades e capacidade de execução.',
  array['Quais são as 3 prioridades estratégicas atuais?', 'O que foi combinado no último encontro e o que foi executado?', 'O que deve parar de ser feito?', 'Que trade-offs precisam ser decididos?'],
  array['Plano estratégico', 'OKRs ou metas', 'Lista de ações anteriores', 'Indicadores de progresso'],
  array['Definir top 3 prioridades do ciclo', 'Criar kill list de iniciativas', 'Estabelecer responsáveis e prazos'],
  'Recomendado em ciclos com dispersão de foco e baixo cumprimento de combinados.', 'high', 40),

('processos-metricas', 'Processos & Métricas', 'Processos críticos, indicadores e rotina de gestão', 'avaliar previsibilidade operacional e uso de dados.',
  array['Quais processos mais travam a organização?', 'Quais indicadores são acompanhados mensalmente?', 'Há retrabalho recorrente?', 'Que dados faltam para tomar boas decisões?'],
  array['Dashboard ou planilhas de controle', 'Mapa de processos', 'Indicadores operacionais', 'Rotina de reuniões de gestão'],
  array['Mapear processos críticos', 'Definir 5 indicadores essenciais', 'Criar rotina mensal de acompanhamento'],
  'Priorize quando houver retrabalho recorrente e baixa visibilidade de indicadores.', 'medium', 50),

('financas-sustentabilidade', 'Finanças & Sustentabilidade', 'Caixa, DRE e sustentabilidade financeira', 'avaliar clareza financeira, previsibilidade e dependência de fontes de receita.',
  array['Qual é a posição atual de caixa?', 'Existe DRE gerencial atualizada?', 'Quais receitas são recorrentes e quais são pontuais?', 'Qual é a maior vulnerabilidade financeira hoje?'],
  array['DRE', 'Fluxo de caixa', 'Orçamento', 'Pipeline de captação'],
  array['Implantar DRE mensal', 'Criar forecast de caixa', 'Mapear fontes recorrentes de receita'],
  'Usar em momentos de tensão de caixa ou transição de modelo de receita.', 'high', 60),

('modelo-negocio-impacto', 'Modelo de Negócio / Sustentabilidade de Impacto', 'Proposta de valor e modelo de sustentabilidade', 'entender como a organização gera, comunica e sustenta valor.',
  array['Qual é a proposta de valor da organização para beneficiários, parceiros e financiadores?', 'O modelo atual é sustentável ou depende de esforço pontual?', 'Quais atividades geram maior impacto com menor custo?', 'Que públicos precisam ser melhor atendidos ou priorizados?'],
  array['Teoria de mudança', 'Modelo de sustentabilidade', 'Mapa de stakeholders', 'Dados de impacto'],
  array['Revisar proposta de valor', 'Mapear fontes de sustentabilidade', 'Priorizar iniciativas por impacto e viabilidade'],
  'Aplicar quando houver dúvida sobre fit entre impacto gerado e sustentabilidade do modelo.', 'medium', 70),

('captacao-parcerias-tracao', 'Captação, Parcerias & Tração', 'Pipeline de captação e relacionamento com parceiros', 'avaliar previsibilidade de captação, relacionamento institucional e conversão de oportunidades.',
  array['Existe pipeline de captação ativo?', 'Quantas oportunidades estão em andamento?', 'Qual é a taxa de conversão aproximada?', 'Quais parceiros atuais têm potencial de expansão?'],
  array['CRM ou planilha de captação', 'Lista de parceiros', 'Propostas enviadas', 'Histórico de conversão'],
  array['Criar pipeline de captação', 'Classificar parceiros por potencial', 'Definir meta mensal de novas conversas'],
  'Quando a organização depende de captação contínua e quer aumentar previsibilidade comercial/institucional.', 'medium', 80),

('impacto-produto-tecnologia', 'Impacto, Produto/Serviço & Tecnologia', 'Evidência de impacto e uso de tecnologia', 'avaliar clareza de impacto, qualidade da entrega e uso de tecnologia para escala/eficiência.',
  array['Como a organização mede impacto hoje?', 'Quais evidências mostram que a intervenção funciona?', 'Onde tecnologia poderia reduzir custo ou aumentar escala?', 'A qualidade da entrega é acompanhada?'],
  array['Indicadores de impacto', 'Pesquisas com beneficiários', 'Relatórios de atividades', 'Ferramentas/sistemas usados'],
  array['Definir indicadores de impacto essenciais', 'Criar rotina de coleta de evidências', 'Mapear automações simples'],
  'Recomendado para consolidar evidências de efetividade e ganhos operacionais por tecnologia.', 'medium', 90)
on conflict do nothing;
