create temp table pg_temp.question_tooltip_explanations (
  id text primary key,
  explanation text not null
);

insert into pg_temp.question_tooltip_explanations (id, explanation) values
  ('IC01', $explanation$Responda pensando se qualquer pessoa relevante no negócio — fundadores, lideranças e time — conseguiria explicar de forma parecida por que a empresa existe, qual problema resolve e que tipo de impacto busca gerar. Não precisa haver um manifesto formal, mas precisa haver uma direção comum. Se cada pessoa descreve a empresa de um jeito diferente, a clareza ainda é baixa.$explanation$),
  ('IC02', $explanation$Avalie se propósito e valores influenciam decisões reais, especialmente quando há trade-offs difíceis: aceitar ou recusar um cliente, priorizar uma feature, contratar alguém, cortar custos, mudar posicionamento ou escolher um canal de crescimento. Não pontue alto apenas porque os valores estão escritos. Pontue alto se eles efetivamente mudam decisões.$explanation$),
  ('IC03', $explanation$Considere se os valores da empresa são claros, específicos e compreendidos pelo time. Valores genéricos como 'excelência', 'inovação' ou 'foco no cliente' só contam se houver comportamentos concretos associados. A pergunta mede se a cultura foi traduzida em critérios práticos, não se existe uma lista bonita em um slide.$explanation$),
  ('IC04', $explanation$Aqui o foco é coerência. Responda observando se o comportamento diário dos fundadores e líderes confirma os valores declarados. Uma cultura madura não é aquela sem falhas, mas aquela em que desvios relevantes são percebidos, discutidos e corrigidos. Se o discurso é bom, mas a prática cotidiana contradiz, a pontuação deve ser baixa.$explanation$),
  ('IC05', $explanation$Avalie como a empresa lida com erros. Em startups, errar faz parte do processo, mas repetir o mesmo erro sem aprendizado é sinal de baixa maturidade. Pontue alto se há rituais simples para analisar falhas, registrar aprendizados e transformar isso em mudança de processo, produto, venda ou gestão.$explanation$),
  ('PL01', $explanation$Responda pensando se a estrutura atual de pessoas está adequada ao estágio da empresa. Não se trata de ter organograma sofisticado, mas de saber quem é responsável por quê, quem decide, quem executa e onde há sobreposição ou vazio de responsabilidade. Pontue baixo se tudo ainda depende do founder para destravar.$explanation$),
  ('PL02', $explanation$Avalie se a empresa sabe quais competências são críticas para vencer nos próximos 6 a 12 meses. Pode ser vendas enterprise, produto, tecnologia, customer success, financeiro, operações ou liderança. O ponto central é diferenciar o que é essencial agora do que é apenas desejável. Pontue alto se há clareza sobre gaps e plano para cobri-los.$explanation$),
  ('PL03', $explanation$Considere se contratar é um processo minimamente estruturado ou apenas uma reação à urgência. A pergunta mede se existem critérios antes da entrevista, avaliação técnica/cultural e algum padrão de decisão. Pontue baixo se a empresa contrata por indicação, pressa ou feeling, sem clareza do perfil necessário.$explanation$),
  ('PL04', $explanation$Avalie se as pessoas recebem retorno claro sobre desempenho antes que problemas fiquem graves. Feedback maduro não precisa ser burocrático, mas precisa ter frequência, objetividade e consequência. Pontue alto se existem conversas regulares, critérios mínimos de performance e acompanhamento das ações combinadas.$explanation$),
  ('PL05', $explanation$Responda considerando se a informação circula bem dentro da empresa. A pergunta não mede quantidade de reuniões, mas qualidade do alinhamento. Pontue baixo se decisões ficam perdidas em WhatsApp, se áreas trabalham com versões diferentes da verdade ou se o time descobre mudanças tarde demais.$explanation$),
  ('GR01', $explanation$Avalie se a estrutura societária está suficientemente organizada para suportar crescimento, entrada de investidores, saída de sócios ou conflitos. Isso inclui cap table, acordo de sócios, vesting, regras de decisão e eventuais promessas informais de participação. Pontue baixo se há combinados verbais relevantes ou documentos desatualizados.$explanation$),
  ('GR02', $explanation$Considere se está claro quem tem autoridade para tomar quais decisões. Em startups, velocidade importa, mas velocidade sem alçada gera conflito, retrabalho e insegurança. Pontue alto se sócios, executivos e líderes sabem quando decidir sozinhos, quando consultar e quando escalar.$explanation$),
  ('GR03', $explanation$Avalie se decisões importantes deixam rastro mínimo: racional, alternativas consideradas, trade-offs, responsável e próximos passos. Não precisa ser ata formal. Pode ser uma nota curta. Pontue baixo se decisões relevantes vivem apenas na memória dos founders ou em mensagens soltas impossíveis de recuperar.$explanation$),
  ('GR04', $explanation$Responda considerando obrigações básicas que podem virar passivo ou bloquear crescimento: fiscal, trabalhista, contratual, regulatório, societário e proteção de dados, quando aplicável. A pergunta não exige compliance de grande empresa, mas exige consciência e controle dos riscos materiais do estágio.$explanation$),
  ('GR05', $explanation$Avalie se a empresa conhece seus principais riscos e faz algo concreto para reduzi-los. Riscos podem ser caixa, dependência de cliente, dependência de pessoa-chave, tecnologia, regulação, churn, segurança, captação ou entrega. Pontue alto se os maiores riscos têm dono, plano e revisão periódica.$explanation$),
  ('EE01', $explanation$Considere se existe um plano prático para os próximos 6 a 12 meses. Não é um planejamento estratégico corporativo. Pode ser uma página com metas, prioridades, responsáveis e cadência de revisão. Pontue baixo se a empresa opera apenas por urgências da semana ou por ideias soltas dos founders.$explanation$),
  ('EE02', $explanation$Avalie se a empresa acompanha indicadores que mostram avanço real da estratégia. Métricas de vaidade ou apenas volume de atividade não bastam. A pergunta busca saber se os indicadores ajudam a decidir: continuar, parar, corrigir, investir, contratar ou mudar foco.$explanation$),
  ('EE03', $explanation$Responda pensando se o plano é tratado como hipótese em evolução. Startups precisam adaptar, mas adaptação não pode ser caos. Pontue alto se mudanças de direção são feitas com base em aprendizados, dados, feedbacks ou contexto novo, e se o racional dessas mudanças é registrado.$explanation$),
  ('EE04', $explanation$Avalie se a empresa consegue escolher o que não fazer. Uma startup imatura tenta executar tudo ao mesmo tempo. Pontue alto se projetos são comparados por impacto, esforço, risco, urgência e relação com runway, e se existe uma lista clara de prioridades abandonadas ou postergadas.$explanation$),
  ('EE05', $explanation$Considere se a empresa sabe quais poucas coisas precisam dar certo para o plano funcionar. Fatores críticos podem ser validar um canal, reduzir churn, contratar uma liderança, melhorar margem, lançar um produto, captar recursos ou fechar clientes âncora. Pontue baixo se a estratégia depende de muitas apostas vagas.$explanation$),
  ('PM01', $explanation$Avalie se a operação tem rituais e dados mínimos para funcionar sem improviso constante. A pergunta mede maturidade operacional, não complexidade. Pontue alto se há reuniões, dashboards, fontes de dados e rotinas simples que ajudam a tomar decisões melhores e reduzir achismo.$explanation$),
  ('PM02', $explanation$Considere os processos que mais afetam cliente, receita, caixa e entrega. Para cada um, deveria estar claro quem é dono, quais etapas existem e onde ocorrem handoffs. Pontue baixo se tarefas críticas mudam de mão informalmente ou se problemas aparecem porque ninguém era claramente responsável.$explanation$),
  ('PM03', $explanation$Avalie se os KPIs realmente mudam decisões. Ter dashboard não é suficiente. Pontue alto se indicadores geram ações concretas: ajustar canal, mudar pricing, atacar gargalo, revisar produto, cobrar responsável, replanejar meta ou cortar iniciativa.$explanation$),
  ('PM04', $explanation$Responda considerando se existe uma cadência fixa para revisar resultados e acompanhar follow-ups. A pergunta não mede reunião por reunião; mede disciplina de gestão. Pontue alto se há pauta, dados, decisões, responsáveis e checagem do que foi combinado anteriormente.$explanation$),
  ('PM05', $explanation$Avalie se a empresa enxerga onde a operação trava. Gargalos podem estar em vendas, onboarding, suporte, desenvolvimento, entrega, financeiro ou tomada de decisão. Pontue alto se esses gargalos são medidos ou pelo menos identificados com clareza e atacados em ciclos curtos.$explanation$),
  ('FS01', $explanation$Considere se a empresa sabe, com frequência adequada, quanto entra, quanto sai, quanto queima e quanto tempo de caixa resta. Não precisa haver ERP sofisticado, mas precisa haver controle confiável. Pontue baixo se o caixa é conhecido apenas quando surge uma crise.$explanation$),
  ('FS02', $explanation$Avalie se o runway atual permite executar o plano com margem para erro. A resposta deve considerar o estágio da startup, burn mensal, previsibilidade de receita, captação em andamento e plano de contingência. Pontue alto se existem gatilhos claros para cortar gastos, captar, vender mais ou reduzir escopo.$explanation$),
  ('FS03', $explanation$Responda pensando se a empresa sabe quais produtos, planos, canais ou clientes geram margem e quais podem estar destruindo caixa. Mesmo estimativas simples já ajudam. Pontue baixo se a empresa comemora receita sem saber se cada venda contribui positivamente para o resultado.$explanation$),
  ('FS04', $explanation$Avalie se decisões importantes são testadas em cenários financeiros. Exemplo: contratar, aumentar mídia, reduzir preço, lançar produto, captar menos, perder cliente grande ou atrasar receita. Pontue alto se há modelos simples com hipóteses explícitas e gatilhos de ação.$explanation$),
  ('FS05', $explanation$Considere se o preço praticado tem base em custo, margem, valor percebido, concorrência e aprendizado comercial. Em startups, pricing pode ser experimental, mas não deve ser chute permanente. Pontue alto se a empresa testa preços com hipóteses, mede efeito e aprende com perdas e ganhos.$explanation$),
  ('MN01', $explanation$Avalie se a proposta de valor é específica o suficiente para um cliente entender rapidamente por que deveria comprar. A pergunta mede clareza e diferenciação. Pontue baixo se a mensagem poderia ser usada por qualquer concorrente ou se depende de explicações longas para fazer sentido.$explanation$),
  ('MN02', $explanation$Considere se a empresa sabe exatamente para quem vende melhor e para quem não deveria vender agora. ICP não é apenas setor ou tamanho de empresa; inclui dor, urgência, orçamento, maturidade, comportamento de compra e fit com a solução. Pontue alto se isso orienta produto, marketing, vendas e priorização.$explanation$),
  ('MN03', $explanation$Avalie se há uma tese clara de como a empresa captura valor economicamente. Isso inclui modelo de receita, unidade de cobrança, expansão, recorrência, margem e escalabilidade. Pontue baixo se a monetização muda sem critério ou se ainda não há hipótese explícita de como o negócio fica grande e rentável.$explanation$),
  ('MN04', $explanation$Responda considerando se a empresa conhece seus concorrentes reais, inclusive alternativas indiretas como planilhas, consultorias, processos manuais ou soluções internas do cliente. Pontue alto se esse conhecimento influencia posicionamento, roadmap, argumentos comerciais e critérios de diferenciação.$explanation$),
  ('MN05', $explanation$Avalie se os founders entendem o motor econômico do negócio: o que aumenta receita, o que aumenta custo, onde há ganho de escala e onde existe limite estrutural. Pontue baixo se crescimento é tratado como objetivo isolado, sem visão de margem, custo variável, capacidade operacional e canais.$explanation$),
  ('GT01', $explanation$Considere se a empresa tem visibilidade das oportunidades comerciais em andamento. Pipeline não precisa começar em um CRM caro; pode ser planilha. O essencial é saber etapa, valor, probabilidade, responsável, próximos passos e data esperada. Pontue baixo se vendas vivem na cabeça dos founders.$explanation$),
  ('GT02', $explanation$Avalie se a empresa conhece as etapas do funil e suas conversões principais. Isso permite saber se o problema está em gerar leads, qualificar, converter reunião, enviar proposta, fechar, ativar ou reter. Pontue alto se essas taxas são acompanhadas e usadas para decidir onde atacar.$explanation$),
  ('GT03', $explanation$Responda pensando se aquisição de clientes evolui por experimentos disciplinados. A pergunta mede aprendizado comercial. Pontue baixo se a empresa tenta canais aleatoriamente, não registra hipótese, não mede resultado e repete iniciativas sem saber o que funcionou.$explanation$),
  ('GT04', $explanation$Para modelos recorrentes, avalie se a empresa mede retenção e engajamento ao longo do tempo, preferencialmente por coortes. Crescimento novo não compensa produto que vaza. Pontue alto se dados de retenção orientam onboarding, produto, customer success, roadmap e ICP.$explanation$),
  ('GT05', $explanation$Para vendas B2B, considere se existe um modo minimamente repetível de vender: qualificação, diagnóstico, proposta, tratamento de objeções, negociação e forecast. Pontue baixo se cada venda depende de improviso individual ou relacionamento pessoal do founder.$explanation$),
  ('PT01', $explanation$Avalie se o roadmap de produto está conectado ao ICP, à estratégia e a evidências reais. Pedidos isolados de clientes não devem dominar o roadmap sem critério. Pontue alto se prioridades têm justificativa clara baseada em feedback, dados de uso, impacto comercial ou redução de risco.$explanation$),
  ('PT02', $explanation$Considere se há controle visível do fluxo de desenvolvimento ou entrega: o que está planejado, em andamento, bloqueado, concluído e descartado. A pergunta mede previsibilidade e disciplina, não metodologia específica. Pontue baixo se ninguém sabe com clareza o que entra e o que sai da fila.$explanation$),
  ('PT03', $explanation$Avalie se bugs, incidentes, reclamações e estabilidade entram na gestão do produto. Em startup, alguma instabilidade pode ocorrer, mas ignorá-la cria churn, suporte caro e perda de credibilidade. Pontue alto se qualidade tem métrica, responsável e espaço real na priorização.$explanation$),
  ('PT04', $explanation$Responda considerando se a empresa mede o comportamento real dos usuários no produto. Analytics deve mostrar ativação, uso, retenção, funcionalidades relevantes e pontos de abandono. Pontue baixo se decisões de produto dependem apenas de opinião, feedback anedótico ou volume de tickets.$explanation$),
  ('PT05', $explanation$Avalie se segurança, privacidade e controle de dados estão proporcionais ao risco do negócio. Não se espera estrutura corporativa em early stage, mas sim mínimos básicos: controle de acesso, backups, política de dados, cuidado com LGPD e proteção contra riscos que travem cliente ou rodada.$explanation$);

create or replace function pg_temp.add_question_tooltip_explanations(config jsonb)
returns jsonb
language plpgsql
as $$
declare
  updated_questions jsonb;
begin
  select jsonb_agg(
    case
      when explanation.explanation is not null then jsonb_set(
        question,
        '{tooltip}',
        coalesce(question -> 'tooltip', '{}'::jsonb) || jsonb_build_object('explanation', explanation.explanation),
        true
      )
      else question
    end
    order by ordinality
  )
  into updated_questions
  from jsonb_array_elements(coalesce(config -> 'questions', '[]'::jsonb)) with ordinality as item(question, ordinality)
  left join pg_temp.question_tooltip_explanations explanation
    on explanation.id = question ->> 'id';

  return jsonb_set(config, '{questions}', coalesce(updated_questions, '[]'::jsonb), true);
end;
$$;

update public.config_versions
set config_json = pg_temp.add_question_tooltip_explanations(config_json)
where config_json ? 'questions';

update public.questions question
set tooltip = coalesce(question.tooltip, '{}'::jsonb) || jsonb_build_object('explanation', explanation.explanation)
from pg_temp.question_tooltip_explanations explanation
where question.id = explanation.id;
