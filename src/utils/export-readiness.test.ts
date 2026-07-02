import { describe, expect, it } from 'vitest';
import type { Assessment, AssessmentResult, ConfigJSON } from '@/types/darwin';
import { getMissingReportSections, validateReportExportReadiness } from './export-readiness';

const config = {
  dimensions: [{ id: 'MN', label: 'Modelo de Negócio', sort_order: 1 }],
  questions: [{ id: 'q1', dimension_id: 'MN', text: 'Modelo validado?', sort_order: 1 }],
  weights_by_stage: { seed: { MN: 1 } },
  targets_by_stage: { seed: { MN: 3.5 } },
  methodology: '',
  simulator: { presets: [] },
} satisfies ConfigJSON;

const assessment = {
  id: 'assessment_1',
  company_id: 'company_1',
  config_version_id: 'config_1',
  status: 'completed',
  is_simulation: false,
  stage: 'seed',
  business_model: null,
  customer_type: 'B2B',
  revenue_model: 'subscription',
  context_numeric: {},
  created_by: null,
  created_at: '2026-07-01T00:00:00.000Z',
  completed_at: '2026-07-01T01:00:00.000Z',
} satisfies Assessment;

const result = {
  overall_score: 3,
  overall_weighted: 3,
  dimension_scores: [
    { dimension_id: 'MN', label: 'Modelo de Negócio', score: 3, target: 3.5, coverage: 1, answered: 1, total: 1 },
  ],
  red_flags: [],
  strengths: [],
  gaps: [],
  recommendations: [],
} as unknown as AssessmentResult;

describe('report export readiness', () => {
  it('accepts a complete PPTX export payload', () => {
    expect(validateReportExportReadiness({ kind: 'pptx', assessment, config, result })).toEqual({ ok: true, errors: [] });
  });

  it('requires visual sections for Word exports with embedded charts', () => {
    const doc = {
      getElementById: (id: string) => id === 'section-radar' ? ({ id } as HTMLElement) : null,
    };

    expect(getMissingReportSections(doc)).toEqual(['matriz risco x impacto', 'blocos de score']);
    expect(validateReportExportReadiness({ kind: 'docx', assessment, config, result, doc })).toMatchObject({ ok: false });
  });
});
