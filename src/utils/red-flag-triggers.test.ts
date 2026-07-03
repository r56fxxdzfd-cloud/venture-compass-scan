import { describe, expect, it } from 'vitest';
import type { ConfigRedFlag } from '@/types/darwin';
import { formatRedFlagTriggers } from './red-flag-triggers';

describe('red flag trigger formatter', () => {
  it('renders high customer concentration with greater-than operators', () => {
    const redFlag: ConfigRedFlag = {
      code: 'RF_CUSTOMER_CONC',
      label: 'Concentração alta de receita',
      severity: 'high',
      triggers: [
        { type: 'numeric_threshold', field: 'revenue_concentration_top1_pct', op: '>', value: 60 },
        { type: 'numeric_threshold', field: 'revenue_concentration_top3_pct', op: '>', value: 80 },
      ],
      actions: [],
    };

    expect(formatRedFlagTriggers(redFlag)).toBe(
      'Dispara quando Concentração top 1 cliente (%) > 60% ou Concentração top 3 clientes (%) > 80%.'
    );
  });

  it('renders legacy customer concentration thresholds without op as greater-than', () => {
    const redFlag: ConfigRedFlag = {
      code: 'RF_CUSTOMER_CONC',
      label: 'Concentração alta de receita',
      severity: 'high',
      triggers: [
        { type: 'numeric_threshold', field: 'revenue_concentration_top1_pct', value: 60 },
      ],
      actions: [],
    };

    expect(formatRedFlagTriggers(redFlag)).toBe('Dispara quando Concentração top 1 cliente (%) > 60%.');
  });

  it('renders value_by_stage thresholds without a placeholder dash', () => {
    const redFlag: ConfigRedFlag = {
      code: 'RF_RUNWAY_LOW',
      label: 'Runway baixo',
      severity: 'high',
      triggers: [
        {
          type: 'numeric_threshold',
          field: 'runway_months',
          op: '<',
          value_by_stage: { pre_seed: 6, seed: 9, series_a: 12 },
        },
      ],
      actions: [],
    };

    expect(formatRedFlagTriggers(redFlag)).toBe(
      'Dispara quando Runway (meses) fica abaixo do limite por estágio: Pre-seed < 6 meses; Seed < 9 meses; Série A < 12 meses.'
    );
  });

  it('uses and when a red flag declares all trigger matching', () => {
    const redFlag: ConfigRedFlag = {
      code: 'RF_KEYPERSON',
      label: 'Dependência de pessoa-chave',
      severity: 'high',
      trigger_match: 'all',
      triggers: [
        { type: 'question_score_below', question_id: 'PL01', op: '<=', value: 2 },
        { type: 'question_score_below', question_id: 'PM02', op: '<=', value: 2 },
      ],
      actions: [],
    };

    expect(formatRedFlagTriggers(redFlag)).toBe('Dispara quando PL01 <= 2 e PM02 <= 2.');
  });
});
