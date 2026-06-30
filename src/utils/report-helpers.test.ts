import { describe, expect, it } from 'vitest';
import { computeGaps, scoreTo100 } from './report-helpers';
import { calculateDimensionScores } from './scoring';
import type { Answer, ConfigJSON, DimensionScore } from '@/types/darwin';

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
