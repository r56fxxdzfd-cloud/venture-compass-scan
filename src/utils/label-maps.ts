/** Human-readable labels for context field names */
export const CONTEXT_FIELD_LABELS: Record<string, string> = {
  runway_months: 'Runway (meses)',
  burn_monthly: 'Burn mensal (R$)',
  headcount: 'Headcount',
  gross_margin_pct: 'Margem bruta (%)',
  cac: 'CAC (R$)',
  ltv: 'LTV (R$)',
  revenue_concentration_top1_pct: 'Concentração top 1 cliente (%)',
  revenue_concentration_top3_pct: 'Concentração top 3 clientes (%)',
  investment: 'Investimento captado (R$)',
};

/** Convert snake_case to Sentence case as fallback */
export function humanizeFieldName(field: string): string {
  return CONTEXT_FIELD_LABELS[field] ?? field.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}

/** Abbreviated dimension codes */
export const DIMENSION_ABBREV: Record<string, string> = {
  inovacao_competitividade: 'IC',
  produto_plataforma: 'PL',
  growth_receita: 'GR',
  eficiencia_economica: 'EE',
  pessoas_management: 'PM',
  fundraising: 'FS',
  modelo_negocios: 'MN',
  go_to_market: 'GT',
  produto_tech: 'PT',
};

/** Get short label for legend: if > maxLen, try abbreviation, else truncate */
export function shortDimensionLabel(id: string, label: string, maxLen = 22): string {
  if (label.length <= maxLen) return label;
  return DIMENSION_ABBREV[id] || label.slice(0, maxLen - 1) + '…';
}

/** Effort tooltip descriptions */
export const EFFORT_TOOLTIPS: Record<string, string> = {
  S: 'Esforço pequeno — horas ou 1-2 dias',
  M: 'Esforço médio — alguns dias',
  L: 'Esforço grande — semanas',
};
