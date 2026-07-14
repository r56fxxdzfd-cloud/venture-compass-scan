import { describe, expect, it } from 'vitest';
import type { AssessmentResult, ConfigJSON } from '@/types/darwin';
import { computeParetoActions, selectTop5 } from './pareto-engine';

const config: ConfigJSON = {
  dimensions: [
    { id: 'GT', label: 'Go-to-market & Tração', sort_order: 1 },
    { id: 'PT', label: 'Produto & Tecnologia', sort_order: 2 },
  ],
  questions: [],
  weights_by_stage: { seed: { GT: 2, PT: 1 } },
  targets_by_stage: { seed: { GT: 3.5, PT: 3.5 } },
  methodology: '',
  simulator: { presets: [] },
  action_library: {
    GT: [
      { id: 'GT-01', title: 'Definir North Star Metric', description: '', first_step: '', done_definition: '', effort: 'S', time_to_impact_days: 3, impact_weight: 5, stage_tags: ['seed'], business_model_tags: [], dimension_id: 'GT' },
    ],
    PT: [
      { id: 'PT-01', title: 'Adotar metodologia ágil simplificada', description: '', first_step: '', done_definition: '', effort: 'S', time_to_impact_days: 5, impact_weight: 5, stage_tags: ['seed'], business_model_tags: [], dimension_id: 'PT' },
    ],
  },
};

const result: AssessmentResult = {
  overall_score: 3,
  overall_weighted: 3,
  dimension_scores: [
    { dimension_id: 'GT', label: 'Go-to-market & Tração', score: 2, target: 3.5, coverage: 1, answered: 5, total: 5 },
    { dimension_id: 'PT', label: 'Produto & Tecnologia', score: 4, target: 3.5, coverage: 1, answered: 5, total: 5 },
  ],
  red_flags: [],
  deep_dive_dimensions: [],
  strengths: [],
  gaps: [],
  recommendations: [],
} as AssessmentResult;

describe('pareto quick wins', () => {
  it('does not include strong dimensions only to satisfy block diversity', () => {
    const scored = computeParetoActions(config, result, 'seed');
    const top5 = selectTop5(scored, result, config);

    expect(top5.map((action) => action.id)).toEqual(['GT-01']);
    expect(top5).not.toContainEqual(expect.objectContaining({ id: 'PT-01' }));
  });
});
