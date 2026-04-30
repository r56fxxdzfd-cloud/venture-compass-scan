
-- Deactivate all existing templates (legacy dimensions)
UPDATE public.council_agenda_templates SET is_active = false WHERE is_active = true;

-- Insert one template per official active dimension
INSERT INTO public.council_agenda_templates (dimension_id, dimension_label, title, objective, when_to_use, key_questions, expected_evidence, suggested_actions, associated_red_flags, priority, sort_order, is_active)
VALUES
('IC', 'Identidade & Cultura', 'Clareza de propósito, valores e cultura',
 'Avaliar se propósito, valores e cultura estão claros, vivos e orientando decisões do dia a dia.',
 'Quando há sinais de desalinhamento cultural, alta rotatividade ou decisões inconsistentes com os valores declarados.',
 ARRAY['O propósito da empresa está claro e é compartilhado pelo time?','Os valores são usados em decisões reais (contratação, demissão, priorização)?','Existem rituais que reforçam a cultura?','Como a cultura tem evoluído com o crescimento?'],
 ARRAY['Documento de propósito e valores publicado','Exemplos recentes de decisões guiadas por valores','Resultados de pesquisa de clima/eNPS'],
 ARRAY['Formalizar manifesto de cultura','Implementar ritual mensal de reforço de valores','Rodar pesquisa de clima trimestral'],
 ARRAY[]::text[], 'medium', 10, true),

('PL', 'Pessoas & Liderança', 'Estrutura de liderança e desenvolvimento de pessoas',
 'Avaliar a maturidade da liderança, gaps de time crítico e plano de desenvolvimento de pessoas.',
 'Quando há posições-chave vagas, sobrecarga em founders ou ausência de plano de sucessão.',
 ARRAY['Quais são os gaps críticos de liderança hoje?','Existe plano de desenvolvimento para líderes atuais?','Como está a retenção de talentos-chave?','Founders ainda são gargalo em decisões operacionais?'],
 ARRAY['Org chart atualizado','Plano de contratação dos próximos 6 meses','Métricas de turnover e eNPS'],
 ARRAY['Mapear posições críticas e plano de cobertura','Estabelecer 1:1s estruturados','Definir plano de carreira para líderes-chave'],
 ARRAY[]::text[], 'high', 20, true),

('GR', 'Governança & Riscos', 'Cadência de governança e mapeamento de riscos',
 'Garantir cadência de conselho, transparência com investidores e gestão ativa de riscos críticos.',
 'Quando reuniões de conselho são irregulares, reportes atrasam ou riscos relevantes não estão mapeados.',
 ARRAY['Qual a cadência atual de conselho e reportes?','Quais riscos estratégicos estão mapeados e mitigados?','Há transparência sobre métricas e caixa com investidores?','Existem decisões pendentes de aprovação do board?'],
 ARRAY['Ata da última reunião de conselho','Mapa de riscos atualizado','Reporte mensal a investidores'],
 ARRAY['Estabelecer cadência mensal de board','Criar mapa de riscos com owners','Padronizar reporte mensal a investidores'],
 ARRAY[]::text[], 'high', 30, true),

('EE', 'Estratégia & Execução', 'Foco estratégico e disciplina de execução',
 'Avaliar clareza de estratégia, priorização e disciplina de execução de OKRs/metas.',
 'Quando há dispersão de foco, OKRs desalinhados ou baixa taxa de entrega das prioridades.',
 ARRAY['Qual é a tese estratégica para os próximos 12 meses?','Os OKRs do trimestre estão claros e medidos?','O time consegue dizer o que NÃO está fazendo?','Quais foram as principais entregas e gaps do último ciclo?'],
 ARRAY['Documento de estratégia anual','OKRs do trimestre com status','Retrospectiva do último ciclo'],
 ARRAY['Revisar e formalizar OKRs trimestrais','Implementar ritual semanal de execução','Cortar iniciativas não-prioritárias'],
 ARRAY[]::text[], 'high', 40, true),

