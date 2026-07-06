import type { ConfigJSON, ConfigQuestion } from '@/types/darwin';

type AnswerMap = Record<string, { value: number | null; is_na: boolean }>;

function getOrderedDimensionQuestions(questions: ConfigQuestion[], dimensionId: string) {
  return questions
    .filter((question) => question.dimension_id === dimensionId && question.is_active !== false)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function getNextDimensionAfterCompletedQuestion({
  config,
  questionId,
  currentAnswerableQuestions,
  updatedAnswerableQuestions,
  updatedAnswers,
}: {
  config: ConfigJSON;
  questionId: string;
  currentAnswerableQuestions: ConfigQuestion[];
  updatedAnswerableQuestions: ConfigQuestion[];
  updatedAnswers: AnswerMap;
}) {
  const currentQuestion = currentAnswerableQuestions.find((question) => question.id === questionId);
  if (!currentQuestion) return '';

  const currentDimensionQuestions = getOrderedDimensionQuestions(currentAnswerableQuestions, currentQuestion.dimension_id);
  if (currentDimensionQuestions.at(-1)?.id !== questionId) return '';

  const updatedCurrentDimensionQuestions = getOrderedDimensionQuestions(updatedAnswerableQuestions, currentQuestion.dimension_id);
  const dimensionIsComplete = updatedCurrentDimensionQuestions.length > 0 && updatedCurrentDimensionQuestions.every((question) => {
    const answer = updatedAnswers[question.id];
    return answer && (answer.value !== null || answer.is_na);
  });
  if (!dimensionIsComplete) return '';

  const currentDimensionIndex = config.dimensions.findIndex((dimension) => dimension.id === currentQuestion.dimension_id);
  const nextDimension = config.dimensions
    .slice(currentDimensionIndex + 1)
    .find((dimension) => updatedAnswerableQuestions.some((question) => question.dimension_id === dimension.id && question.is_active !== false));

  return nextDimension?.id || '';
}

export function scrollQuestionnaireToTop() {
  requestAnimationFrame(() => {
    const scrollContainer = document.getElementById('app-main-scroll');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}
