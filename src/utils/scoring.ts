import { DimensionScore, AssessmentResult, EvaluatedRedFlag, ConfigJSON, Answer, RedFlagTrigger, StageTarget } from '@/types/darwin';
import { filterSkippedAnswers, getAnswerableQuestions, type AssessmentQuestionContext } from '@/utils/question-flow';
import { getRedFlagTriggerMode } from '@/utils/red-flag-triggers';

function resolveBenchmarkTarget(target: StageTarget | undefined, fallback = 3.5): number {
  if (typeof target === 'number' && Number.isFinite(target)) return target;
  if (target && typeof target.benchmark === 'number' && Number.isFinite(target.benchmark)) {
    return target.benchmark;
  }
  return fallback;
}

export function calculateDimensionScores(
  configJson: ConfigJSON,
  answers: Answer[],
  stage: string,
  assessmentContext?: AssessmentQuestionContext
): DimensionScore[] {
  const rawTargets = configJson.targets_by_stage?.[stage] || {};
  const targets: Record<string, number> = {};
  for (const [k, v] of Object.entries(rawTargets)) {
    targets[k] = resolveBenchmarkTarget(v);
  }
  const answerableQuestions = getAnswerableQuestions(configJson, answers, assessmentContext);
  const effectiveAnswers = filterSkippedAnswers(configJson, answers, assessmentContext);

  return configJson.dimensions.map((dim) => {
    const dimQuestions = answerableQuestions.filter(
      (q) => q.dimension_id === dim.id && q.is_active !== false
    );
    const dimAnswers = effectiveAnswers.filter((a) =>
      dimQuestions.some((q) => q.id === a.question_id) && !a.is_na && a.value !== null
    );

    const score = dimAnswers.length > 0
      ? dimAnswers.reduce((sum, a) => sum + (a.value || 0), 0) / dimAnswers.length
      : 0;

    return {
      dimension_id: dim.id,
      label: dim.label,
      score: Math.round(score * 100) / 100,
      target: targets[dim.id] || 3.5,
      coverage: dimQuestions.length > 0 ? dimAnswers.length / dimQuestions.length : 0,
      answered: dimAnswers.length,
      total: dimQuestions.length,
    };
  });
}

export function calculateOverallScore(
  dimensionScores: DimensionScore[],
  configJson: ConfigJSON,
  stage: string
): number {
  const weights = configJson.weights_by_stage?.[stage] || {};
  const totalWeight = Object.values(weights).reduce((s, w) => s + (w as number), 0) || 1;

  return dimensionScores.reduce((sum, ds) => {
    const w = (weights[ds.dimension_id] as number) || 1;
    return sum + (ds.score * w) / totalWeight;
  }, 0);
}

