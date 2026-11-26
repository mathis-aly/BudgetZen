import {
  CategoryDTO,
  MonthlyReportDTO,
  TransactionDTO,
} from './types';

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null;
}

/**
 * Formats a number using French decimal comma notation (e.g. 45.5 -> "45,50").
 */
export function formatCsvDecimal(value: number, decimals: number = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toFixed(decimals).replace('.', ',');
}

/**
 * Formats an ISO date string or Date object as DD/MM/YYYY ("JJ/MM/AAAA").
 */
export function formatCsvDate(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Escapes a single CSV cell value for semicolon-delimited UTF-8 CSV (Excel & Apple Numbers).
 */
function escapeCsvCell(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';

  const text =
    typeof raw === 'number'
      ? formatCsvDecimal(raw, 2)
      : String(raw);

  const needsQuotes =
    text.includes(';') ||
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r');

  if (!needsQuotes) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Pure generic CSV generator compatible with Microsoft Excel & Apple Numbers:
 * - UTF-8 BOM (\uFEFF) prefix for accent preservation on macOS/Windows
 * - Semicolon (;) column delimiter
 * - Proper RFC 4180 quoting/escaping for quotes, semicolons, and line breaks
 * - Decimal numbers formatted with French comma
 */
export function convertToCSV<T>(
  data: T[],
  columns: { header: string; accessor: (row: T) => string | number | null }[]
): string {
  const headerLine = columns.map((col) => escapeCsvCell(col.header)).join(';');
  const rows = data.map((row) =>
    columns.map((col) => escapeCsvCell(col.accessor(row))).join(';')
  );

  return `\uFEFF${[headerLine, ...rows].join('\r\n')}`;
}

export type ExportableTransaction = TransactionDTO & {
  categoryName?: string;
};

/**
 * Formats transactions to CSV with columns:
 * Date ; Type (Entrée/Sortie) ; Catégorie ; Montant (€) ; Note
 */
export function formatTransactionsCSV(
  transactions: ExportableTransaction[],
  categories?: CategoryDTO[]
): string {
  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c.name]));

  return convertToCSV(transactions, [
    {
      header: 'Date',
      accessor: (tx) => formatCsvDate(tx.date),
    },
    {
      header: 'Type (Entrée/Sortie)',
      accessor: (tx) => (tx.type === 'INCOME' ? 'Entrée' : 'Sortie'),
    },
    {
      header: 'Catégorie',
      accessor: (tx) =>
        tx.categoryName ?? categoryMap.get(tx.categoryId) ?? tx.categoryId,
    },
    {
      header: 'Montant (€)',
      accessor: (tx) => formatCsvDecimal(tx.amount, 2),
    },
    {
      header: 'Note',
      accessor: (tx) => tx.note ?? '',
    },
  ]);
}

/**
 * Formats closed monthly reports to CSV with columns:
 * Mois ; Revenus Totaux (€) ; Dépenses Totales (€) ; Réserve Sécurisée (€) ; Patrimoine Net (€) ; Inflation Personnelle (%) ; Date de Clôture ; Notes
 */
export function formatMonthlyReportsCSV(reports: MonthlyReportDTO[]): string {
  return convertToCSV(reports, [
    {
      header: 'Mois',
      accessor: (r) => r.month,
    },
    {
      header: 'Revenus Totaux (€)',
      accessor: (r) => formatCsvDecimal(r.totalIncome, 2),
    },
    {
      header: 'Dépenses Totales (€)',
      accessor: (r) => formatCsvDecimal(r.totalExpenses, 2),
    },
    {
      header: 'Réserve Sécurisée (€)',
      accessor: (r) => formatCsvDecimal(r.reserveAmount, 2),
    },
    {
      header: 'Patrimoine Net (€)',
      accessor: (r) => formatCsvDecimal(r.netWorthEnd, 2),
    },
    {
      header: 'Inflation Personnelle (%)',
      accessor: (r) => formatCsvDecimal(r.personalInflation, 1),
    },
    {
      header: 'Date de Clôture',
      accessor: (r) => formatCsvDate(r.closedAt),
    },
    {
      header: 'Notes',
      accessor: (r) => r.notes ?? '',
    },
  ]);
}
