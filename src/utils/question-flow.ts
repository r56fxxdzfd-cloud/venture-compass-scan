import type { Answer, ConfigJSON, ConfigQuestion } from '@/types/darwin';

export type QuestionSkipOperator = '<' | '<=' | '>' | '>=' | '=' | 'eq' | 'in' | 'not_in' | 'answered' | 'na';

export interface QuestionSkipRule {
  question_id: string;
  op?: QuestionSkipOperator;
  value?: number | string | boolean | Array<number | string | boolean>;
  reason?: string;
}

export interface SkippedQuestion {
  question: ConfigQuestion;
  rule: QuestionSkipRule;
}

function normalizeRules(value: unknown): QuestionSkipRule[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is QuestionSkipRule => {
    if (!item || typeof item !== 'object') return false;
    const maybeRule = item as Partial<QuestionSkipRule>;
    return typeof maybeRule.question_id === 'string' && maybeRule.question_id.length > 0;
  });
}

export function getQuestionSkipRules(question: ConfigQuestion): QuestionSkipRule[] {
  const directRules = normalizeRules((question as ConfigQuestion & { skip_if?: unknown }).skip_if);
  const tagRules = normalizeRules((question.tags as { skip_if?: unknown } | undefined)?.skip_if);
  return [...directRules, ...tagRules];
}

function compareAnswer(answer: { value: number | null; is_na: boolean } | undefined, rule: QuestionSkipRule): boolean {
  const op = rule.op || '<=';
  if (op === 'answered') return !!answer && (answer.value !== null || answer.is_na);
  if (op === 'na') return !!answer?.is_na;
  if (!answer || answer.value === null || answer.is_na) return false;

  const answerValue = answer.value;
  if (op === 'in' && Array.isArray(rule.value)) return rule.value.includes(answerValue);
  if (op === 'not_in' && Array.isArray(rule.value)) return !rule.value.includes(answerValue);
  if (typeof rule.value !== 'number') return false;
  if (op === '<') return answerValue < rule.value;
  if (op === '<=') return answerValue <= rule.value;
  if (op === '>') return answerValue > rule.value;
  if (op === '>=') return answerValue >= rule.value;
  return answerValue === rule.value;
}

export function getTriggeredSkipRule(
  question: ConfigQuestion,
  answersByQuestion: Record<string, { value: number | null; is_na: boolean }>
): QuestionSkipRule | null {
  return getQuestionSkipRules(question).find((rule) => compareAnswer(answersByQuestion[rule.question_id], rule)) || null;
}

export function mapAnswersByQuestion(answers: Answer[]): Record<string, { value: number | null; is_na: boolean }> {
  return answers.reduce<Record<string, { value: number | null; is_na: boolean }>>((acc, answer) => {
    acc[answer.question_id] = { value: answer.value, is_na: answer.is_na };
    return acc;
  }, {});
}

export function getSkippedQuestions(config: ConfigJSON, answers: Answer[]): SkippedQuestion[] {
  const answersByQuestion = mapAnswersByQuestion(answers);
  const activeQuestions = config.questions.filter((question) => question.is_active !== false);
  const skipped = new Map<string, QuestionSkipRule>();
  let changed = true;

  while (changed) {
    changed = false;
    activeQuestions.forEach((question) => {
      if (skipped.has(question.id)) return;

      const triggeredRule = getQuestionSkipRules(question).find((rule) => {
        if (skipped.has(rule.question_id)) return false;
        return compareAnswer(answersByQuestion[rule.question_id], rule);
      });

      if (triggeredRule) {
        skipped.set(question.id, triggeredRule);
        changed = true;
      }
    });
  }

  return activeQuestions
    .filter((question) => skipped.has(question.id))
    .map((question) => ({ question, rule: skipped.get(question.id)! }));
}

export function getAnswerableQuestions(config: ConfigJSON, answers: Answer[]): ConfigQuestion[] {
  const skippedIds = new Set(getSkippedQuestions(config, answers).map((item) => item.question.id));
  return config.questions.filter((question) => question.is_active !== false && !skippedIds.has(question.id));
}

export function filterSkippedAnswers(config: ConfigJSON, answers: Answer[]): Answer[] {
  const answerableIds = new Set(getAnswerableQuestions(config, answers).map((question) => question.id));
  return answers.filter((answer) => answerableIds.has(answer.question_id));
}
