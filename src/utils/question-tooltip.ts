import type { ConfigQuestion } from '@/types/darwin';

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

  return 'Use esta pergunta para transformar o enunciado em evidências observáveis: prática recorrente, responsável claro, dados ou documentos de apoio e impacto em decisões recentes. Ao responder, diferencie intenção ou plano futuro de algo já aplicado na operação.';
}

export function hasQuestionTooltipContent(question: ConfigQuestion): boolean {
  return Boolean(
    cleanText(question.tooltip?.definition) ||
    cleanText(question.tooltip?.why) ||
    getQuestionTooltipExplanation(question)
  );
}
