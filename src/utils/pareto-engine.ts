import type { ConfigJSON, AssessmentResult, EvaluatedRedFlag, DimensionScore } from '@/types/darwin';
import { computeGaps, scoreTo100, DEFAULT_BLOCKS, type PrioritizedGap } from '@/utils/report-helpers';

// ---- Action types ----
export interface ParetoAction {
  id: string;
  title: string;
  description: string;
  first_step: string;
  done_definition: string;
  effort: 'S' | 'M' | 'L';
  time_to_impact_days: number;
  impact_weight: number;
  stage_tags: string[];
  business_model_tags: string[];
  addresses_red_flags?: string[];
  kpi_hint?: string;
  dimension_id: string;
}

export interface ScoredAction extends ParetoAction {
  pareto_score: number;
  reason: string;
  impacted_dimensions: string[];
}

// ---- Default action library (~3 per dimension for brevity, covering all 9) ----
const DEFAULT_ACTION_LIBRARY: Record<string, ParetoAction[]> = {
  MN: [
    { id: 'MN-01', title: 'Validar unit economics com dados reais', description: 'Calcular CAC, LTV e payback com métricas atuais.', first_step: 'Levantar CAC dos últimos 3 meses por canal.', done_definition: 'Planilha com unit economics por cohort.', effort: 'S', time_to_impact_days: 7, impact_weight: 5, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'MN', kpi_hint: 'LTV/CAC ratio' },
    { id: 'MN-02', title: 'Testar novo canal de aquisição', description: 'Experimentar canal não explorado para diversificar.', first_step: 'Selecionar 1 canal e definir budget de teste.', done_definition: 'Teste de 2 semanas com CAC medido.', effort: 'M', time_to_impact_days: 21, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'MN' },
    { id: 'MN-03', title: 'Documentar pricing strategy', description: 'Formalizar lógica de precificação e margens.', first_step: 'Mapear preços atuais vs concorrentes.', done_definition: 'Documento de pricing aprovado.', effort: 'S', time_to_impact_days: 5, impact_weight: 3, stage_tags: ['pre_seed', 'seed'], business_model_tags: [], dimension_id: 'MN' },
  ],
  GT: [
    { id: 'GT-01', title: 'Definir North Star Metric', description: 'Alinhar time em torno de métrica principal de crescimento.', first_step: 'Reunião de alinhamento sobre métrica candidata.', done_definition: 'NSM definida e visível em dashboard.', effort: 'S', time_to_impact_days: 3, impact_weight: 5, stage_tags: ['pre_seed', 'seed', 'series_a'], business_model_tags: [], dimension_id: 'GT' },
    { id: 'GT-02', title: 'Implementar growth loop principal', description: 'Criar ciclo viral ou de retenção.', first_step: 'Mapear loops existentes e identificar o principal.', done_definition: 'Loop implementado e métrica de ciclo medida.', effort: 'L', time_to_impact_days: 45, impact_weight: 5, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'GT' },
    { id: 'GT-03', title: 'Criar dashboard de métricas semanais', description: 'Visibilidade sobre KPIs de crescimento.', first_step: 'Listar top 5 métricas e fonte de dados.', done_definition: 'Dashboard atualizado automaticamente.', effort: 'M', time_to_impact_days: 14, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'GT' },
  ],
  EE: [
    { id: 'EE-01', title: 'Mapear jornada do cliente end-to-end', description: 'Identificar pontos de fricção e oportunidades.', first_step: 'Entrevistar 5 clientes sobre experiência.', done_definition: 'Mapa de jornada com pain points priorizados.', effort: 'M', time_to_impact_days: 14, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'EE' },
    { id: 'EE-02', title: 'Implementar NPS ou CSAT', description: 'Medir satisfação de forma recorrente.', first_step: 'Escolher ferramenta e criar survey.', done_definition: 'Primeira rodada de NPS coletada.', effort: 'S', time_to_impact_days: 7, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'EE' },
  ],
  FS: [
    { id: 'FS-01', title: 'Projetar runway com cenários', description: 'Modelar otimista, base e pessimista.', first_step: 'Atualizar planilha financeira com 3 cenários.', done_definition: 'Projeção de 12 meses com cenários.', effort: 'S', time_to_impact_days: 5, impact_weight: 5, stage_tags: ['pre_seed', 'seed', 'series_a'], business_model_tags: [], dimension_id: 'FS', kpi_hint: 'Runway em meses', addresses_red_flags: ['RF_RUNWAY'] },
    { id: 'FS-02', title: 'Reduzir burn rate em 15%', description: 'Identificar gastos cortáveis sem impacto no crescimento.', first_step: 'Categorizar despesas por essencialidade.', done_definition: 'Burn reduzido e validado por 1 mês.', effort: 'M', time_to_impact_days: 30, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'FS', addresses_red_flags: ['RF_RUNWAY', 'RF_BURN'] },
  ],
  PM: [
    { id: 'PM-01', title: 'Validar product-market fit com dados', description: 'Aplicar Sean Ellis test ou análise de retenção.', first_step: 'Enviar survey "How disappointed would you be?" para 40+ users.', done_definition: 'Score PMF calculado.', effort: 'S', time_to_impact_days: 10, impact_weight: 5, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'PM' },
    { id: 'PM-02', title: 'Criar roadmap baseado em feedback', description: 'Priorizar features com framework ICE/RICE.', first_step: 'Compilar top 10 pedidos de clientes.', done_definition: 'Roadmap de 3 meses priorizado.', effort: 'M', time_to_impact_days: 14, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'PM' },
  ],
  GR: [
    { id: 'GR-01', title: 'Formalizar governança mínima', description: 'Board advisory, cap table limpo, acordos de sócios.', first_step: 'Revisar cap table e identificar pendências.', done_definition: 'Documentação de governança atualizada.', effort: 'M', time_to_impact_days: 21, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'GR' },
    { id: 'GR-02', title: 'Implementar report mensal para stakeholders', description: 'Transparência com investidores e advisors.', first_step: 'Criar template de update mensal.', done_definition: 'Primeiro report enviado.', effort: 'S', time_to_impact_days: 7, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'GR' },
  ],
  PT: [
    { id: 'PT-01', title: 'Adotar metodologia ágil simplificada', description: 'Sprints de 2 semanas com retro.', first_step: 'Definir cadência e ferramentas.', done_definition: 'Primeira sprint completa com retro.', effort: 'M', time_to_impact_days: 14, impact_weight: 4, stage_tags: ['pre_seed', 'seed'], business_model_tags: [], dimension_id: 'PT' },
    { id: 'PT-02', title: 'Definir OKRs trimestrais', description: 'Alinhar time com objetivos claros.', first_step: 'Workshop de OKRs com founders.', done_definition: 'OKRs Q+1 definidos e comunicados.', effort: 'S', time_to_impact_days: 5, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'PT' },
  ],
  PL: [
    { id: 'PL-01', title: 'Criar plano de hiring para próximos 6 meses', description: 'Priorizar contratações críticas.', first_step: 'Mapear gaps de competência vs roadmap.', done_definition: 'Plano de hiring aprovado.', effort: 'S', time_to_impact_days: 7, impact_weight: 4, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'PL' },
    { id: 'PL-02', title: 'Implementar 1:1s semanais', description: 'Melhorar feedback loop com o time.', first_step: 'Agendar 1:1s recorrentes.', done_definition: 'Cadência mantida por 4 semanas.', effort: 'S', time_to_impact_days: 3, impact_weight: 3, stage_tags: ['pre_seed', 'seed', 'series_a'], business_model_tags: [], dimension_id: 'PL' },
  ],
  IC: [
    { id: 'IC-01', title: 'Documentar cultura e valores', description: 'Formalizar princípios do time.', first_step: 'Workshop com founders sobre valores.', done_definition: 'Documento de cultura publicado.', effort: 'S', time_to_impact_days: 7, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'IC' },
    { id: 'IC-02', title: 'Criar onboarding estruturado', description: 'Reduzir time-to-productivity de novos membros.', first_step: 'Documentar processos chave e checklist de onboarding.', done_definition: 'Próximo hire passa pelo onboarding novo.', effort: 'M', time_to_impact_days: 21, impact_weight: 3, stage_tags: ['seed', 'series_a'], business_model_tags: [], dimension_id: 'IC' },
  ],
};