export function evaluateRedFlags(
  configJson: ConfigJSON,
  dimensionScores: DimensionScore[],
  answers: Answer[],
  contextNumeric: Record<string, number>,
  stage?: string,
  assessmentContext?: AssessmentQuestionContext
): EvaluatedRedFlag[] {
  if (!configJson.red_flags) return [];

  const getConditionValue = (condition: { field?: string; question_id?: string }) => {
    const key = condition.question_id || condition.field || '';
    const contextValue = (assessmentContext as any)?.[key];
    if (contextValue !== undefined && contextValue !== null) return contextValue;
    const numericValue = contextNumeric[key];
    if (numericValue !== undefined && numericValue !== null) return numericValue;
    const answer = answers.find(a => a.question_id === key);
    if (!answer || answer.value === null || answer.is_na) return undefined;
    return answer.value;
  };

  const checkCondition = (condition: { field?: string; question_id?: string; op?: string; value?: unknown }): boolean => {
    const val = getConditionValue(condition);
    if (val === undefined || val === null) return false;
    const op = condition.op || 'eq';
    if (op === 'in' && Array.isArray(condition.value)) return (condition.value as unknown[]).includes(val);
    if (op === 'not_in' && Array.isArray(condition.value)) return !(condition.value as unknown[]).includes(val);
    if (op === '=' || op === 'eq') return val === condition.value;
    if (typeof val === 'number' && typeof condition.value === 'number') {
      if (op === '<') return val < condition.value;
      if (op === '<=') return val <= condition.value;
      if (op === '>') return val > condition.value;
      if (op === '>=') return val >= condition.value;
    }
    return false;
  };

  const checkRequires = (requires: RedFlagTrigger['requires']): boolean => {
    if (!requires || requires.length === 0) return true;
    return requires.every(checkCondition);
  };

  const getThreshold = (trigger: RedFlagTrigger, stg?: string): number | undefined => {
    if (trigger.value_by_stage && stg && trigger.value_by_stage[stg] !== undefined) {
      return trigger.value_by_stage[stg];
    }
    if (trigger.value !== undefined) return trigger.value;
    return trigger.threshold;
  };

  const compareNumber = (value: number, op: string, threshold: number): boolean => {
    if (op === '>') return value > threshold;
    if (op === '>=') return value >= threshold;
    if (op === '<=') return value <= threshold;
    if (op === '=' || op === 'eq') return value === threshold;
    return value < threshold;
  };

  const defaultNumericOperator = (trigger: RedFlagTrigger): string => {
    if (trigger.op) return trigger.op;
    if (trigger.field?.startsWith('revenue_concentration_')) return '>';
    return '<';
  };

  const evaluateTrigger = (trigger: RedFlagTrigger): boolean => {
    // Check requires conditions first
    if (!checkRequires(trigger.requires)) return false;

    switch (trigger.type) {
      case 'score_threshold':
      case 'question_score_below': {
        // Support question_id-based triggers (check individual answer)
        if (trigger.question_id) {
          const answer = answers.find(a => a.question_id === trigger.question_id);
          const threshold = getThreshold(trigger, stage);
          if (!answer || answer.value === null || answer.is_na) return false;
          const op = trigger.op || '<=';
          return compareNumber(answer.value, op, threshold ?? 2);
        }
        // Fallback: dimension-based
        const ds = dimensionScores.find((d) => d.dimension_id === trigger.dimension_id);
        const threshold = getThreshold(trigger, stage);
        return !!ds && compareNumber(ds.score, trigger.op || '<', threshold ?? 2);
      }
      case 'dimension_score_below': {
        const ds = dimensionScores.find((d) => d.dimension_id === trigger.dimension_id);
        const threshold = getThreshold(trigger, stage);
        return !!ds && compareNumber(ds.score, trigger.op || '<', threshold ?? 2);
      }
      case 'numeric_threshold':
      case 'context_field_below': {
        const field = trigger.field || '';
        const val = contextNumeric[field];
        const threshold = getThreshold(trigger, stage);
        if (val === undefined || threshold === undefined) return false;
        return compareNumber(val, defaultNumericOperator(trigger), threshold);
      }
      case 'numeric_missing':
      case 'context_field_missing': {
        // Support fields_any: trigger if ANY of the listed fields is missing
        if (trigger.fields_any && trigger.fields_any.length > 0) {
          return trigger.fields_any.some(f => contextNumeric[f] === undefined || contextNumeric[f] === null);
        }
        return contextNumeric[trigger.field || ''] === undefined;
      }
      case 'requires':
        return checkCondition(trigger);
      default:
        return false;
    }
  };

  return configJson.red_flags.filter((rf) => {
    const results = rf.triggers.map(evaluateTrigger);
    return getRedFlagTriggerMode(rf) === 'all' ? results.every(Boolean) : results.some(Boolean);
  }).map((rf) => ({
    code: rf.code,
    label: rf.label,
    severity: rf.severity,
    actions: rf.actions,
  }));
}

export function calculateAssessmentResult(
  configJson: ConfigJSON,
  answers: Answer[],
  stage: string,
  contextNumeric: Record<string, number>,
  assessmentContext?: { revenue_model?: string; customer_type?: string; business_model?: string }
): AssessmentResult {
  const effectiveAnswers = filterSkippedAnswers(configJson, answers, assessmentContext);
  const dimensionScores = calculateDimensionScores(configJson, effectiveAnswers, stage, assessmentContext);
  const overall = calculateOverallScore(dimensionScores, configJson, stage);
  const redFlags = evaluateRedFlags(configJson, dimensionScores, effectiveAnswers, contextNumeric, stage, assessmentContext);

  const deepDiveDimensions = dimensionScores
    .filter((ds) => ds.score > 0 && ds.score < 3.0)
    .map((ds) => ds.dimension_id);

  // Also add dimensions with red flags
  redFlags.forEach((rf) => {
    const relatedRf = configJson.red_flags?.find((r) => r.code === rf.code);
    relatedRf?.triggers.forEach((t) => {
      if (t.dimension_id && !deepDiveDimensions.includes(t.dimension_id)) {
        deepDiveDimensions.push(t.dimension_id);
      }
    });
  });

  return {
    overall_score: Math.round(overall * 100) / 100,
    overall_weighted: overall,
    dimension_scores: dimensionScores,
    red_flags: redFlags,
    deep_dive_dimensions: deepDiveDimensions,
  };
}
