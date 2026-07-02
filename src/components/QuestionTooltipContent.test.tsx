import { render, screen } from '@testing-library/react';
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

    render(<QuestionTooltipContent question={question} />);

    expect(screen.getByText('O que significa')).toBeInTheDocument();
    expect(screen.getByText('Como interpretar')).toBeInTheDocument();
    expect(screen.getByText('Interprete se founders e time explicam a empresa de forma consistente.')).toBeInTheDocument();
    expect(screen.getByText('Por que importa')).toBeInTheDocument();
    expect(screen.getByText('Isso reduz desalinhamento em decisões críticas.')).toBeInTheDocument();
    expect(screen.getByText('Referências para pontuar 1 / 3 / 5')).toBeInTheDocument();
    expect(screen.getByText(/Cada pessoa explica de um jeito/)).toBeInTheDocument();
    expect(screen.getByText('Exemplos de evidências')).toBeInTheDocument();
    expect(screen.getByText('Materiais de onboarding')).toBeInTheDocument();
  });

  it('keeps explanations available for all 45 diagnostic question ids', () => {
    expect(DIAGNOSTIC_QUESTION_EXPLANATION_IDS).toHaveLength(45);
  });
});
