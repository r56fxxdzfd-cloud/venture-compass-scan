import type { ConfigJSON, AssessmentResult, EvaluatedRedFlag, DimensionScore, ConfigParetoAction, Answer } from '@/types/darwin';
import { computeGaps, scoreTo100, DEFAULT_BLOCKS, type PrioritizedGap } from '@/utils/report-helpers';

// ---- Action types (extend from config type) ----
export type ParetoAction = ConfigParetoAction;

export interface ScoredAction extends ParetoAction {
  pareto_score: number;
  reason: string;
  impacted_dimensions: string[];
}

// ---- Default action library — 2+ actions per dimension, 18+ total ----
export const DEFAULT_ACTION_LIBRARY: Record<string, ParetoAction[]> = {
  MN: [
    { id: 'MN-01', title: 'Validar unit economics com dados reais', description: 'Calcular CAC, LTV e payback com métricas atuais de cada canal.', first_step: 'Levantar CAC dos últimos 3 meses por canal de aquisição.', done_definition: 'Planilha com unit economics por cohort mensal publicada.', effort: 'S', time_to_impact_days: 7, impact_weight: 5, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'MN', kpi_hint: 'LTV/CAC ratio' },
    { id: 'MN-02', title: 'Testar novo canal de aquisição', description: 'Experimentar canal não explorado para diversificar fontes de receita.', first_step: 'Selecionar 1 canal e definir budget de teste de R$500-2000.', done_definition: 'Teste de 2 semanas com CAC medido e comparado aos canais atuais.', effort: 'M', time_to_impact_days: 21, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'MN' },
    { id: 'MN-03', title: 'Documentar pricing strategy', description: 'Formalizar lógica de precificação, margens e posicionamento competitivo.', first_step: 'Mapear preços atuais vs 3 concorrentes diretos.', done_definition: 'Documento de pricing aprovado pelo founding team.', effort: 'S', time_to_impact_days: 5, impact_weight: 3, stage_tags: ['pre_seed', 'seed'], business_model_tags: [], dimension_id: 'MN' },
  ],
  GT: [
    { id: 'GT-01', title: 'Definir North Star Metric', description: 'Alinhar time em torno de métrica principal de crescimento.', first_step: 'Reunião de 1h com founders para alinhar métrica candidata.', done_definition: 'NSM definida, documentada e visível em dashboard compartilhado.', effort: 'S', time_to_impact_days: 3, impact_weight: 5, stage_tags: ['pre_seed', 'seed', 'series_a'], business_model_tags: [], dimension_id: 'GT' },
    { id: 'GT-02', title: 'Implementar growth loop principal', description: 'Criar ciclo viral, de conteúdo ou de retenção que gere crescimento composto.', first_step: 'Mapear loops existentes e identificar o de maior potencial.', done_definition: 'Loop implementado com métrica de ciclo medida por 2 semanas.', effort: 'L', time_to_impact_days: 45, impact_weight: 5, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'GT' },
    { id: 'GT-03', title: 'Criar dashboard de métricas semanais', description: 'Dar visibilidade contínua sobre KPIs de crescimento para o time.', first_step: 'Listar top 5 métricas e identificar fonte de dados para cada.', done_definition: 'Dashboard automático atualizado e revisado na weekly.', effort: 'M', time_to_impact_days: 14, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'GT' },
  ],
  EE: [
    { id: 'EE-01', title: 'Mapear jornada do cliente end-to-end', description: 'Identificar pontos de fricção e oportunidades de encantamento.', first_step: 'Entrevistar 5 clientes sobre sua experiência completa.', done_definition: 'Mapa de jornada com pain points priorizados e quick fixes identificados.', effort: 'M', time_to_impact_days: 14, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'EE' },
    { id: 'EE-02', title: 'Implementar NPS ou CSAT recorrente', description: 'Medir satisfação de forma contínua para detectar tendências.', first_step: 'Escolher ferramenta (Typeform, Hotjar) e criar survey de 3 perguntas.', done_definition: 'Primeira rodada de NPS coletada com 30+ respostas.', effort: 'S', time_to_impact_days: 7, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'EE' },
  ],
  FS: [
    { id: 'FS-01', title: 'Projetar runway com cenários', description: 'Modelar cenários otimista, base e pessimista para os próximos 12 meses.', first_step: 'Atualizar planilha financeira com receitas e custos reais do último trimestre.', done_definition: 'Projeção de 12 meses com 3 cenários e breakeven estimado.', effort: 'S', time_to_impact_days: 5, impact_weight: 5, stage_tags: ['pre_seed', 'seed', 'series_a'], business_model_tags: [], dimension_id: 'FS', kpi_hint: 'Runway em meses', addresses_red_flags: ['RF_RUNWAY'] },
    { id: 'FS-02', title: 'Reduzir burn rate em 15%', description: 'Identificar gastos cortáveis sem impacto negativo no crescimento.', first_step: 'Categorizar todas as despesas por grau de essencialidade (1-3).', done_definition: 'Burn reduzido em pelo menos 15% e validado por 1 mês completo.', effort: 'M', time_to_impact_days: 30, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'FS', addresses_red_flags: ['RF_RUNWAY', 'RF_BURN'] },
  ],
  PM: [
    { id: 'PM-01', title: 'Validar product-market fit com dados', description: 'Aplicar Sean Ellis test ou análise de retenção por cohort.', first_step: 'Enviar survey "How disappointed would you be?" para 40+ users ativos.', done_definition: 'Score PMF calculado e apresentado ao time com plano de ação.', effort: 'S', time_to_impact_days: 10, impact_weight: 5, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'PM' },
    { id: 'PM-02', title: 'Criar roadmap baseado em feedback', description: 'Priorizar features usando framework ICE ou RICE com dados de clientes.', first_step: 'Compilar top 10 pedidos/reclamações de clientes dos últimos 60 dias.', done_definition: 'Roadmap de 3 meses priorizado e comunicado ao time.', effort: 'M', time_to_impact_days: 14, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'PM' },
  ],
  GR: [
    { id: 'GR-01', title: 'Formalizar governança mínima', description: 'Board advisory, cap table limpo e acordos de sócios atualizados.', first_step: 'Revisar cap table atual e identificar pendências jurídicas.', done_definition: 'Documentação de governança revisada e assinada por todos os sócios.', effort: 'M', time_to_impact_days: 21, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'GR' },
    { id: 'GR-02', title: 'Implementar report mensal para stakeholders', description: 'Criar cadência de transparência com investidores e advisors.', first_step: 'Criar template de investor update com KPIs, highlights e asks.', done_definition: 'Primeiro report mensal enviado a todos os stakeholders.', effort: 'S', time_to_impact_days: 7, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'GR' },
  ],
  PT: [
    { id: 'PT-01', title: 'Adotar metodologia ágil simplificada', description: 'Implementar sprints de 2 semanas com planning, daily e retro.', first_step: 'Definir cadência (bi-semanal), ferramenta (Linear, Jira) e facilitador.', done_definition: 'Primeira sprint completa com retrospectiva documentada.', effort: 'M', time_to_impact_days: 14, impact_weight: 4, stage_tags: ['pre_seed', 'seed'], business_model_tags: [], dimension_id: 'PT' },
    { id: 'PT-02', title: 'Definir OKRs trimestrais', description: 'Alinhar time com objetivos mensuráveis e key results claros.', first_step: 'Workshop de 2h com founders para definir 3 objectives e 9 KRs.', done_definition: 'OKRs do próximo trimestre definidos, publicados e comunicados.', effort: 'S', time_to_impact_days: 5, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'PT' },
  ],
  PL: [
    { id: 'PL-01', title: 'Criar plano de hiring para 6 meses', description: 'Priorizar contratações críticas alinhadas ao roadmap de produto.', first_step: 'Mapear gaps de competência vs roadmap e listar posições prioritárias.', done_definition: 'Plano de hiring aprovado com timeline e perfis documentados.', effort: 'S', time_to_impact_days: 7, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'PL' },
    { id: 'PL-02', title: 'Implementar 1:1s semanais', description: 'Melhorar feedback loop e retenção do time com cadência individual.', first_step: 'Agendar 1:1s recorrentes de 30min com cada report direto.', done_definition: 'Cadência de 1:1s mantida por 4 semanas consecutivas.', effort: 'S', time_to_impact_days: 3, impact_weight: 3, stage_tags: ['pre_seed', 'seed', 'series_a'], business_model_tags: [], dimension_id: 'PL' },
  ],
  IC: [
    { id: 'IC-01', title: 'Documentar cultura e valores', description: 'Formalizar princípios do time para guiar decisões e contratações.', first_step: 'Workshop de 2h com founders para extrair e priorizar valores.', done_definition: 'Documento de cultura publicado e compartilhado com todo o time.', effort: 'S', time_to_impact_days: 7, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'IC' },
    { id: 'IC-02', title: 'Criar onboarding estruturado', description: 'Reduzir time-to-productivity de novos membros com processo claro.', first_step: 'Documentar processos-chave e criar checklist de primeira semana.', done_definition: 'Próximo hire completou onboarding novo com feedback positivo.', effort: 'M', time_to_impact_days: 21, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'IC' },
  ],
};

