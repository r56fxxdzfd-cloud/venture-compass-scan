import type { Assessment, AssessmentResult, ConfigJSON } from '@/types/darwin';

export type ExportKind = 'pptx' | 'docx';

const requiredDocxSections = [
  { id: 'section-radar', label: 'radar chart' },
  { id: 'section-matrix', label: 'matriz risco x impacto' },
  { id: 'section-blocks', label: 'blocos de score' },
];

export function getMissingReportSections(doc: Pick<Document, 'getElementById'>): string[] {
  return requiredDocxSections
    .filter((section) => !doc.getElementById(section.id))
    .map((section) => section.label);
}

export function validateReportExportReadiness({
  kind,
  assessment,
  config,
  result,
  doc,
}: {
  kind: ExportKind;
  assessment: Assessment | null | undefined;
  config: ConfigJSON | null | undefined;
  result: AssessmentResult | null | undefined;
  doc?: Pick<Document, 'getElementById'>;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!assessment) errors.push('diagnóstico não carregado');
  if (!config) errors.push('configuração não carregada');
  if (!result) errors.push('resultado não calculado');
  if (config && (!config.dimensions?.length || !config.questions?.length)) {
    errors.push('configuração sem dimensões ou perguntas');
  }
  if (result && !result.dimension_scores?.length) {
    errors.push('scores por dimensão não disponíveis');
  }

  if (kind === 'docx' && doc) {
    const missingSections = getMissingReportSections(doc);
    if (missingSections.length > 0) {
      errors.push(`seções visuais ausentes: ${missingSections.join(', ')}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
