import type { ConfigDimension, ConfigQuestion, ConfigRedFlag, RedFlagTrigger } from '@/types/darwin';
import { humanizeFieldName } from '@/utils/label-maps';

type TriggerMode = 'any' | 'all';

interface FormatOptions {
  dimensions?: ConfigDimension[];
  questions?: ConfigQuestion[];
  stageLabels?: Record<string, string>;
}

const DEFAULT_STAGE_LABELS: Record<string, string> = {
  pre_seed: 'Pre-seed',
  seed: 'Seed',
  series_a: 'Série A',
};

const OP_SYMBOLS: Record<string, string> = {
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
  '=': '=',
  eq: '=',
};

function normalizeMode(value: unknown): TriggerMode | null {
  if (value === true) return 'all';
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase();
  if (['all', 'and', 'every'].includes(normalized)) return 'all';
  if (['any', 'or', 'some'].includes(normalized)) return 'any';
  return null;
}

export function getRedFlagTriggerMode(redFlag: ConfigRedFlag): TriggerMode {
  const rf = redFlag as ConfigRedFlag & Record<string, unknown>;
  return (
    normalizeMode(rf.trigger_match) ||
    normalizeMode(rf.match) ||
    normalizeMode(rf.operator) ||
    normalizeMode(rf.logic) ||
    normalizeMode(rf.all) ||
    'any'
  );
}

function getOperator(trigger: RedFlagTrigger): string {
  if (trigger.op) return OP_SYMBOLS[trigger.op] || trigger.op;
  if (trigger.type === 'score_threshold' && trigger.question_id) return '<=';
  if (trigger.type === 'question_score_below') return '<=';
  if (trigger.type === 'requires') return '=';
  if (trigger.field?.startsWith('revenue_concentration_')) return '>';
  return '<';
}

function getThreshold(trigger: RedFlagTrigger): number | string {
  if (trigger.value !== undefined) return trigger.value;
  if (trigger.threshold !== undefined) return trigger.threshold;
  if (trigger.type === 'score_threshold' && trigger.question_id) return 2;
  if (trigger.type === 'question_score_below') return 2;
  if (trigger.type === 'dimension_score_below') return 2;
  return 2;
}

function formatThreshold(value: number | string, field?: string): string {
  const suffix = field?.includes('_pct') ? '%' : field === 'runway_months' ? ' meses' : '';
  return `${value}${suffix}`;
}

function getDimensionLabel(dimensionId: string | undefined, dimensions: ConfigDimension[] | undefined): string {
  if (!dimensionId) return 'dimensão não informada';
  return dimensions?.find((dimension) => dimension.id === dimensionId)?.label || dimensionId;
}

function getQuestionLabel(questionId: string | undefined, questions: ConfigQuestion[] | undefined): string {
  if (!questionId) return 'pergunta não informada';
  const question = questions?.find((item) => item.id === questionId);
  return question?.id || questionId;
}

function getFieldLabel(field: string | undefined, options: FormatOptions): string {
  if (!field) return 'campo não informado';
  const question = options.questions?.find((item) => item.id === field);
  if (question) return question.id;
  return humanizeFieldName(field);
}

function formatValueList(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value);
}

function formatCondition(condition: { field?: string; question_id?: string; op?: string; value?: unknown }, options: FormatOptions): string {
  const field = condition.question_id || condition.field;
  const label = getFieldLabel(field, options);
  const op = condition.op || 'eq';

  if (op === 'in') return `${label} em [${formatValueList(condition.value)}]`;
  if (op === 'not_in') return `${label} fora de [${formatValueList(condition.value)}]`;
  if (op === 'answered') return `${label} respondida`;
  if (op === 'na') return `${label} marcada como N/A`;

  const symbol = OP_SYMBOLS[op] || op;
  return `${label} ${symbol} ${formatValueList(condition.value)}`;
}