// ---- Get action library (from config or defaults) ----
function getActionLibrary(config: ConfigJSON): Record<string, ParetoAction[]> {
  const lib = (config as any).action_library;
  if (lib && typeof lib === 'object' && Object.keys(lib).length > 0) return lib;
  return DEFAULT_ACTION_LIBRARY;
}

// ---- Compute Pareto scores ----
const EFFORT_FACTOR: Record<string, number> = { S: 1, M: 2, L: 3 };

export function computeParetoActions(
  config: ConfigJSON,
  result: AssessmentResult,
  stage: string
): ScoredAction[] {
  const library = getActionLibrary(config);
  const gaps = computeGaps(result.dimension_scores, config, stage);
  const gapMap = new Map(gaps.map((g) => [g.dimension_id, g]));
  const triggeredHighRf = new Set(
    result.red_flags.filter((rf) => ['high', 'critical'].includes(rf.severity)).map((rf) => rf.code)
  );

  const allActions: ScoredAction[] = [];

  for (const [dimId, actions] of Object.entries(library)) {
    const gap = gapMap.get(dimId);
    const priorityScoreDim = gap?.priority_score || 0;
    const dimLabel = result.dimension_scores.find((d) => d.dimension_id === dimId)?.label || dimId;

    for (const action of actions) {
      const effortFactor = EFFORT_FACTOR[action.effort] || 2;
      let paretoScore = (action.impact_weight * (priorityScoreDim || 1)) / effortFactor;

      // Boost if addresses triggered high-severity red flag
      const addressesHighRf = action.addresses_red_flags?.some((code) => triggeredHighRf.has(code));
      if (addressesHighRf) paretoScore *= 1.5;

      const reasons: string[] = [];
      if (gap && gap.gap_potential > 0) reasons.push(`Gap ${gap.gap_potential}pts em ${dimLabel}`);
      if (addressesHighRf) reasons.push('Endereça red flag crítico');
      if (action.effort === 'S') reasons.push('Baixo esforço');

      allActions.push({
        ...action,
        pareto_score: Math.round(paretoScore * 10) / 10,
        reason: reasons.join(' · ') || 'Impacto geral',
        impacted_dimensions: [dimLabel],
      });
    }
  }

  // Sort by pareto_score desc
  allActions.sort((a, b) => b.pareto_score - a.pareto_score);
  return allActions;
}

