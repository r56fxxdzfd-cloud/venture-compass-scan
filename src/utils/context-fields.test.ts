import { describe, expect, it } from 'vitest';
import { CONTEXT_NUMERIC_FIELDS, formatContextNumericInput, noRedFlagsConclusion, parseContextNumericInput } from './context-fields';

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

describe('noRedFlagsConclusion — não afirmar o que não foi avaliado', () => {
  it('caso Planium: só headcount informado -> ressalva com as 7 variáveis', () => {
    const c = noRedFlagsConclusion({ headcount: 53 });
    expect(c.complete).toBe(false);
    expect(c.detail).toContain('Nenhum red flag foi acionado com os dados disponíveis');
    expect(c.detail).toContain('sete variáveis críticas não foram informadas');
    expect(c.detail).toContain('Runway (meses)');
    expect(c.detail).toContain('Concentração Top 3 clientes');
    // Não pode sugerir ausência de risco.
    expect(c.detail).not.toContain('Nenhum red flag foi identificado');
  });

  it('todos os dados informados -> conclusão limpa', () => {
    const c = noRedFlagsConclusion({
      runway_months: 10, burn_monthly: 85000, headcount: 8, gross_margin_pct: 68,
      cac: 3500, ltv: 28000, revenue_concentration_top1_pct: 22, revenue_concentration_top3_pct: 48,
    });
    expect(c.complete).toBe(true);
    expect(c.headline).toBe('Nenhum red flag identificado');
  });

  it('contexto vazio -> as 8 variáveis, no plural correto', () => {
    const c = noRedFlagsConclusion({});
    expect(c.complete).toBe(false);
    expect(c.detail).toContain('oito variáveis críticas não foram informadas');
    expect(c.headline).toContain('8 variáveis não informadas');
  });

  it('uma só faltando -> singular', () => {
    const c = noRedFlagsConclusion({
      runway_months: 10, burn_monthly: 85000, headcount: 8, gross_margin_pct: 68,
      cac: 3500, ltv: 28000, revenue_concentration_top1_pct: 22,
    });
    expect(c.detail).toContain('uma variável crítica não foi informada');
    expect(c.headline).toContain('1 variável não informada');
  });
});
