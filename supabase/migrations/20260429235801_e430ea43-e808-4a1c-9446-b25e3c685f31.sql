-- Tabela de templates de pauta
CREATE TABLE IF NOT EXISTS public.council_agenda_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_id TEXT NOT NULL,
  dimension_label TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  when_to_use TEXT,
  key_questions TEXT[] NOT NULL DEFAULT '{}',
  expected_evidence TEXT[] NOT NULL DEFAULT '{}',
  suggested_actions TEXT[] NOT NULL DEFAULT '{}',
  associated_red_flags TEXT[] NOT NULL DEFAULT '{}',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT council_agenda_templates_dim_title_unique UNIQUE (dimension_id, title)
);

ALTER TABLE public.council_agenda_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "JV read council_agenda_templates"
  ON public.council_agenda_templates FOR SELECT
  USING (is_jv_member(auth.uid()));

CREATE POLICY "Admin/analyst write council_agenda_templates"
  ON public.council_agenda_templates FOR INSERT
  WITH CHECK (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst update council_agenda_templates"
  ON public.council_agenda_templates FOR UPDATE
  USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

CREATE POLICY "Admin/analyst delete council_agenda_templates"
  ON public.council_agenda_templates FOR DELETE
  USING (is_admin_or_analyst(auth.uid()) AND is_approved_member(auth.uid()));

CREATE TRIGGER trg_council_agenda_templates_updated_at
  BEFORE UPDATE ON public.council_agenda_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed inicial de 9 templates (1 por dimensão)
INSERT INTO public.council_agenda_templates
  (dimension_id, dimension_label, title, objective, when_to_use, key_questions, expected_evidence, suggested_actions, priority, sort_order)
VALUES
  ('problem_solution', 'Problema e Solução', 'Validação de Problem-Solution Fit',
   'Confirmar que o problema é real, frequente e doloroso para o segmento-alvo.',
   'Quando há dúvida sobre o encaixe entre dor e solução proposta.',
   ARRAY['Quem sente esse problema com mais intensidade?','Com que frequência ele ocorre?','O que os clientes fazem hoje na ausência da sua solução?'],
   ARRAY['Entrevistas qualitativas recentes','Relatos diretos de clientes','Métrica de uso recorrente'],
   ARRAY['Rodar 10 entrevistas com early adopters','Mapear jornada atual sem a solução'],
   'high', 10),

  ('market', 'Mercado', 'Tamanho e segmentação do mercado',
   'Avaliar TAM/SAM/SOM e nicho prioritário.',
   'Quando o ICP ainda está difuso ou o mercado parece amplo demais.',
   ARRAY['Qual é o ICP mais lucrativo hoje?','Que segmentos foram descartados e por quê?','Como o mercado está se movendo?'],
   ARRAY['Estudo de TAM/SAM/SOM','Definição clara de ICP','Análise de concorrência'],
   ARRAY['Refinar ICP em uma página','Mapear 3 concorrentes diretos'],
   'medium', 20),

  ('product', 'Produto', 'Roadmap e foco de produto',
   'Garantir que o roadmap está conectado a hipóteses validadas e métricas de negócio.',
   'Quando há excesso de funcionalidades ou falta de foco.',
   ARRAY['Quais features movem a métrica principal?','O que pode ser cortado sem perda de valor?','Qual é a próxima hipótese a testar?'],
   ARRAY['Roadmap trimestral','Métricas de adoção por feature','Backlog priorizado'],
   ARRAY['Definir métrica north star','Cortar features de baixo uso'],
   'high', 30),

  ('gtm', 'Go-to-Market', 'Canais de aquisição e CAC',
   'Validar canais escaláveis e custo de aquisição sustentável.',
   'Quando o crescimento está dependente de um único canal ou CAC subindo.',
   ARRAY['Quais canais têm melhor CAC/LTV?','Quais canais foram testados e descartados?','Qual o ciclo de vendas médio?'],
   ARRAY['Funil por canal','CAC e payback por canal','Pipeline atualizado'],
   ARRAY['Testar 2 novos canais com budget controlado','Documentar playbook de vendas'],
   'high', 40),

  ('financials', 'Financeiro', 'Runway e disciplina de caixa',
   'Avaliar runway, burn e plano de capitalização.',
   'Sempre que runway < 9 meses ou burn descontrolado.',
   ARRAY['Qual é o runway atual?','Qual o burn mensal e tendência?','Quais cortes são possíveis sem matar o crescimento?'],
   ARRAY['DRE atualizada','Projeção de caixa 12m','Plano de captação'],
   ARRAY['Rodar exercício de cenários (base, otimista, sobrevivência)','Definir gatilhos de corte'],
   'high', 50),

  ('team', 'Time', 'Estrutura de time e gaps críticos',
   'Identificar lacunas de liderança e plano de contratação.',
   'Quando há sobrecarga em founders ou turnover acima do esperado.',
   ARRAY['Quais papéis estão sobrecarregando os founders?','Onde está o maior gap de senioridade?','Qual a próxima contratação prioritária?'],
   ARRAY['Organograma atual','Plano de contratação 6m','Avaliações de performance'],
   ARRAY['Mapear top 3 contratações críticas','Definir plano de delegação'],
   'medium', 60),

  ('operations', 'Operações', 'Processos e escalabilidade operacional',
   'Verificar se processos suportam o crescimento planejado.',
   'Quando há gargalos operacionais ou erros recorrentes.',
   ARRAY['Quais processos quebram com 2x do volume atual?','O que ainda é manual e deveria ser automatizado?','Quais SLAs estão sendo violados?'],
   ARRAY['Mapa de processos críticos','Indicadores operacionais','Backlog de automação'],
   ARRAY['Automatizar top 2 processos manuais','Definir donos por processo'],
   'medium', 70),

  ('governance', 'Governança', 'Cadência e transparência de governança',
   'Garantir rituais de gestão e reporting consistentes.',
   'Quando não há cadência clara de board ou reportes.',
   ARRAY['Existe cadência mensal/trimestral de board?','Os KPIs reportados são consistentes?','Quais decisões precisam do conselho?'],
   ARRAY['Calendário de governança','Deck de board padronizado','Atas anteriores'],
   ARRAY['Padronizar deck mensal','Definir rituais de board trimestral'],
   'medium', 80),

  ('founder', 'Founder', 'Saúde e foco do founder',
   'Avaliar carga, foco e desenvolvimento dos founders.',
   'Quando há sinais de exaustão, dispersão ou conflito societário.',
   ARRAY['Onde o founder está gastando mais tempo hoje?','O que poderia ser delegado nos próximos 30 dias?','Como está o alinhamento entre sócios?'],
   ARRAY['Agenda semanal do founder','Plano de desenvolvimento pessoal','Acordo de sócios atualizado'],
   ARRAY['Definir top 3 prioridades pessoais do trimestre','Agendar 1:1 estruturado entre sócios'],
   'high', 90)
ON CONFLICT (dimension_id, title) DO NOTHING;