// ---- Select Top 5 with constraints ----
export function selectTop5(
  scored: ScoredAction[],
  result: AssessmentResult,
  config: ConfigJSON
): ScoredAction[] {
  const blocks = DEFAULT_BLOCKS;
  const growthDims = new Set(blocks[0].dimensions);
  const foundationDims = new Set(blocks[1].dimensions);
  const executionDims = new Set(blocks[2].dimensions);

  const triggeredHighRf = result.red_flags
    .filter((rf) => ['high', 'critical'].includes(rf.severity))
    .map((rf) => rf.code);

  const selected: ScoredAction[] = [];
  const used = new Set<string>();

  const pick = (action: ScoredAction) => {
    if (!used.has(action.id)) {
      selected.push(action);
      used.add(action.id);
    }
  };

  // If high severity red flag, ensure at least 1 addressing it in top 3
  if (triggeredHighRf.length > 0) {
    const rfAction = scored.find((a) => a.addresses_red_flags?.some((c) => triggeredHighRf.includes(c)));
    if (rfAction) pick(rfAction);
  }

  // Fill from top scored
  for (const a of scored) {
    if (selected.length >= 5) break;
    pick(a);
  }

  // Ensure block coverage
  const hasGrowth = selected.some((a) => growthDims.has(a.dimension_id));
  const hasFoundation = selected.some((a) => foundationDims.has(a.dimension_id));
  const hasExecution = selected.some((a) => executionDims.has(a.dimension_id));

  const ensureBlock = (dimSet: Set<string>) => {
    const candidate = scored.find((a) => dimSet.has(a.dimension_id) && !used.has(a.id));
    if (candidate) {
      if (selected.length >= 5) selected.pop();
      pick(candidate);
    }
  };

  if (!hasGrowth) ensureBlock(growthDims);
  if (!hasFoundation) ensureBlock(foundationDims);
  if (!hasExecution) ensureBlock(executionDims);

  return selected.slice(0, 5);
}

// ---- Meeting Agenda ----
export interface AgendaItem {
  topic: string;
  dimension?: string;
  deep_dive_prompts: string[];
  expected_decision: string;
  context_checks?: string[];
  red_flag?: EvaluatedRedFlag;
}