// ---- Get action library (from config or defaults) ----
function getActionLibrary(config: ConfigJSON): Record<string, ParetoAction[]> {
  if (config.action_library && Object.keys(config.action_library).length > 0) {
    // Check it's not an empty object with empty arrays
    const hasActions = Object.values(config.action_library).some(arr => arr.length > 0);
    if (hasActions) return config.action_library;
  }
  console.warn('[QuickWins] action_library not found in config, using DEFAULT_ACTION_LIBRARY fallback');
  return DEFAULT_ACTION_LIBRARY;
}

// ---- Helpers to extract numeric value from config entries ----
function toNumericTarget(v: unknown, fallback: number): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null) {
    const obj = v as Record<string, unknown>;
    if (typeof obj.benchmark === 'number') return obj.benchmark;
    if (typeof obj.target === 'number') return obj.target;
  }
  return fallback;
}

function toNumericWeight(v: unknown, fallback: number): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null) {
    const obj = v as Record<string, unknown>;
    if (typeof obj.weight === 'number') return obj.weight;
  }
  return fallback;
}

// ---- Compute Pareto scores (Step 5 formula) ----
const EFFORT_FACTOR: Record<string, number> = { S: 1, M: 2, L: 3 };

export function computeParetoActions(
  config: ConfigJSON,
  result: AssessmentResult,
  stage: string
): ScoredAction[] {
  const library = getActionLibrary(config);
  const weights = config.weights_by_stage?.[stage] || {};
  const targets = config.targets_by_stage?.[stage] || {};
  const dimScoreMap = new Map(result.dimension_scores.map(d => [d.dimension_id, d]));
  const triggeredRfIds = new Set(result.red_flags.map(rf => rf.code));
  const triggeredHighRf = new Set(
    result.red_flags.filter(rf => ['high', 'critical'].includes(rf.severity)).map(rf => rf.code)
  );

  const allActions: ScoredAction[] = [];

  for (const [dimId, actions] of Object.entries(library)) {
    const ds = dimScoreMap.get(dimId);
    const dimLabel = ds?.label || dimId;
    const dimensionWeight = toNumericWeight(weights[dimId], 0.1);
    const targetScore = toNumericTarget(targets[dimId], 3);
    const currentScore = ds?.score ?? 1;
    const gapPotential = Math.max(0, targetScore - currentScore);
    const priorityScoreDim = gapPotential * dimensionWeight;

    for (const action of actions) {
      const effortFactor = EFFORT_FACTOR[action.effort] || 2;
      const redFlagBoost = action.addresses_red_flags?.some(rfId => triggeredRfIds.has(rfId)) ? 1.5 : 1;
      const paretoScore = ((action.impact_weight / 5) * priorityScoreDim / effortFactor) * redFlagBoost;

      const reasons: string[] = [];
      if (gapPotential > 0) reasons.push(`Gap ${gapPotential.toFixed(1)}pts em ${dimLabel}`);
      if (redFlagBoost > 1) reasons.push('Endereça red flag ativo');
      if (action.effort === 'S') reasons.push('Baixo esforço');

      allActions.push({
        ...action,
        pareto_score: Math.round(paretoScore * 100) / 100,
        reason: reasons.join(' · ') || 'Impacto geral',
        impacted_dimensions: [dimLabel],
      });
    }
  }

  // Sort by pareto_score desc
  allActions.sort((a, b) => b.pareto_score - a.pareto_score);
  return allActions;
}

