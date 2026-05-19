export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

export function parseDateOnly(value: string): DateParts | null {
  if (!DATE_ONLY_PATTERN.test(value)) return null;

  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
}

export function formatDateOnlyBR(value?: string | null, fallback = 'Sem data') {
  if (!value) return fallback;

  const parts = parseDateOnly(value);
  if (!parts) return fallback;

  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
}

export function formatDateBR(value?: string | null, fallback = 'Sem data') {
  if (!value) return fallback;

  if (DATE_ONLY_PATTERN.test(value)) return formatDateOnlyBR(value, fallback);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getTodayDateOnly() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function isDateOnlyBefore(value: string, reference: string) {
  return DATE_ONLY_PATTERN.test(value) && DATE_ONLY_PATTERN.test(reference) && value < reference;
}
