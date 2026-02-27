import { DimensionScore, AssessmentResult, EvaluatedRedFlag, ConfigJSON, Answer } from '@/types/darwin';

export function calculateDimensionScores(
  configJson: ConfigJSON,
  answers: Answer[],
  stage: string
): DimensionScore[] {
  const targets = configJson.targets_by_stage?.[stage] || {};

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
  contextNumeric: Record<string, number>
): EvaluatedRedFlag[] {
  if (!configJson.red_flags) return [];

  return configJson.red_flags.filter((rf) => {
    return rf.triggers.some((trigger) => {
      switch (trigger.type) {
        case 'score_threshold': {
          const ds = dimensionScores.find((d) => d.dimension_id === trigger.dimension_id);
          return ds && ds.score < (trigger.threshold || 2);
        }
        case 'numeric_threshold': {
          const val = contextNumeric[trigger.field || ''];
          return val !== undefined && val < (trigger.threshold || 0);
        }
        case 'numeric_missing': {
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
  contextNumeric: Record<string, number>
): AssessmentResult {
  const dimensionScores = calculateDimensionScores(configJson, answers, stage);
  const overall = calculateOverallScore(dimensionScores, configJson, stage);
  const redFlags = evaluateRedFlags(configJson, dimensionScores, answers, contextNumeric);

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
