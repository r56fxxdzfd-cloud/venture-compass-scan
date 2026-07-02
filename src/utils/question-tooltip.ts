import type { ConfigQuestion } from '@/types/darwin';
import { DIAGNOSTIC_QUESTION_EXPLANATIONS } from '@/utils/question-explanations';

type ExtendedQuestionTooltip = NonNullable<ConfigQuestion['tooltip']> & {
  detail?: string | null;
  details?: string | null;
  description?: string | null;
  guidance?: string | null;
  interpretation?: string | null;
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getExplicitQuestionExplanation(question: ConfigQuestion): string {
  const tooltip = question.tooltip as ExtendedQuestionTooltip | undefined;
  if (!tooltip) return '';

  return [
    tooltip.explanation,
    tooltip.interpretation,
    tooltip.guidance,
    tooltip.details,
    tooltip.detail,
    tooltip.description,
  ].map(cleanText).find(Boolean) || '';
}

export function getQuestionTooltipExplanation(
  question: ConfigQuestion,
  options: { includeFallback?: boolean } = {}
): string {
  const explicitExplanation = getExplicitQuestionExplanation(question);
  if (explicitExplanation) return explicitExplanation;
  if (options.includeFallback === false) return '';

  return DIAGNOSTIC_QUESTION_EXPLANATIONS[question.id] || '';
}

export function hasQuestionTooltipContent(question: ConfigQuestion): boolean {
  return Boolean(
    cleanText(question.tooltip?.definition) ||
    cleanText(question.tooltip?.why) ||
    getQuestionTooltipExplanation(question)
  );
}