('PM', 'Processos & Métricas', 'Processos críticos e métricas de gestão',
 'Avaliar maturidade dos processos críticos e qualidade das métricas usadas para decisão.',
 'Quando decisões são tomadas no achismo, métricas-chave não são acompanhadas ou processos críticos são informais.',
 ARRAY['Quais processos críticos estão mapeados e medidos?','As métricas-chave estão atualizadas e confiáveis?','Existe um dashboard único de gestão?','Decisões recentes foram baseadas em dados ou intuição?'],
 ARRAY['Dashboard executivo atualizado','Mapa de processos críticos','Definição de métricas north star e guard-rails'],
 ARRAY['Implantar dashboard executivo semanal','Mapear e documentar 3 processos críticos','Definir north star metric e revisar mensalmente'],
 ARRAY[]::text[], 'medium', 50, true),

('FS', 'Finanças & Sustentabilidade', 'Runway, disciplina de caixa e sustentabilidade',
 'Avaliar runway, disciplina de caixa, unit economics e caminho para sustentabilidade.',
 'Quando runway está abaixo de 12 meses, burn está acima do plano ou unit economics são negativos.',
 ARRAY['Qual o runway atual e cenários de stress?','Burn rate está dentro do plano? Por quê?','Unit economics são saudáveis (LTV/CAC, payback)?','Qual o plano de funding ou caminho para break-even?'],
 ARRAY['DRE e fluxo de caixa dos últimos 6 meses','Modelo financeiro com cenários','Cohorts de unit economics'],
 ARRAY['Atualizar modelo financeiro com 3 cenários','Definir gatilhos de corte de custo','Iniciar conversas de funding com 9 meses de runway'],
 ARRAY[]::text[], 'high', 60, true),

('MN', 'Modelo de Negócio', 'Validação e evolução do modelo de negócio',
 'Avaliar clareza do modelo de negócio, validação de hipóteses-chave e potencial de escala.',
 'Quando há pivôs recentes, dúvida sobre monetização ou hipóteses críticas ainda não validadas.',
 ARRAY['Quais hipóteses-chave do modelo já foram validadas?','O modelo de monetização está claro e validado?','Existe potencial real de escala (margem, repetibilidade)?','Quais riscos do modelo ainda preocupam?'],
 ARRAY['Business model canvas atualizado','Evidências de validação por hipótese','Análise de margem e escalabilidade'],
 ARRAY['Mapear hipóteses críticas e plano de teste','Rodar experimento de pricing','Validar repetibilidade do modelo em novo segmento'],
 ARRAY[]::text[], 'high', 70, true),

('GT', 'Go-to-market & Tração', 'Canais, CAC e motor de aquisição',
 'Avaliar maturidade dos canais de aquisição, CAC, conversão e previsibilidade de tração.',
 'Quando CAC está crescendo, funil tem gargalos não diagnosticados ou aquisição depende de um único canal.',
 ARRAY['Quais canais hoje trazem aquisição previsível?','Qual o CAC por canal e payback?','Onde estão os gargalos do funil?','Qual o plano para reduzir dependência de um canal único?'],
 ARRAY['Funil de aquisição com taxas de conversão','CAC por canal','Pipeline e previsão dos próximos 90 dias'],
 ARRAY['Diagnosticar e corrigir top-1 gargalo do funil','Testar 1 novo canal de aquisição','Implementar attribution simples por canal'],
 ARRAY[]::text[], 'high', 80, true),

('PT', 'Produto & Tecnologia', 'Roadmap, foco de produto e dívida técnica',
 'Avaliar foco do roadmap, qualidade da entrega de produto e gestão de dívida técnica.',
 'Quando o roadmap está disperso, há queixas recorrentes de qualidade ou dívida técnica trava velocidade.',
 ARRAY['O roadmap está alinhado com a estratégia e priorizado?','Como está a qualidade percebida pelos usuários?','Qual o nível de dívida técnica e plano de redução?','O time de produto/tech consegue entregar com previsibilidade?'],
 ARRAY['Roadmap trimestral priorizado','NPS/CSAT de produto','Mapa de dívida técnica e plano'],
 ARRAY['Repriorizar roadmap com foco em 3 bets','Reservar 20% da capacity para dívida técnica','Implementar discovery contínuo com usuários'],
 ARRAY[]::text[], 'medium', 90, true);
