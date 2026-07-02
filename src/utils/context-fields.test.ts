import { describe, expect, it } from 'vitest';
import { CONTEXT_NUMERIC_FIELDS, formatContextNumericInput, parseContextNumericInput } from './context-fields';

const field = (key: string) => {
  const found = CONTEXT_NUMERIC_FIELDS.find((item) => item.key === key);
  if (!found) throw new Error(`Missing field ${key}`);
  return found;
};

describe('context numeric fields', () => {
  it('parses Brazilian currency, percent, and thousand separators', () => {
    expect(parseContextNumericInput('R$ 85.000', field('burn_monthly'))).toBe(85000);
    expect(parseContextNumericInput('R$ 3.500', field('cac'))).toBe(3500);
    expect(parseContextNumericInput('68%', field('gross_margin_pct'))).toBe(68);
    expect(parseContextNumericInput('1.000', field('headcount'))).toBe(1000);
  });

  it('formats context values for user-facing inputs', () => {
    expect(formatContextNumericInput(field('burn_monthly'), '85000')).toBe('R$ 85.000');
    expect(formatContextNumericInput(field('gross_margin_pct'), '68')).toBe('68%');
    expect(formatContextNumericInput(field('runway_months'), '10')).toBe('10');
  });
});
