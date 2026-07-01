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
});
