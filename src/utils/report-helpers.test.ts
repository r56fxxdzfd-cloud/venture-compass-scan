import { describe, expect, it } from 'vitest';
import { computeGaps, generateRoadmap, overallScore100, scoreTo100, type PrioritizedGap } from './report-helpers';
import { calculateDimensionScores } from './scoring';
import type { Answer, AssessmentResult, ConfigJSON, DimensionScore } from '@/types/darwin';

const baseConfig: ConfigJSON = {
  dimensions: [{ id: 'PM', label: 'Processos & Métricas', sort_order: 1 }],
  questions: [
    {
      id: 'q_pm_1',
      dimension_id: 'PM',
      text: 'Processos críticos estão definidos?',
      sort_order: 1,
    },
  ],
  weights_by_stage: { seed: { PM: 2 } },
  targets_by_stage: { seed: { PM: { benchmark: 3.5, potential: 4.5 } } },
  methodology: '',
  simulator: { presets: [] },
};

describe('report target handling', () => {
  it('uses benchmark as the dimension target when stage target is an object', () => {
    const answers: Answer[] = [
      {
        id: 'a1',
        assessment_id: 'assessment_1',
        question_id: 'q_pm_1',
        value: 2,
        is_na: false,
        notes: null,
        created_at: '2026-06-30T00:00:00.000Z',
      },
    ];

    const scores = calculateDimensionScores(baseConfig, answers, 'seed');

    expect(scores[0].score).toBe(2);
    expect(scores[0].target).toBe(3.5);
  });

  it('uses potential, not benchmark, to prioritize gaps', () => {
    const dimensionScores: DimensionScore[] = [
      {
        dimension_id: 'PM',
        label: 'Processos & Métricas',
        score: 2,
        target: 3.5,
        coverage: 1,
        answered: 1,
        total: 1,
      },
    ];

    const gaps = computeGaps(dimensionScores, baseConfig, 'seed');

    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      dimension_id: 'PM',
      target100: scoreTo100(3.5),
      potential100: scoreTo100(4.5),
      gap_potential: scoreTo100(4.5) - scoreTo100(2),
      priority_score: (scoreTo100(4.5) - scoreTo100(2)) * 2,
    });
  });
});

describe('overallScore100 — score único no relatório', () => {
  const resultWith = (weighted: number): AssessmentResult =>
    ({
      overall_score: Math.round(weighted * 100) / 100,
      overall_weighted: weighted,
      dimension_scores: [],
      red_flags: [],
      deep_dive_dimensions: [],
    }) as AssessmentResult;

  it('não arredonda duas vezes na fronteira (caso Planium: capa 88 vs sumário 89)', () => {
    const result = resultWith(4.5399);
    // overall_score foi arredondado para 4.54, que cai exatamente em 88.5 e sobe para 89.
    expect(scoreTo100(result.overall_score)).toBe(89);
    // O valor bruto é o correto, e é ele que vale em todo lugar.
    expect(overallScore100(result)).toBe(88);
  });

  it('usa o valor bruto, não o arredondado', () => {
    for (const weighted of [4.5399, 4.535, 3.9999, 2.0201, 4.9999]) {
      expect(overallScore100(resultWith(weighted))).toBe(scoreTo100(weighted));
    }
  });

  it('cai para overall_score quando não há overall_weighted (resultados antigos)', () => {
    const legacy = { overall_score: 4.54, dimension_scores: [], red_flags: [], deep_dive_dimensions: [] } as unknown as AssessmentResult;
    expect(overallScore100(legacy)).toBe(89);
  });
});

describe('generateRoadmap — Pauta ↔ Roadmap alinhados', () => {
  const gap = (over: Partial<PrioritizedGap>): PrioritizedGap => ({
    dimension_id: 'GT', label: 'Go-to-market & Tração', score: 3.4,
    score100: 60, target: 3.6, target100: 65, potential100: 65,
    gap_potential: 5, priority_score: 10, ...over,
  });

  it('caso 4MDG: gap único de dimensão madura ancora a Wave 1 (não fica só na Wave 3)', () => {
    // score100 60 + gap 5 -> getGapBaseWave devolveria Wave 3. Antes: curto prazo
    // "A definir". Agora o gap nº 1 (o mesmo que a Pauta eleva) ancora a Wave 1.
    const actions = generateRoadmap([gap({})], [], baseConfig);
    const waves = new Set(actions.map((a) => a.wave));
    expect(waves.has(1)).toBe(true);
    expect(waves.has(2)).toBe(true);
    expect(waves.has(3)).toBe(true);
    const wave1 = actions.filter((a) => a.wave === 1);
    expect(wave1.length).toBeGreaterThan(0);
    expect(wave1.every((a) => a.title.includes('Go-to-market & Tração'))).toBe(true);
  });

  it('gap de baixa prioridade (3º+) mantém a régua de maturidade — não é forçado à Wave 1', () => {
    const gaps = [
      gap({ dimension_id: 'A', label: 'Dim A' }),
      gap({ dimension_id: 'B', label: 'Dim B' }),
      gap({ dimension_id: 'C', label: 'Dim C madura', score100: 70, gap_potential: 3, priority_score: 3 }),
    ];
    const wave1Titles = generateRoadmap(gaps, [], baseConfig)
      .filter((a) => a.wave === 1).map((a) => a.title).join(' | ');
    expect(wave1Titles).not.toContain('Dim C madura');
  });
});