function formatLooseCondition(value: unknown, options: FormatOptions): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatLooseCondition(item, options)).join(' e ');
  }
  if (value && typeof value === 'object') {
    const condition = value as { field?: string; question_id?: string; op?: string; value?: unknown };
    if (condition.field || condition.question_id) return formatCondition(condition, options);
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${humanizeFieldName(key)} = ${formatValueList(item)}`)
      .join(' e ');
  }
  return String(value);
}

function appendExtraConditions(sentence: string, trigger: RedFlagTrigger, options: FormatOptions): string {
  const extra: string[] = [];
  if (trigger.requires?.length) {
    extra.push(`requer ${trigger.requires.map((condition) => formatCondition(condition, options)).join(' e ')}`);
  }

  const loose = trigger as RedFlagTrigger & Record<string, unknown>;
  if (loose.show_if) extra.push(`visível quando ${formatLooseCondition(loose.show_if, options)}`);
  if (loose.show_if_rf) extra.push(`visível quando a red flag ${String(loose.show_if_rf)} estiver ativa`);
  if (loose.show_if_score_below) extra.push(`visível quando o score estiver abaixo de ${String(loose.show_if_score_below)}`);

  if (extra.length === 0) return sentence;
  return `${sentence} (${extra.join('; ')})`;
}

function formatValueByStage(trigger: RedFlagTrigger, options: FormatOptions): string {
  const op = getOperator(trigger);
  const field = trigger.field;
  const fieldLabel = getFieldLabel(field, options);
  const stageLabels = { ...DEFAULT_STAGE_LABELS, ...options.stageLabels };
  const values = Object.entries(trigger.value_by_stage || {})
    .map(([stage, value]) => `${stageLabels[stage] || stage} ${op} ${formatThreshold(value, field)}`)
    .join('; ');
  const direction = op === '>' || op === '>=' ? 'acima' : 'abaixo';
  return `Dispara quando ${fieldLabel} fica ${direction} do limite por estágio: ${values}`;
}

export function formatRedFlagTrigger(trigger: RedFlagTrigger, options: FormatOptions = {}): string {
  if (trigger.value_by_stage && Object.keys(trigger.value_by_stage).length > 0) {
    return `${appendExtraConditions(formatValueByStage(trigger, options), trigger, options)}.`;
  }

  const op = getOperator(trigger);
  const threshold = getThreshold(trigger);
  let sentence: string;

  switch (trigger.type) {
    case 'score_threshold':
      if (trigger.question_id) {
        sentence = `Dispara quando ${getQuestionLabel(trigger.question_id, options.questions)} ${op} ${formatThreshold(threshold)}`;
      } else {
        sentence = `Dispara quando o score da dimensão "${getDimensionLabel(trigger.dimension_id, options.dimensions)}" ${op} ${formatThreshold(threshold)}`;
      }
      break;
    case 'dimension_score_below':
      sentence = `Dispara quando o score da dimensão "${getDimensionLabel(trigger.dimension_id, options.dimensions)}" ${op} ${formatThreshold(threshold)}`;
      break;
    case 'question_score_below':
      sentence = `Dispara quando ${getQuestionLabel(trigger.question_id, options.questions)} ${op} ${formatThreshold(threshold)}`;
      break;
    case 'numeric_threshold':
    case 'context_field_below':
      sentence = `Dispara quando ${getFieldLabel(trigger.field, options)} ${op} ${formatThreshold(threshold, trigger.field)}`;
      break;
    case 'numeric_missing':
    case 'context_field_missing':
      if (trigger.fields_any?.length) {
        sentence = `Dispara quando qualquer um dos campos ${trigger.fields_any.map((field) => getFieldLabel(field, options)).join(', ')} não estiver informado`;
      } else {
        sentence = `Dispara quando ${getFieldLabel(trigger.field, options)} não estiver informado`;
      }
      break;
    case 'requires':
      sentence = `Dispara quando ${formatCondition(trigger, options)}`;
      break;
    case 'red_flag_triggered': {
      const loose = trigger as RedFlagTrigger & Record<string, unknown>;
      const code = loose.code || loose.red_flag_code || loose.value;
      sentence = code ? `Dispara quando a red flag ${String(code)} estiver ativa` : 'Dispara quando qualquer red flag configurada estiver ativa';
      break;
    }
    default: {
      const fallbackType = (trigger as { type?: string }).type;
      sentence = fallbackType ? `Dispara por regra ${fallbackType.replace(/_/g, ' ')}` : 'Gatilho configurado';
    }
  }

  return `${appendExtraConditions(sentence, trigger, options)}.`;
}

export function formatRedFlagTriggers(redFlag: ConfigRedFlag, options: FormatOptions = {}): string {
  const joiner = getRedFlagTriggerMode(redFlag) === 'all' ? ' e ' : ' ou ';
  const prefix = 'Dispara quando ';
  const parts = redFlag.triggers.map((trigger) => formatRedFlagTrigger(trigger, options).replace(/\.$/, ''));
  if (parts.length > 1 && parts.every((part) => part.startsWith(prefix))) {
    return `${prefix}${parts.map((part) => part.slice(prefix.length)).join(joiner)}.`;
  }
  return parts.join(joiner) + '.';
}
