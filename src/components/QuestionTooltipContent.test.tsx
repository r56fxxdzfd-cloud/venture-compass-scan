import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuestionTooltipContent } from './QuestionTooltipContent';
import { DIAGNOSTIC_QUESTION_EXPLANATION_IDS } from '@/utils/question-explanations';
import type { ConfigQuestion } from '@/types/darwin';

describe('QuestionTooltipContent', () => {
  it('renders tooltip.explanation as Como interpretar without dropping why, anchors or evidence examples', () => {
    const question: ConfigQuestion = {
      id: 'IC01',
      dimension_id: 'IC',
      text: 'A empresa tem clareza de propósito?',
      sort_order: 1,
      tooltip: {
        definition: 'Clareza compartilhada sobre a razão de existir da empresa.',
        explanation: 'Interprete se founders e time explicam a empresa de forma consistente.',
        why: 'Isso reduz desalinhamento em decisões críticas.',
        anchors: {
          1: 'Cada pessoa explica de um jeito.',
          3: 'Existe direção, mas com inconsistências.',
          5: 'Todos explicam de forma parecida.',
        },
        evidence_examples: ['Narrativa institucional', 'Materiais de onboarding'],
      },
    };

    const { getByText } = render(<QuestionTooltipContent question={question} />);

    expect(getByText('O que significa')).toBeInTheDocument();
    expect(getByText('Como interpretar')).toBeInTheDocument();
    expect(getByText('Interprete se founders e time explicam a empresa de forma consistente.')).toBeInTheDocument();
    expect(getByText('Por que importa')).toBeInTheDocument();
    expect(getByText('Isso reduz desalinhamento em decisões críticas.')).toBeInTheDocument();
    expect(getByText('Referências para pontuar 1 / 3 / 5')).toBeInTheDocument();
    expect(getByText(/Cada pessoa explica de um jeito/)).toBeInTheDocument();
    expect(getByText('Exemplos de evidências')).toBeInTheDocument();
    expect(getByText('Materiais de onboarding')).toBeInTheDocument();
  });

  it('keeps explanations available for all 45 diagnostic question ids', () => {
    expect(DIAGNOSTIC_QUESTION_EXPLANATION_IDS).toHaveLength(45);
  });
});
