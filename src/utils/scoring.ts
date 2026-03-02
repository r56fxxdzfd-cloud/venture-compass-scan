import { DimensionScore, AssessmentResult, EvaluatedRedFlag, ConfigJSON, Answer, RedFlagTrigger } from '@/types/darwin';

export function calculateDimensionScores(
  configJson: ConfigJSON,
  answers: Answer[],
  stage: string
): DimensionScore[] {
  const rawTargets = configJson.targets_by_stage?.[stage] || {};
  // targets_by_stage values can be numbers or objects like {benchmark: N, potential: N}
  const targets: Record<string, number> = {};
  for (const [k, v] of Object.entries(rawTargets)) {
    targets[k] = typeof v === 'number' ? v : (typeof v === 'object' && v !== null ? ((v as any).benchmark ?? 3.5) : 3.5);
  }

  return configJson.dimensions.map((dim) => {
    const dimQuestions = configJson.questions.filter(
      (q) => q.dimension_id === dim.id && q.is_active !== false
    );
    const dimAnswers = answers.filter((a) =>
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
  assessmentContext?: { revenue_model?: string; customer_type?: string; business_model?: string }
): EvaluatedRedFlag[] {
  if (!configJson.red_flags) return [];

  const checkRequires = (requires: RedFlagTrigger['requires']): boolean => {
    if (!requires || requires.length === 0) return true;
    return requires.every(req => {
      const val = (assessmentContext as any)?.[req.field] ?? contextNumeric[req.field];
      if (val === undefined || val === null) return false;
      if (req.op === 'in' && Array.isArray(req.value)) return (req.value as unknown[]).includes(val);
      if (req.op === '=' || req.op === 'eq') return val === req.value;
      return true;
    });
  };

  const getThreshold = (trigger: RedFlagTrigger, stg?: string): number | undefined => {
    if (trigger.value_by_stage && stg && trigger.value_by_stage[stg] !== undefined) {
      return trigger.value_by_stage[stg];
    }
    if (trigger.value !== undefined) return trigger.value;
    return trigger.threshold;
  };

  return configJson.red_flags.filter((rf) => {
    return rf.triggers.some((trigger) => {
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
            if (op === '<') return answer.value < (threshold ?? 2);
            return answer.value <= (threshold ?? 2);
          }
          // Fallback: dimension-based
          const ds = dimensionScores.find((d) => d.dimension_id === trigger.dimension_id);
          const threshold = getThreshold(trigger, stage);
          return ds && ds.score < (threshold ?? 2);
        }
        case 'dimension_score_below': {
          const ds = dimensionScores.find((d) => d.dimension_id === trigger.dimension_id);
          const threshold = getThreshold(trigger, stage);
          return ds && ds.score < (threshold ?? 2);
        }
        case 'numeric_threshold':
        case 'context_field_below': {
          const field = trigger.field || '';
          const val = contextNumeric[field];
          const threshold = getThreshold(trigger, stage);
          if (val === undefined || threshold === undefined) return false;
          const op = trigger.op || '<';
          if (op === '>') return val > threshold;
          if (op === '>=') return val >= threshold;
          if (op === '<=') return val <= threshold;
          return val < threshold;
        }
        case 'numeric_missing':
        case 'context_field_missing': {
          // Support fields_any: trigger if ANY of the listed fields is missing
          if (trigger.fields_any && trigger.fields_any.length > 0) {
            return trigger.fields_any.some(f => contextNumeric[f] === undefined || contextNumeric[f] === null);
          }
          return contextNumeric[trigger.field || ''] === undefined;
        }
        default:
          return false;
      }
    });
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
  const dimensionScores = calculateDimensionScores(configJson, answers, stage);
  const overall = calculateOverallScore(dimensionScores, configJson, stage);
  const redFlags = evaluateRedFlags(configJson, dimensionScores, answers, contextNumeric, stage, assessmentContext);

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
