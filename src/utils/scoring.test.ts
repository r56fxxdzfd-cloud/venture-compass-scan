import { describe, expect, it } from 'vitest';
import type { Answer, ConfigJSON, DimensionScore } from '@/types/darwin';
import { evaluateRedFlags } from './scoring';

const baseConfig: ConfigJSON = {
  dimensions: [{ id: 'GT', label: 'Go-to-market & Tração', sort_order: 1 }],
  questions: [],
  weights_by_stage: { seed: { GT: 1 } },
  targets_by_stage: { seed: { GT: 3.5 } },
  methodology: '',
  simulator: { presets: [] },
};

const dimensionScores: DimensionScore[] = [
  { dimension_id: 'GT', label: 'Go-to-market & Tração', score: 3, target: 3.5, coverage: 1, answered: 1, total: 1 },
];

function answer(questionId: string, value: number): Answer {
  return {
    id: `answer_${questionId}`,
    assessment_id: 'assessment_1',
    question_id: questionId,
    value,
    is_na: false,
    notes: null,
    created_at: '2026-07-01T00:00:00.000Z',
  };
}

describe('red flag scoring', () => {
  const customerConcentrationConfig: ConfigJSON = {
    ...baseConfig,
    red_flags: [
      {
        code: 'RF_CUSTOMER_CONC',
        label: 'Concentração alta de receita',
        severity: 'high',
        triggers: [
          { type: 'numeric_threshold', field: 'revenue_concentration_top1_pct', op: '>', value: 60 },
          { type: 'numeric_threshold', field: 'revenue_concentration_top3_pct', op: '>', value: 80 },
        ],
        actions: [],
      },
    ],
  };

  it('triggers RF_CUSTOMER_CONC for high top 1 concentration', () => {
    const flags = evaluateRedFlags(customerConcentrationConfig, dimensionScores, [], {
      revenue_concentration_top1_pct: 61,
      revenue_concentration_top3_pct: 50,
    }, 'seed');

    expect(flags.map((flag) => flag.code)).toEqual(['RF_CUSTOMER_CONC']);
  });

  it('triggers RF_CUSTOMER_CONC for high top 3 concentration', () => {
    const flags = evaluateRedFlags(customerConcentrationConfig, dimensionScores, [], {
      revenue_concentration_top1_pct: 40,
      revenue_concentration_top3_pct: 81,
    }, 'seed');

    expect(flags.map((flag) => flag.code)).toEqual(['RF_CUSTOMER_CONC']);
  });

  it('does not trigger RF_CUSTOMER_CONC for low customer concentration', () => {
    const flags = evaluateRedFlags(customerConcentrationConfig, dimensionScores, [], {
      revenue_concentration_top1_pct: 40,
      revenue_concentration_top3_pct: 50,
    }, 'seed');

    expect(flags).toEqual([]);
  });

  it('treats legacy customer concentration thresholds without op as greater-than', () => {
    const legacyConfig: ConfigJSON = {
      ...customerConcentrationConfig,
      red_flags: [
        {
          ...customerConcentrationConfig.red_flags![0],
          triggers: [
            { type: 'numeric_threshold', field: 'revenue_concentration_top1_pct', value: 60 },
          ],
        },
      ],
    };

    expect(evaluateRedFlags(legacyConfig, dimensionScores, [], { revenue_concentration_top1_pct: 61 }, 'seed').map((flag) => flag.code)).toEqual(['RF_CUSTOMER_CONC']);
    expect(evaluateRedFlags(legacyConfig, dimensionScores, [], { revenue_concentration_top1_pct: 40 }, 'seed')).toEqual([]);
  });

  it('supports explicit all/and composition for question-score red flags', () => {
    const config: ConfigJSON = {
      ...baseConfig,
      red_flags: [
        {
          code: 'RF_KEYPERSON',
          label: 'Dependência de pessoa-chave',
          severity: 'high',
          trigger_match: 'all',
          triggers: [
            { type: 'question_score_below', question_id: 'PL01', op: '<=', value: 2 },
            { type: 'question_score_below', question_id: 'PM02', op: '<=', value: 2 },
          ],
          actions: [],
        },
      ],
    };

    expect(evaluateRedFlags(config, dimensionScores, [answer('PL01', 2), answer('PM02', 3)], {}, 'seed')).toEqual([]);
    expect(evaluateRedFlags(config, dimensionScores, [answer('PL01', 2), answer('PM02', 2)], {}, 'seed').map((flag) => flag.code)).toEqual(['RF_KEYPERSON']);
  });
});