export function generateMeetingAgenda(
  config: ConfigJSON,
  result: AssessmentResult,
  stage: string
): AgendaItem[] {
  const gaps = computeGaps(result.dimension_scores, config, stage);
  const items: AgendaItem[] = [];

  // Normalize deep_dive_prompts
  const dd = config.deep_dive_prompts || {};
  let ddMap: Record<string, string[]> = {};
  if (Array.isArray(dd)) {
    (dd as any[]).forEach((item: any) => {
      if (item?.dimension_id) ddMap[item.dimension_id] = Array.isArray(item?.prompts) ? item.prompts : [];
    });
  } else {
    Object.entries(dd).forEach(([dimId, list]) => {
      ddMap[dimId] = Array.isArray(list) ? list as string[] : [];
    });
  }

  // Item 1 & 2: top 2 priority gaps
  gaps.slice(0, 2).forEach((gap, i) => {
    const prompts = (ddMap[gap.dimension_id] || []).slice(0, 2);
    items.push({
      topic: `Fortalecer ${gap.label} (gap de ${gap.gap_potential}pts)`,
      dimension: gap.label,
      deep_dive_prompts: prompts.length > 0 ? prompts : [`Como elevar ${gap.label} de ${gap.score100} para ${gap.target100}?`],
      expected_decision: i === 0
        ? `Definir 1 ação prioritária para ${gap.label} com responsável e prazo.`
        : `Aprovar plano de melhoria para ${gap.label}.`,
    });
  });

  // Item 3: top red flag (if any)
  const topRf = result.red_flags.sort((a, b) => {
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
    // If no red flags, add third gap
    const g = gaps[2];
    items.push({
      topic: `Desenvolver ${g.label}`,
      dimension: g.label,
      deep_dive_prompts: (ddMap[g.dimension_id] || []).slice(0, 2),
      expected_decision: `Planejar iniciativa para ${g.label}.`,
    });
  }

  return items;
}

// ---- 2x2 Matrix (Risk x Impact) ----
export interface MatrixPoint {
  id: string;
  label: string;
  impact: number; // 0-100
  risk: number;   // 0-100
  type: 'dimension' | 'red_flag';
  quadrant: 'high_risk_high_impact' | 'high_risk_low_impact' | 'low_risk_high_impact' | 'low_risk_low_impact';
}

export function compute2x2Matrix(
  config: ConfigJSON,
  result: AssessmentResult,
  stage: string
): MatrixPoint[] {
  const gaps = computeGaps(result.dimension_scores, config, stage);
  const weights = config.weights_by_stage?.[stage] || {};
  const points: MatrixPoint[] = [];

  // Max values for normalization
  const maxPriority = Math.max(...gaps.map((g) => g.priority_score), 1);

  // High-risk dimension IDs (structural)
  const structuralDims = new Set(['FS', 'GR', 'PT']);

  // Map red flags to dimensions
  const rfByDim: Record<string, number> = {};
  result.red_flags.forEach((rf) => {
    const cfgRf = config.red_flags?.find((r) => r.code === rf.code);
    const sevPoints: Record<string, number> = { critical: 4, high: 3, medium_high: 2, medium: 1, low: 0.5 };
    const sp = sevPoints[rf.severity] || 1;
    cfgRf?.triggers.forEach((t) => {
      if (t.dimension_id) rfByDim[t.dimension_id] = (rfByDim[t.dimension_id] || 0) + sp;
    });
  });

  // Dimension points
  gaps.forEach((gap) => {
    const impact = Math.min(100, Math.round((gap.priority_score / maxPriority) * 100));
    const ds = result.dimension_scores.find((d) => d.dimension_id === gap.dimension_id);
    const lowScore = ds ? Math.max(0, 60 - scoreTo100(ds.score)) : 0;
    const structuralBonus = structuralDims.has(gap.dimension_id) ? 15 : 0;
    const rfRisk = (rfByDim[gap.dimension_id] || 0) * 10;
    const risk = Math.min(100, lowScore + structuralBonus + rfRisk);

    const quadrant = impact >= 50
      ? (risk >= 50 ? 'high_risk_high_impact' : 'low_risk_high_impact')
      : (risk >= 50 ? 'high_risk_low_impact' : 'low_risk_low_impact');

    points.push({ id: gap.dimension_id, label: gap.label, impact, risk, type: 'dimension', quadrant });
  });

  // Red flag points
  result.red_flags.forEach((rf) => {
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
