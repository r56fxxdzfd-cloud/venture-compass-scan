import { describe, expect, it } from 'vitest';
import type { ConfigJSON, ConfigQuestion } from '@/types/darwin';
import { getNextDimensionAfterCompletedQuestion } from './questionnaire-navigation';

const dimensions = [
  { id: 'IC', label: 'Identidade & Cultura', sort_order: 1 },
  { id: 'PL', label: 'Produto', sort_order: 2 },
  { id: 'GT', label: 'Go-to-market', sort_order: 3 },
];

const questions: ConfigQuestion[] = [
  { id: 'IC01', dimension_id: 'IC', text: 'Pergunta 1', sort_order: 1 },
  { id: 'IC02', dimension_id: 'IC', text: 'Pergunta 2', sort_order: 2 },
  { id: 'PL01', dimension_id: 'PL', text: 'Pergunta 3', sort_order: 1 },
  { id: 'GT01', dimension_id: 'GT', text: 'Pergunta 4', sort_order: 1 },
];

const config = {
  dimensions,
  questions,
  weights_by_stage: { seed: { IC: 1, PL: 1, GT: 1 } },
  targets_by_stage: { seed: { IC: 3, PL: 3, GT: 3 } },
  methodology: '',
  simulator: { presets: [] },
} as ConfigJSON;

describe('questionnaire navigation', () => {
  it('does not advance when the answered question is not the last in the dimension', () => {
    expect(getNextDimensionAfterCompletedQuestion({
      config,
      questionId: 'IC01',
      currentAnswerableQuestions: questions,
      updatedAnswerableQuestions: questions,
      updatedAnswers: {
        IC01: { value: 4, is_na: false },
      },
    })).toBe('');
  });

  it('does not advance when previous questions in the dimension remain unanswered', () => {
    expect(getNextDimensionAfterCompletedQuestion({
      config,
      questionId: 'IC02',
      currentAnswerableQuestions: questions,
      updatedAnswerableQuestions: questions,
      updatedAnswers: {
        IC02: { value: 4, is_na: false },
      },
    })).toBe('');
  });

  it('advances to the next dimension with applicable questions when the current dimension is complete', () => {
    expect(getNextDimensionAfterCompletedQuestion({
      config,
      questionId: 'IC02',
      currentAnswerableQuestions: questions,
      updatedAnswerableQuestions: questions,
      updatedAnswers: {
        IC01: { value: 3, is_na: false },
        IC02: { value: 4, is_na: false },
      },
    })).toBe('PL');
  });

  it('skips dimensions without applicable questions', () => {
    const withoutProduct = questions.filter((question) => question.dimension_id !== 'PL');

    expect(getNextDimensionAfterCompletedQuestion({
      config,
      questionId: 'IC02',
      currentAnswerableQuestions: questions,
      updatedAnswerableQuestions: withoutProduct,
      updatedAnswers: {
        IC01: { value: 3, is_na: false },
        IC02: { value: 4, is_na: false },
      },
    })).toBe('GT');
  });
});
