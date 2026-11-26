export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(
  amount: number,
  currency: string = 'EUR',
  options?: { compact?: boolean; showSign?: boolean }
): string {
  const rounded = roundCurrency(amount);
  const absVal = Math.abs(rounded);
  const hasDecimals = Math.abs(absVal - Math.round(absVal)) > 0.001;

  const formatter = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: options?.compact && !hasDecimals ? 0 : hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });

  const formatted = formatter.format(absVal);

  if (rounded < 0) {
    return `−${formatted}`;
  }
  if (options?.showSign && rounded > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

export function formatPercent(value: number, decimals: number = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(decimals).replace('.', ',')}%`;
}

export function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function parseMonthKey(monthKey: string): { year: number; monthIndex: number } {
  const [yearStr, monthStr] = monthKey.split('-');
  return {
    year: Number(yearStr),
    monthIndex: Number(monthStr) - 1,
  };
}

export function formatMonthLabel(monthKey: string, short: boolean = false): string {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const date = new Date(year, monthIndex, 1);
  const raw = new Intl.DateTimeFormat('fr-FR', {
    month: short ? 'short' : 'long',
    year: short ? undefined : 'numeric',
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(d);
}

export function toISODateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const d = new Date(year, monthIndex + deltaMonths, 1);
  return getMonthKey(d);
}
