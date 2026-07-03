import { describe, expect, it } from 'vitest';
import type { Answer, ConfigJSON } from '@/types/darwin';
import { calculateDimensionScores } from './scoring';
import { filterSkippedAnswers, getAnswerableQuestions, getSkippedQuestions } from './question-flow';

const config: ConfigJSON = {
  dimensions: [{ id: 'IC', label: 'Identidade & Cultura', sort_order: 1 }],
  questions: [
    {
      id: 'IC01',
      dimension_id: 'IC',
      text: 'Existe clareza sobre propósito?',
      sort_order: 1,
    },
    {
      id: 'IC02',
      dimension_id: 'IC',
      text: 'Propósito é usado em decisões importantes?',
      sort_order: 2,
      tags: {
        skip_if: [
          {
            question_id: 'IC01',
            op: '<=',
            value: 1,
            reason: 'Sem clareza mínima de propósito, uso em decisão fica redundante.',
          },
        ],
      },
    },
  ],
  weights_by_stage: { seed: { IC: 1 } },
  targets_by_stage: { seed: { IC: 3.5 } },
  methodology: '',
  simulator: { presets: [] },
};

const answers: Answer[] = [
  {
    id: 'a1',
    assessment_id: 'assessment_1',
    question_id: 'IC01',
    value: 1,
    is_na: false,
    notes: null,
    created_at: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'a2',
    assessment_id: 'assessment_1',
    question_id: 'IC02',
    value: 5,
    is_na: false,
    notes: null,
    created_at: '2026-07-01T00:00:00.000Z',
  },
];

describe('conditional question flow', () => {
  it('excludes skipped questions and their stale answers', () => {
    expect(getSkippedQuestions(config, answers).map((item) => item.question.id)).toEqual(['IC02']);
    expect(getAnswerableQuestions(config, answers).map((question) => question.id)).toEqual(['IC01']);
    expect(filterSkippedAnswers(config, answers).map((answer) => answer.question_id)).toEqual(['IC01']);
  });

  it('keeps skipped questions out of scoring coverage and average', () => {
    const scores = calculateDimensionScores(config, answers, 'seed');

    expect(scores[0]).toMatchObject({
      score: 1,
      answered: 1,
      total: 1,
      coverage: 1,
    });
  });

  it('skips recurring-only questions for non-recurring revenue models', () => {
    const recurringConfig: ConfigJSON = {
      ...config,
      questions: [
        {
          id: 'GT04',
          dimension_id: 'IC',
          text: 'Retenção/engajamento é medido? (condicional modelos recorrentes)',
          sort_order: 1,
        },
      ],
    };

    expect(getAnswerableQuestions(recurringConfig, [], { revenue_model: 'subscription' }).map((q) => q.id)).toEqual(['GT04']);
    expect(getAnswerableQuestions(recurringConfig, [], { revenue_model: 'non_recurring' })).toEqual([]);
  });

  it('keeps B2B conditional questions open for B2B2C and skips them for B2C', () => {
    const b2bConfig: ConfigJSON = {
      ...config,
      questions: [
        {
          id: 'GT05',
          dimension_id: 'IC',
          text: 'Existe playbook de vendas? (condicional B2B)',
          sort_order: 1,
        },
      ],
    };

    expect(getAnswerableQuestions(b2bConfig, [], { customer_type: 'B2B2C' }).map((q) => q.id)).toEqual(['GT05']);
    expect(getAnswerableQuestions(b2bConfig, [], { customer_type: 'B2C' })).toEqual([]);
  });

  it('uses applicable GT questions as the scoring denominator', () => {
    const gtConfig: ConfigJSON = {
      ...config,
      dimensions: [{ id: 'GT', label: 'Go-to-market & Tração', sort_order: 1 }],
      questions: [
        { id: 'GT01', dimension_id: 'GT', text: 'Pipeline comercial é acompanhado?', sort_order: 1 },
        { id: 'GT02', dimension_id: 'GT', text: 'ICP está definido?', sort_order: 2 },
        { id: 'GT03', dimension_id: 'GT', text: 'Canais de aquisição estão validados?', sort_order: 3 },
        { id: 'GT04', dimension_id: 'GT', text: 'Retenção/engajamento é medido? (condicional modelos recorrentes)', sort_order: 4 },
        { id: 'GT05', dimension_id: 'GT', text: 'Existe playbook de vendas? (condicional B2B)', sort_order: 5 },
      ],
      weights_by_stage: { seed: { GT: 1 } },
      targets_by_stage: { seed: { GT: 3.5 } },
    };
    const gtAnswers: Answer[] = gtConfig.questions.map((question) => ({
      id: `a_${question.id}`,
      assessment_id: 'assessment_1',
      question_id: question.id,
      value: 4,
      is_na: false,
      notes: null,
      created_at: '2026-07-01T00:00:00.000Z',
    }));

    const nonRecurringB2c = calculateDimensionScores(gtConfig, gtAnswers, 'seed', {
      revenue_model: 'non_recurring',
      customer_type: 'B2C',
    })[0];
    const recurringB2b = calculateDimensionScores(gtConfig, gtAnswers, 'seed', {
      revenue_model: 'subscription',
      customer_type: 'B2B',
    })[0];

    expect(nonRecurringB2c).toMatchObject({ answered: 3, total: 3, coverage: 1 });
    expect(recurringB2b).toMatchObject({ answered: 5, total: 5, coverage: 1 });
  });
});