// ---- Select Top 5 with diversity rule (Step 6) ----
export function selectTop5(
  scored: ScoredAction[],
  result: AssessmentResult,
  config: ConfigJSON
): ScoredAction[] {
  const blocks = DEFAULT_BLOCKS;
  const blockMap = new Map<string, string>(); // dimId -> blockId
  blocks.forEach(b => b.dimensions.forEach(d => blockMap.set(d, b.id)));

  const triggeredHighRf = result.red_flags
    .filter(rf => ['high', 'critical'].includes(rf.severity))
    .map(rf => rf.code);

  // Step 6: Diversity rule
  const blockCounts: Record<string, number> = {};
  blocks.forEach(b => blockCounts[b.id] = 0);

  const top5: ScoredAction[] = [];
  const remaining: ScoredAction[] = [];
  const used = new Set<string>();

  // First pass: guarantee 1 per block
  for (const action of scored) {
    const block = blockMap.get(action.dimension_id) || 'other';
    if (blockCounts[block] === 0 && top5.length < 5 && !used.has(action.id)) {
      top5.push(action);
      used.add(action.id);
      blockCounts[block] = (blockCounts[block] || 0) + 1;
    } else if (!used.has(action.id)) {
      remaining.push(action);
    }
  }

  // Second pass: fill remaining slots by score
  for (const action of remaining) {
    if (top5.length >= 5) break;
    if (!used.has(action.id)) {
      top5.push(action);
      used.add(action.id);
    }
  }

  // Sort top5 by score
  top5.sort((a, b) => b.pareto_score - a.pareto_score);

  // High severity red flag enforcement: ensure at least 1 action addressing it in positions 1-3
  if (triggeredHighRf.length > 0) {
    const hasRfInTop3 = top5.slice(0, 3).some(a =>
      a.addresses_red_flags?.some(c => triggeredHighRf.includes(c))
    );

    if (!hasRfInTop3) {
      // Find an action addressing it (in top5 or remaining)
      const rfAction = top5.slice(3).find(a =>
        a.addresses_red_flags?.some(c => triggeredHighRf.includes(c))
      ) || remaining.find(a =>
        a.addresses_red_flags?.some(c => triggeredHighRf.includes(c)) && !used.has(a.id)
      );

      if (rfAction) {
        // Remove from current position if in top5
        const existingIdx = top5.indexOf(rfAction);
        if (existingIdx >= 3) {
          top5.splice(existingIdx, 1);
        }
        // Insert at position 3 (index 2), push displaced out
        if (top5.length >= 5) {
          top5.splice(4, 1); // remove last
        }
        top5.splice(2, 0, rfAction);
      }
    }
  }

  return top5.slice(0, 5);
}

