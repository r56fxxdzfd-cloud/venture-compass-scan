// Campos numéricos de contexto do diagnóstico (financeiro/operacional).
// Fonte única de verdade — usada na criação, na edição pós-criação e no
// aviso de "dados não informados" do relatório.
export interface ContextNumericField {
  key: string;
  label: string;
}

export const CONTEXT_NUMERIC_FIELDS: ContextNumericField[] = [
  { key: 'runway_months', label: 'Runway (meses)' },
  { key: 'burn_monthly', label: 'Burn Mensal (R$)' },
  { key: 'headcount', label: 'Headcount' },
  { key: 'gross_margin_pct', label: 'Margem Bruta (%)' },
  { key: 'cac', label: 'CAC (R$)' },
  { key: 'ltv', label: 'LTV (R$)' },
  { key: 'revenue_concentration_top1_pct', label: 'Concentração Top 1 cliente (%)' },
  { key: 'revenue_concentration_top3_pct', label: 'Concentração Top 3 clientes (%)' },
];

// Quais campos de contexto não foram informados em um assessment.
export function missingContextFields(contextNumeric: Record<string, number> | null | undefined): ContextNumericField[] {
  const ctx = contextNumeric || {};
  return CONTEXT_NUMERIC_FIELDS.filter((f) => ctx[f.key] === undefined || ctx[f.key] === null);
}
