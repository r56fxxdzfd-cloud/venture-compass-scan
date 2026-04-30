import type { ConfigJSON, DimensionScore, EvaluatedRedFlag, AssessmentResult, Answer } from '@/types/darwin';

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
  source: 'Red flag' | 'Gap de dimensão' | 'Ação sugerida' | 'Pauta do conselho';
}

const WAVE_LIMITS: Record<1 | 2 | 3, number> = { 1: 2, 2: 3, 3: 3 };
const WAVE_LABELS: Record<1 | 2 | 3, string> = { 1: '0-30 dias', 2: '31-90 dias', 3: '91-180 dias' };

function getRoadmapTitle(g: PrioritizedGap, wave: 1 | 2 | 3): string {
  if (wave === 1) {
    if (g.score100 < 30) return `Diagnosticar lacunas críticas em ${g.label} e definir plano de contenção`;
    return `Priorizar quick wins de ${g.label} e estabelecer responsáveis`;
  }
  if (wave === 2) {
    if (g.score100 < 45) return `Implementar controles e rotinas estruturantes em ${g.label}`;
    return `Executar plano de evolução de ${g.label} com ritos recorrentes`;
  }
  return `Consolidar ${g.label} com melhoria contínua e otimização`;
}

function getRoadmapRationale(g: PrioritizedGap, result: AssessmentResult): string {
  const parts = [`Gap de ${g.gap_potential}pts vs potencial de 6 meses`];
  const ctx = (result as any).context_numeric || {};
  if (g.dimension_id === 'FS' && ctx.runway_months) {
    parts.push(`Runway atual: ${ctx.runway_months} meses`);
  }
  if (g.dimension_id === 'GT' && ctx.cac) {
    parts.push(`CAC atual: R$${ctx.cac}`);
  }
  if (g.dimension_id === 'MN' && ctx.ltv_cac_ratio) {
    parts.push(`LTV/CAC: ${ctx.ltv_cac_ratio}`);
  }
  return parts.join(' · ');
}

function inferWaveFromActionText(text: string): 1 | 2 | 3 | null {
  const normalized = text.toLowerCase();
  const wave1Hints = ['mapear', 'diagnost', 'priorizar', 'definir', 'criar plano', 'levantar', 'conter', 'validar', 'revisar acesso'];
  const wave2Hints = ['implementar', 'implantar', 'formalizar', 'executar', 'documentar', 'estruturar', 'criar rotina', 'pipeline', 'treinar', 'padronizar', 'acompanhar'];
  const wave3Hints = ['consolidar', 'otimizar', 'escalar', 'automatizar', 'revisar ciclo', 'melhoria contínua', 'expandir', 'institucionalizar'];

  if (wave3Hints.some((hint) => normalized.includes(hint))) return 3;
  if (wave2Hints.some((hint) => normalized.includes(hint))) return 2;
  if (wave1Hints.some((hint) => normalized.includes(hint))) return 1;
  return null;
}

function getGapBaseWave(g: PrioritizedGap): 1 | 2 | 3 {
  if (g.score100 < 30 || g.gap_potential >= 30) return 1;
  if (g.score100 < 55 || g.gap_potential >= 15) return 2;
  return 3;
}

export function generateRoadmap(
  gaps: PrioritizedGap[],
  redFlags: EvaluatedRedFlag[],
  config: ConfigJSON,
  result?: AssessmentResult
): RoadmapAction[] {
  void config;

  type Candidate = { action: RoadmapAction; score: number; key: string };
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  const pushCandidate = (action: RoadmapAction, score: number, key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ action, score, key });
  };

  redFlags.forEach((rf, index) => {
    const primaryAction = rf.actions[0] || rf.label;
    const inferredWave = inferWaveFromActionText(primaryAction);
    const severityBoost = rf.severity === 'critical' ? 12 : rf.severity === 'high' ? 9 : rf.severity === 'medium_high' ? 6 : 3;
    const priorityBase = Math.max(1, redFlags.length - index);

    const wave1Title = `Mapear e priorizar contenção para ${rf.label}`;
    pushCandidate({
      title: wave1Title,
      rationale: `Red Flag "${rf.label}" — contenção inicial e definição de responsáveis`,
      wave: 1,
      waveLabel: WAVE_LABELS[1],
      source: 'Red flag',
    }, 90 + severityBoost + priorityBase, `rf:${rf.code}:w1`);

    if (inferredWave && inferredWave > 1) {
      pushCandidate({
        title: primaryAction,
        rationale: `Desdobramento da Red Flag "${rf.label}" para execução estruturante`,
        wave: inferredWave,
        waveLabel: WAVE_LABELS[inferredWave],
        source: 'Red flag',
      }, 70 + severityBoost, `rf:${rf.code}:action`);
    }
  });

  gaps.forEach((g) => {
    const baseWave = getGapBaseWave(g);
    const baseScore = Math.round(g.priority_score);

    pushCandidate({
      title: getRoadmapTitle(g, baseWave),
      rationale: result ? getRoadmapRationale(g, result) : `Gap de ${g.gap_potential}pts (prioridade ${baseScore})`,
      wave: baseWave,
      waveLabel: WAVE_LABELS[baseWave],
      source: 'Gap de dimensão',
    }, baseScore + (baseWave === 1 ? 5 : 0), `gap:${g.dimension_id}:base`);

    if (baseWave === 1) {
      pushCandidate({
        title: `Implementar plano estruturante de ${g.label}`,
        rationale: `Sequência da priorização inicial em ${g.label}`,
        wave: 2,
        waveLabel: WAVE_LABELS[2],
        source: 'Ação sugerida',
      }, Math.max(1, baseScore - 2), `gap:${g.dimension_id}:w2`);
    }

    pushCandidate({
      title: `Consolidar ganhos de ${g.label} com revisão de maturidade`,
      rationale: `Evolução e estabilidade de longo ciclo para ${g.label}`,
      wave: 3,
      waveLabel: WAVE_LABELS[3],
      source: 'Ação sugerida',
    }, Math.max(1, baseScore - 4), `gap:${g.dimension_id}:w3`);
  });

  const selected: RoadmapAction[] = [];
  ([1, 2, 3] as const).forEach((wave) => {
    const waveCandidates = candidates
      .filter((c) => c.action.wave === wave)
      .sort((a, b) => b.score - a.score)
      .slice(0, WAVE_LIMITS[wave])
      .map((c) => c.action);
    selected.push(...waveCandidates);
  });

  return selected.sort((a, b) => a.wave - b.wave);
}

// ---- Narrative generation ----
export function generateOverallNarrative(
  result: AssessmentResult,
  config: ConfigJSON,
  stage: string,
  answers?: Answer[]
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

  // Mention the single worst-scored question
  if (answers && answers.length > 0) {
    const worstAnswer = answers
      .filter(a => a.value !== null && a.value !== undefined)
      .sort((a, b) => (a.value ?? 5) - (b.value ?? 5))[0];
    if (worstAnswer && worstAnswer.value !== null && worstAnswer.value <= 2) {
      const worstQ = config.questions?.find(q => q.id === worstAnswer.question_id);
      if (worstQ) {
        const qText = worstQ.text.length > 80 ? worstQ.text.substring(0, 80) + '...' : worstQ.text;
        narrative += ` Ponto mais crítico identificado: "${qText}" (score ${worstAnswer.value}/5).`;
      }
    }
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