// ---- Question-level answer type for enrichment ----
export interface QuestionAnswer {
  question_id: string;
  dimension_id: string;
  score: number | null;
  notes?: string | null;
}

// ---- Meeting Agenda ----
export interface AgendaItem {
  topic: string;
  dimension?: string;
  dimension_id?: string;
  deep_dive_prompts: string[];
  expected_decision: string;
  context_checks?: string[];
  low_questions?: string[];
  red_flag?: EvaluatedRedFlag;
}

// Dimension-specific expected decisions
const DIM_DECISIONS: Record<string, string> = {
  FS: 'Definir gatilhos de corte/captação e revisar projeção de runway com 3 cenários.',
  GT: 'Priorizar 1 canal/experimento de aquisição com budget, responsável e métrica de sucesso.',
  GR: 'Resolver pendência societária mais crítica identificada no diagnóstico.',
  MN: 'Validar ou revisar hipótese de monetização com dado real de margem/CAC.',
  PM: 'Definir métrica de PMF e próxima ação para melhorar retenção/ativação.',
  PT: 'Aprovar roadmap de produto para próximos 60 dias com prioridades justificadas.',
  EE: 'Definir KPI de estratégia e responsável pelo acompanhamento semanal.',
  PL: 'Mapear gap de time crítico e decidir: contratar, terceirizar ou re-alocar.',
  IC: 'Definir 1 iniciativa de cultura/comunicação com owner e prazo.',
};

