import type { Answer, ConfigJSON, ConfigQuestion } from '@/types/darwin';

export type QuestionSkipOperator = '<' | '<=' | '>' | '>=' | '=' | 'eq' | 'in' | 'not_in' | 'answered' | 'na';
export type ContextSkipOperator = '=' | 'eq' | 'in' | 'not_in';

export interface AssessmentQuestionContext {
  revenue_model?: string | null;
  customer_type?: string | null;
  business_model?: string | null;
}

export interface QuestionSkipRule {
  question_id: string;
  op?: QuestionSkipOperator;
  value?: number | string | boolean | Array<number | string | boolean>;
  reason?: string;
}

export interface ContextSkipRule {
  field: keyof AssessmentQuestionContext | string;
  op?: ContextSkipOperator;
  value?: string | string[];
  reason?: string;
}

export interface SkippedQuestion {
  question: ConfigQuestion;
  rule: QuestionSkipRule | ContextSkipRule;
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

function normalizeContextRules(value: unknown): ContextSkipRule[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ContextSkipRule => {
    if (!item || typeof item !== 'object') return false;
    const maybeRule = item as Partial<ContextSkipRule>;
    return typeof maybeRule.field === 'string' && maybeRule.field.length > 0;
  });
}

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function getQuestionContextSkipRules(question: ConfigQuestion): ContextSkipRule[] {
  const directRules = normalizeContextRules((question as ConfigQuestion & { skip_if_context?: unknown }).skip_if_context);
  const tagRules = normalizeContextRules((question.tags as { skip_if_context?: unknown } | undefined)?.skip_if_context);
  const rules = [...directRules, ...tagRules];
  const text = normalizeText(question.text);

  if (text.includes('condicional') && text.includes('recorrente')) {
    rules.push({
      field: 'revenue_model',
      op: 'in',
      value: ['non_recurring'],
      reason: 'Pergunta aplicável apenas a modelos recorrentes.',
    });
  }

  if (text.includes('condicional') && text.includes('b2b')) {
    rules.push({
      field: 'customer_type',
      op: 'not_in',
      value: ['B2B', 'B2B2C'],
      reason: 'Pergunta aplicável apenas a modelos com venda B2B.',
    });
  }

  return rules;
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

function compareContext(context: AssessmentQuestionContext | undefined, rule: ContextSkipRule): boolean {
  if (!context) return false;
  const contextValue = context[rule.field as keyof AssessmentQuestionContext];
  if (contextValue === undefined || contextValue === null || contextValue === '') return false;
  const op = rule.op || 'eq';

  if (op === 'in' && Array.isArray(rule.value)) return rule.value.includes(String(contextValue));
  if (op === 'not_in' && Array.isArray(rule.value)) return !rule.value.includes(String(contextValue));
  return String(contextValue) === String(rule.value);
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

export function getSkippedQuestions(
  config: ConfigJSON,
  answers: Answer[],
  context?: AssessmentQuestionContext
): SkippedQuestion[] {
  const answersByQuestion = mapAnswersByQuestion(answers);
  const activeQuestions = config.questions.filter((question) => question.is_active !== false);
  const skipped = new Map<string, QuestionSkipRule>();
  const skippedByContext = new Map<string, ContextSkipRule>();
  let changed = true;

  while (changed) {
    changed = false;
    activeQuestions.forEach((question) => {
      if (skipped.has(question.id) || skippedByContext.has(question.id)) return;

      const triggeredContextRule = getQuestionContextSkipRules(question).find((rule) => compareContext(context, rule));
      if (triggeredContextRule) {
        skippedByContext.set(question.id, triggeredContextRule);
        changed = true;
        return;
      }

      const triggeredRule = getQuestionSkipRules(question).find((rule) => {
        if (skipped.has(rule.question_id) || skippedByContext.has(rule.question_id)) return false;
        return compareAnswer(answersByQuestion[rule.question_id], rule);
      });

      if (triggeredRule) {
        skipped.set(question.id, triggeredRule);
        changed = true;
      }
    });
  }

  return activeQuestions
    .filter((question) => skipped.has(question.id) || skippedByContext.has(question.id))
    .map((question) => ({ question, rule: skipped.get(question.id) || skippedByContext.get(question.id)! }));
}

export function getAnswerableQuestions(
  config: ConfigJSON,
  answers: Answer[],
  context?: AssessmentQuestionContext
): ConfigQuestion[] {
  const skippedIds = new Set(getSkippedQuestions(config, answers, context).map((item) => item.question.id));
  return config.questions.filter((question) => question.is_active !== false && !skippedIds.has(question.id));
}

export function filterSkippedAnswers(
  config: ConfigJSON,
  answers: Answer[],
  context?: AssessmentQuestionContext
): Answer[] {
  const answerableIds = new Set(getAnswerableQuestions(config, answers, context).map((question) => question.id));
  return answers.filter((answer) => answerableIds.has(answer.question_id));
}
