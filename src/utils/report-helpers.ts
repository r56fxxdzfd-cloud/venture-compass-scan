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

interface TemporalTrail {
  wave1: string;
  wave2: string;
  wave3: string;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getRedFlagTrail(label: string): TemporalTrail {
  const n = normalizeText(label);

  if ((n.includes('dependenc') && n.includes('pessoa')) || n.includes('key person') || n.includes('concentracao em 1 pessoa')) {
    return {
      wave1: 'Mapear pontos únicos de dependência, riscos operacionais e responsáveis de contingência',
      wave2: 'Implementar delegação progressiva, documentação crítica e backups operacionais',
      wave3: 'Consolidar sucessão, validar autonomia do time e reduzir dependência da liderança',
    };
  }

  if (n.includes('cap table') || n.includes('acordo de socios') || n.includes('vesting') || n.includes('societ')) {
    return {
      wave1: 'Levantar pendências societárias, papéis críticos e plano de regularização prioritária',
      wave2: 'Formalizar cap table, acordo de sócios, vesting e alçadas de decisão críticas',
      wave3: 'Institucionalizar revisão societária periódica e governança de decisões estratégicas',
    };
  }

  if (n.includes('seguranca') || n.includes('privacidade') || n.includes('lgpd') || n.includes('dados')) {
    return {
      wave1: 'Revisar acessos críticos, backup e riscos imediatos de exposição de dados',
      wave2: 'Implementar controles mínimos de LGPD, política de dados e gestão de permissões',
      wave3: 'Monitorar compliance, revisar incidentes e consolidar práticas de segurança operacional',
    };
  }

  if (n.includes('pipeline') || n.includes('funil') || n.includes('visibilidade comercial')) {
    return {
      wave1: 'Definir etapas mínimas do pipeline, critérios básicos e responsáveis por atualização',
      wave2: 'Implantar CRM/planilha, cadência semanal e critérios objetivos de avanço de etapa',
      wave3: 'Revisar conversões, previsibilidade e qualidade do funil de captação/vendas',
    };
  }

  if (n.includes('concentracao de receita') || (n.includes('receita') && n.includes('concentr'))) {
    return {
      wave1: 'Mapear concentração de receita, risco de perda e contas de maior criticidade',
      wave2: 'Executar plano de diversificação de canais, base de clientes e parceiros estratégicos',
      wave3: 'Monitorar concentração, ampliar recorrência e revisar dependência estratégica',
    };
  }

  if (n.includes('churn') || n.includes('retenc')) {
    return {
      wave1: 'Diagnosticar causas de churn/retenção e segmentos mais afetados',
      wave2: 'Implementar plano de retenção, onboarding e acompanhamento de coortes',
      wave3: 'Consolidar rotina de métricas de retenção, expansão e melhoria contínua',
    };
  }

  if (n.includes('entrega') || n.includes('instab') || n.includes('incidente') || n.includes('disponibilidade')) {
    return {
      wave1: 'Priorizar incidentes críticos e definir plano de estabilidade operacional',
      wave2: 'Implementar observabilidade, post-mortems e rotina de correção recorrente',
      wave3: 'Consolidar qualidade, reduzir recorrência de falhas e revisar dívida técnica',
    };
  }

  return {
    wave1: `Definir contenção inicial e responsáveis para mitigar ${label}`,
    wave2: `Implementar plano estruturante para atacar as causas de ${label}`,
    wave3: `Consolidar monitoramento, revisão de eficácia e institucionalização para ${label}`,
  };
}

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
    const severityBoost = rf.severity === 'critical' ? 12 : rf.severity === 'high' ? 9 : rf.severity === 'medium_high' ? 6 : 3;
    const priorityBase = Math.max(1, redFlags.length - index);
    const trail = getRedFlagTrail(rf.label);

    pushCandidate({
      title: trail.wave1,
      rationale: `Red Flag "${rf.label}" — contenção inicial e definição de responsáveis`,
      wave: 1,
      waveLabel: WAVE_LABELS[1],
      source: 'Red flag',
    }, 90 + severityBoost + priorityBase, `rf:${rf.code}:w1`);

    pushCandidate({
      title: trail.wave2,
      rationale: `Desdobramento da Red Flag "${rf.label}" — implementação estruturante`,
      wave: 2,
      waveLabel: WAVE_LABELS[2],
      source: 'Red flag',
    }, 78 + severityBoost, `rf:${rf.code}:w2`);

    pushCandidate({
      title: trail.wave3,
      rationale: `Desdobramento da Red Flag "${rf.label}" — consolidação`,
      wave: 3,
      waveLabel: WAVE_LABELS[3],
      source: 'Red flag',
    }, 68 + severityBoost, `rf:${rf.code}:w3`);

    const inferredWave = inferWaveFromActionText(primaryAction);
    if (inferredWave && inferredWave > 1) {
      pushCandidate({
        title: primaryAction,
        rationale: `Ação sugerida da Red Flag "${rf.label}" para acelerar execução`,
        wave: inferredWave,
        waveLabel: WAVE_LABELS[inferredWave],
        source: 'Ação sugerida',
      }, 64 + severityBoost, `rf:${rf.code}:action:${inferredWave}`);
    }
  });

  gaps.forEach((g) => {
    const baseWave = getGapBaseWave(g);
    const baseScore = Math.round(g.priority_score);

    pushCandidate({
      title: baseWave === 1 ? `Definir foco inicial e métrica mínima de ${g.label}` : getRoadmapTitle(g, baseWave),
      rationale: result ? getRoadmapRationale(g, result) : `Gap de ${g.gap_potential}pts (prioridade ${baseScore})`,
      wave: baseWave,
      waveLabel: WAVE_LABELS[baseWave],
      source: 'Gap de dimensão',
    }, baseScore + (baseWave === 1 ? 5 : 0), `gap:${g.dimension_id}:base`);

    if (baseWave === 1) {
      pushCandidate({
        title: `Implementar rotina estruturante de ${g.label} com processo e cadência`,
        rationale: `Desdobramento do Gap "${g.label}" — implementação estruturante`,
        wave: 2,
        waveLabel: WAVE_LABELS[2],
        source: 'Ação sugerida',
      }, Math.max(1, baseScore - 2), `gap:${g.dimension_id}:w2`);
    }

    pushCandidate({
      title: `Consolidar revisão periódica de ${g.label} e melhoria contínua`,
      rationale: `Desdobramento do Gap "${g.label}" — consolidação`,
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