function getExpectedDecision(gap: PrioritizedGap, result: AssessmentResult): string {
  let base = DIM_DECISIONS[gap.dimension_id] || `Definir 1 ação prioritária para ${gap.label} com responsável e prazo.`;
  const ctx = (result as any).context_numeric || {};
  if (gap.dimension_id === 'FS' && ctx.runway_months && ctx.runway_months < 6) {
    base = `URGENTE — Runway crítico (${ctx.runway_months}m): ` + base;
  }
  if (gap.dimension_id === 'GT' && ctx.cac) {
    base += ` (CAC atual: R$${ctx.cac})`;
  }
  return base;
}

function getLowQuestions(dimId: string, answers: QuestionAnswer[], config: ConfigJSON): string[] {
  return answers
    .filter(a => a.dimension_id === dimId && a.score !== null && a.score !== undefined && a.score <= 2)
    .map(a => {
      const q = config.questions?.find(q => q.id === a.question_id);
      return q?.text || a.question_id;
    })
    .slice(0, 2);
}

export function generateMeetingAgenda(
  config: ConfigJSON,
  result: AssessmentResult,
  stage: string,
  answers?: QuestionAnswer[]
): AgendaItem[] {
  const gaps = computeGaps(result.dimension_scores, config, stage);
  const items: AgendaItem[] = [];
  const answersArr = answers || [];

  const triggeredRfIds = new Set(result.red_flags.map(rf => rf.code));

  // Normalize deep_dive_prompts
  const dd = config.deep_dive_prompts || {};
  let ddMap: Record<string, any[]> = {};
  if (Array.isArray(dd)) {
    (dd as any[]).forEach((item: any) => {
      if (item?.dimension_id) ddMap[item.dimension_id] = Array.isArray(item?.prompts) ? item.prompts : [];
    });
  } else {
    Object.entries(dd).forEach(([dimId, list]) => {
      ddMap[dimId] = Array.isArray(list) ? list : [];
    });
  }

  // Select prompts with conditional filtering
  const selectPromptsForDim = (dimId: string): string[] => {
    const allPrompts = ddMap[dimId] || [];
    const ds = result.dimension_scores.find(d => d.dimension_id === dimId);
    const dimScore = ds?.score ?? 5;
    const toText = (p: any): string => typeof p === 'string' ? p : (p?.prompt || p?.text || String(p));

    const relevant = allPrompts.filter((p: any) => {
      if (typeof p !== 'object' || p === null) return true;
      if (p.show_if_rf && !triggeredRfIds.has(p.show_if_rf)) return false;
      if (p.show_if_score_below && dimScore >= p.show_if_score_below) return false;
      return true;
    });

    if (relevant.length >= 2) return relevant.slice(0, 3).map(toText);
    const unconditional = allPrompts.filter((p: any) => {
      if (typeof p !== 'object' || p === null) return true;
      return !p.show_if_rf && !p.show_if_score_below;
    });
    return unconditional.slice(0, 3).map(toText);
  };

  // Item 1 & 2: top 2 priority gaps
  gaps.slice(0, 2).forEach((gap) => {
    const prompts = selectPromptsForDim(gap.dimension_id).slice(0, 2);
    const lowQs = getLowQuestions(gap.dimension_id, answersArr, config);
    items.push({
      topic: `Fortalecer ${gap.label} (gap de ${gap.gap_potential}pts)`,
      dimension: gap.label,
      dimension_id: gap.dimension_id,
      deep_dive_prompts: prompts.length > 0 ? prompts : [`Como elevar ${gap.label} de ${gap.score100} para ${gap.target100}?`],
      expected_decision: getExpectedDecision(gap, result),
      low_questions: lowQs.length > 0 ? lowQs : undefined,
    });
  });

  // Item 3: top red flag (if any)
  const topRf = [...result.red_flags].sort((a, b) => {
    const sev: Record<string, number> = { critical: 4, high: 3, medium_high: 2, medium: 1, low: 0 };
    return (sev[b.severity] || 0) - (sev[a.severity] || 0);
  })[0];

  if (topRf) {
    items.push({
      topic: `Red Flag: ${topRf.label}`,
      red_flag: topRf,
      deep_dive_prompts: topRf.actions.slice(0, 2),
      expected_decision: `Resolver ou mitigar "${topRf.label}" com ação concreta e deadline.`,
      context_checks: ['runway_months', 'burn_monthly', 'revenue_concentration_top1_pct'],
    });
  } else if (gaps.length > 2) {
    const g = gaps[2];
    const lowQs = getLowQuestions(g.dimension_id, answersArr, config);
    items.push({
      topic: `Desenvolver ${g.label}`,
      dimension: g.label,
      dimension_id: g.dimension_id,
      deep_dive_prompts: selectPromptsForDim(g.dimension_id).slice(0, 2),
      expected_decision: getExpectedDecision(g, result),
      low_questions: lowQs.length > 0 ? lowQs : undefined,
    });
  }

  return items;
}

