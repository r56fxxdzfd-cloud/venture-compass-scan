// Campos numéricos de contexto do diagnóstico (financeiro/operacional).
// Fonte única de verdade — usada na criação, na edição pós-criação e no
// aviso de "dados não informados" do relatório.
export interface ContextNumericField {
  key: string;
  label: string;
  format?: 'integer' | 'decimal' | 'currency' | 'percent';
  placeholder?: string;
}

export const CONTEXT_NUMERIC_FIELDS: ContextNumericField[] = [
  { key: 'runway_months', label: 'Runway (meses)', format: 'integer', placeholder: '10' },
  { key: 'burn_monthly', label: 'Burn Mensal', format: 'currency', placeholder: 'R$ 85.000' },
  { key: 'headcount', label: 'Headcount', format: 'integer', placeholder: '8' },
  { key: 'gross_margin_pct', label: 'Margem Bruta', format: 'percent', placeholder: '68%' },
  { key: 'cac', label: 'CAC', format: 'currency', placeholder: 'R$ 3.500' },
  { key: 'ltv', label: 'LTV', format: 'currency', placeholder: 'R$ 28.000' },
  { key: 'revenue_concentration_top1_pct', label: 'Concentração Top 1 cliente', format: 'percent', placeholder: '22%' },
  { key: 'revenue_concentration_top3_pct', label: 'Concentração Top 3 clientes', format: 'percent', placeholder: '48%' },
];

const decimalFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const integerFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export function parseContextNumericInput(value: string | number | null | undefined, field?: ContextNumericField): number {
  if (typeof value === 'number') return value;
  const raw = String(value ?? '').trim();
  if (!raw) return NaN;

  const cleaned = raw.replace(/[^\d,.-]/g, '');
  if (!cleaned) return NaN;

  const looksLikeThousands = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned);
  const shouldTreatDotAsThousands = field?.format === 'currency' || field?.format === 'percent' || cleaned.includes(',') || looksLikeThousands;
  const normalized = shouldTreatDotAsThousands
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/,/g, '');

  return Number(normalized);
}

export function formatContextNumericValue(field: ContextNumericField, value: string | number | null | undefined): string {
  const parsed = parseContextNumericInput(value, field);
  if (!Number.isFinite(parsed)) return '';

  if (field.format === 'currency') return currencyFormatter.format(parsed);
  if (field.format === 'percent') return `${decimalFormatter.format(parsed)}%`;
  if (field.format === 'integer') return integerFormatter.format(parsed);
  return decimalFormatter.format(parsed);
}

export function formatContextNumericInput(field: ContextNumericField, value: string): string {
  if (!value.trim()) return '';
  const formatted = formatContextNumericValue(field, value);
  return formatted || value;
}

export function getContextNumericInputMode(field: ContextNumericField): 'numeric' | 'decimal' {
  return field.format === 'integer' ? 'numeric' : 'decimal';
}

// Quais campos de contexto não foram informados em um assessment.
export function missingContextFields(contextNumeric: Record<string, number> | null | undefined): ContextNumericField[] {
  const ctx = contextNumeric || {};
  return CONTEXT_NUMERIC_FIELDS.filter((f) => ctx[f.key] === undefined || ctx[f.key] === null);
}
