import type { ConfigJSON, DimensionScore, EvaluatedRedFlag, AssessmentResult } from '@/types/darwin';

// ---- Score conversion ----
export function scoreTo100(score: number): number {
  return Math.round(((score - 1) / 4) * 100);
}

export function getLevel(score100: number): { label: string; color: string } {
  if (score100 >= 75) return { label: 'Avançado', color: 'text-success' };
  if (score100 >= 55) return { label: 'Estruturado', color: 'text-primary' };
  if (score100 >= 35) return { label: 'Em evolução', color: 'text-warning' };
  return { label: 'Inicial', color: 'text-destructive' };
}

// ---- Completeness ----
export interface CompletenessInfo {
  answered: number;
  total: number;
  pct: number;
  confidence: 'high' | 'medium' | 'low';
  confidenceLabel: string;
}

export function getCompleteness(result: AssessmentResult): CompletenessInfo {
  const answered = result.dimension_scores.reduce((s, d) => s + d.answered, 0);
  const total = result.dimension_scores.reduce((s, d) => s + d.total, 0);
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const confidence = pct >= 80 ? 'high' : pct >= 50 ? 'medium' : 'low';
  const confidenceLabel = confidence === 'high' ? 'Alta' : confidence === 'medium' ? 'Média' : 'Baixa';
  return { answered, total, pct, confidence, confidenceLabel };
}

// ---- Default blocks ----
export interface BlockDef {
  id: string;
  label: string;
  dimensions: string[];
}

export const DEFAULT_BLOCKS: BlockDef[] = [
  { id: 'crescimento', label: 'Crescimento', dimensions: ['MN', 'GT', 'EE'] },
  { id: 'fundamentos', label: 'Fundamentos', dimensions: ['FS', 'PM', 'GR'] },
  { id: 'execucao', label: 'Execução', dimensions: ['PT', 'PL', 'IC'] },
];

export function getBlocks(config: ConfigJSON): BlockDef[] {
  return (config as any).blocks?.length ? (config as any).blocks : DEFAULT_BLOCKS;
}

export interface BlockResult {
  id: string;
  label: string;
  score100: number;
  level: { label: string; color: string };
  lowestDim: string;
  dimensions: DimensionScore[];
}

export function computeBlocks(
  blocks: BlockDef[],
  dimensionScores: DimensionScore[],
  config: ConfigJSON,
  stage: string
): BlockResult[] {
  const weights = config.weights_by_stage?.[stage] || {};
  return blocks.map((block) => {
    const dims = dimensionScores.filter((d) => block.dimensions.includes(d.dimension_id));
    if (dims.length === 0) {
      return { id: block.id, label: block.label, score100: 0, level: getLevel(0), lowestDim: '', dimensions: dims };
    }
    const totalW = dims.reduce((s, d) => s + ((weights[d.dimension_id] as number) || 1), 0);
    const wAvg = dims.reduce((s, d) => s + d.score * ((weights[d.dimension_id] as number) || 1), 0) / totalW;
    const score100 = scoreTo100(wAvg);
    const lowest = [...dims].sort((a, b) => a.score - b.score)[0];
    return { id: block.id, label: block.label, score100, level: getLevel(score100), lowestDim: lowest.label, dimensions: dims };
  });
}

// ---- Red flag penalty ----
const DEFAULT_PENALTY: Record<string, number> = { high: 15, medium_high: 10, medium: 6, low: 3 };

export function getPenalty(rf: EvaluatedRedFlag, config: ConfigJSON): number {
  const cfgRf = config.red_flags?.find((r) => r.code === rf.code);
  return (cfgRf as any)?.penalty_points ?? DEFAULT_PENALTY[rf.severity] ?? 6;
}

export function computeCouncilRisk(redFlags: EvaluatedRedFlag[], config: ConfigJSON): number {
  const totalPenalty = redFlags.reduce((s, rf) => s + getPenalty(rf, config), 0);
  return Math.max(0, Math.min(100, 100 - totalPenalty));
}

export function getSeverityCategory(severity: string): string {
  if (['high', 'critical'].includes(severity)) return 'Crítico';
  if (['medium_high', 'medium'].includes(severity)) return 'Atenção';
  return 'Monitorar';
}

// ---- Gap with priority ----
export interface PrioritizedGap {
  dimension_id: string;
  label: string;
  score: number;
  score100: number;
  target: number;
  target100: number;
  potential100: number;
  gap_potential: number;
  priority_score: number;
}