// ---- 2x2 Matrix (Risk x Impact) ----
export interface MatrixPoint {
  id: string;
  label: string;
  impact: number;
  risk: number;
  type: 'dimension' | 'red_flag';
  quadrant: 'high_risk_high_impact' | 'high_risk_low_impact' | 'low_risk_high_impact' | 'low_risk_low_impact';
}

export function compute2x2Matrix(
  config: ConfigJSON,
  result: AssessmentResult,
  stage: string
): MatrixPoint[] {
  const gaps = computeGaps(result.dimension_scores, config, stage);
  const gapMap = new Map(gaps.map(g => [g.dimension_id, g]));
  const weights = config.weights_by_stage?.[stage] || {};
  const points: MatrixPoint[] = [];

  const allWeights = Object.values(weights).map((w: any) => toNumericWeight(w, 1));
  const maxWeight = Math.max(...allWeights, 1);

  const structuralDims = new Set(['FS', 'GR', 'PT']);

  const rfByDim: Record<string, number> = {};
  result.red_flags.forEach(rf => {
    const cfgRf = config.red_flags?.find(r => r.code === rf.code);
    const sevPoints: Record<string, number> = { critical: 4, high: 3, medium_high: 2, medium: 1, low: 0.5 };
    const sp = sevPoints[rf.severity] || 1;
    cfgRf?.triggers.forEach(t => {
      if (t.dimension_id) rfByDim[t.dimension_id] = (rfByDim[t.dimension_id] || 0) + sp;
    });
  });

  result.dimension_scores.forEach(ds => {
    const gap = gapMap.get(ds.dimension_id);
    const dimWeight = toNumericWeight((weights as any)[ds.dimension_id], 1);
    const score100 = scoreTo100(ds.score);

    const weightImpact = (dimWeight / maxWeight) * 60;
    const gapImpact = gap ? Math.min(40, gap.gap_potential * 2) : 0;
    const impact = Math.min(100, Math.round(weightImpact + gapImpact));

    const lowScore = Math.max(0, 60 - score100);
    const structuralBonus = structuralDims.has(ds.dimension_id) ? 15 : 0;
    const rfRisk = (rfByDim[ds.dimension_id] || 0) * 10;
    const risk = Math.min(100, lowScore + structuralBonus + rfRisk);

    const quadrant = impact >= 50
      ? (risk >= 50 ? 'high_risk_high_impact' : 'low_risk_high_impact')
      : (risk >= 50 ? 'high_risk_low_impact' : 'low_risk_low_impact');

    points.push({ id: ds.dimension_id, label: ds.label, impact, risk, type: 'dimension', quadrant });
  });

  result.red_flags.forEach(rf => {
    const sevImpact: Record<string, number> = { critical: 90, high: 75, medium_high: 55, medium: 40, low: 20 };
    const sevRisk: Record<string, number> = { critical: 95, high: 80, medium_high: 60, medium: 45, low: 25 };
    points.push({
      id: rf.code,
      label: rf.label,
      impact: sevImpact[rf.severity] || 50,
      risk: sevRisk[rf.severity] || 50,
      type: 'red_flag',
      quadrant: (sevImpact[rf.severity] || 50) >= 50
        ? ((sevRisk[rf.severity] || 50) >= 50 ? 'high_risk_high_impact' : 'low_risk_high_impact')
        : ((sevRisk[rf.severity] || 50) >= 50 ? 'high_risk_low_impact' : 'low_risk_low_impact'),
    });
  });

  return points;
}
