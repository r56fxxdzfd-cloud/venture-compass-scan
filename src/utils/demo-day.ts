import type { DemoDayDate } from '@/types/darwin';

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function getDemoDayDateLabel(date: Pick<DemoDayDate, 'title' | 'date_label'>) {
  if (date.date_label?.trim()) return date.date_label.trim();

  const title = normalizeText(date.title);
  if (title.includes('sao paulo') && title.includes('opcao 1')) {
    return '22 ou 23 de julho de 2026';
  }
  if (title.includes('sao paulo') && title.includes('opcao 2')) {
    return '28 ou 30 de julho de 2026';
  }

  return '';
}