export function computeGaps(
  dimensionScores: DimensionScore[],
  config: ConfigJSON,
  stage: string
): PrioritizedGap[] {
  const weights = config.weights_by_stage?.[stage] || {};
  const targets = config.targets_by_stage?.[stage] || {};
  return dimensionScores
    .filter((d) => d.coverage > 0)
    .map((d) => {
      const s100 = scoreTo100(d.score);
      const t100 = scoreTo100(d.target);
      const potential100 = scoreTo100(targets[d.dimension_id] || d.target);
      const gap_potential = Math.max(0, potential100 - s100);
      const w = (weights[d.dimension_id] as number) || 1;
      return {
        dimension_id: d.dimension_id,
        label: d.label,
        score: d.score,
        score100: s100,
        target: d.target,
        target100: t100,
        potential100,
        gap_potential,
        priority_score: gap_potential * w,
      };
    })
    .filter((g) => g.gap_potential > 0)
    .sort((a, b) => b.priority_score - a.priority_score);
}

// ---- Roadmap ----
export interface RoadmapAction {
  title: string;
  rationale: string;
  wave: 1 | 2 | 3;
  waveLabel: string;
}

export function generateRoadmap(
  gaps: PrioritizedGap[],
  redFlags: EvaluatedRedFlag[],
  config: ConfigJSON
): RoadmapAction[] {
  const actions: RoadmapAction[] = [];

  // From high severity red flags first
  const highRf = redFlags.filter((rf) => ['high', 'critical', 'medium_high'].includes(rf.severity));
  highRf.slice(0, 3).forEach((rf) => {
    const action = rf.actions[0] || rf.label;
    actions.push({ title: action, rationale: `Red Flag: ${rf.label} (${rf.severity})`, wave: 1, waveLabel: '0-30 dias' });
  });

  // Fill remaining wave 1 from gaps
  const gapActions = gaps.filter((g) => !actions.some((a) => a.rationale.includes(g.label)));
  let idx = 0;
  while (actions.filter((a) => a.wave === 1).length < 3 && idx < gapActions.length) {
    const g = gapActions[idx++];
    actions.push({ title: `Fortalecer ${g.label}`, rationale: `Gap de ${g.gap_potential}pts (prioridade ${Math.round(g.priority_score)})`, wave: 1, waveLabel: '0-30 dias' });
  }

  // Wave 2
  while (actions.filter((a) => a.wave === 2).length < 3 && idx < gapActions.length) {
    const g = gapActions[idx++];
    actions.push({ title: `Desenvolver ${g.label}`, rationale: `Gap de ${g.gap_potential}pts`, wave: 2, waveLabel: '31-90 dias' });
  }

  // Wave 3
  while (actions.filter((a) => a.wave === 3).length < 3 && idx < gapActions.length) {
    const g = gapActions[idx++];
    actions.push({ title: `Consolidar ${g.label}`, rationale: `Gap de ${g.gap_potential}pts`, wave: 3, waveLabel: '3-6 meses' });
  }

  return actions;
}

// ---- Narrative generation ----
export function generateOverallNarrative(
  result: AssessmentResult,
  config: ConfigJSON,
  stage: string
): string {
  const score100 = scoreTo100(result.overall_score);
  const level = getLevel(score100);
  const gaps = computeGaps(result.dimension_scores, config, stage);
  const topGaps = gaps.slice(0, 2).map((g) => g.label);
  const strengths = [...result.dimension_scores]
    .filter((d) => d.coverage > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((d) => d.label);

  let narrative = `A startup apresenta maturidade no nível "${level.label}" com score geral de ${score100}/100.`;
  if (strengths.length) narrative += ` Destaque positivo em ${strengths.join(' e ')}.`;
  if (topGaps.length) narrative += ` As maiores oportunidades de melhoria estão em ${topGaps.join(' e ')}.`;
  if (result.red_flags.length > 0) {
    const highCount = result.red_flags.filter((rf) => ['high', 'critical'].includes(rf.severity)).length;
    if (highCount > 0) narrative += ` Atenção: ${highCount} red flag(s) de alta severidade requerem ação imediata.`;
  }
  return narrative;
}

export function generateDimensionNarrative(ds: DimensionScore): string {
  const s100 = scoreTo100(ds.score);
  const level = getLevel(s100);
  const coveragePct = Math.round(ds.coverage * 100);
  return `${level.label} (${s100}/100). Cobertura de ${coveragePct}% das questões respondidas (${ds.answered}/${ds.total}). ${
    s100 < 55 ? 'Esta dimensão requer atenção prioritária para fortalecer a prontidão da startup.' : 
    s100 < 75 ? 'Dimensão em desenvolvimento — há espaço para consolidar práticas e processos.' :
    'Dimensão bem estruturada — manter e otimizar as práticas atuais.'
  }`;
}
