import { CategoryDTO, TransactionDTO, TransactionType } from './types';
import { roundCurrency, toISODateOnly } from './format';

export interface ParsedImportRow {
  rowNumber: number;
  rawDate: string;
  dateIso: string | null;
  dateKey: string | null; // YYYY-MM-DD
  type: TransactionType;
  categoryName: string;
  categoryId: string | null;
  willCreateCategory: boolean;
  amount: number | null;
  note: string | null;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
}

export interface NewCategorySpec {
  name: string;
  type: TransactionType;
}

export interface CsvImportParseResult {
  delimiter: ';' | ',';
  rows: ParsedImportRow[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  newCategoriesToCreate: NewCategorySpec[];
  headerError?: string;
}

function normalizeHeader(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Auto-detects ';' vs ',' delimiter from the first non-empty line outside quotes.
 */
function detectDelimiter(content: string): ';' | ',' {
  const firstLine = content.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  let semicolons = 0;
  let commas = 0;
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ';') semicolons++;
      else if (ch === ',') commas++;
    }
  }

  return semicolons >= commas ? ';' : ',';
}

/**
 * Full RFC 4180 CSV parser supporting quoted values, doubled quotes (""),
 * and embedded newlines inside quoted cells.
 */
function parseCsvMatrix(content: string, delimiter: ';' | ','): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  // Filter out completely blank trailing lines
  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

/**
 * Parses DD/MM/YYYY (JJ/MM/AAAA) or YYYY-MM-DD (AAAA-MM-JJ) dates safely.
 */
function parseFlexibleDate(raw: string): { dateIso: string; dateKey: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let year: number;
  let month: number;
  let day: number;

  const frMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);

  if (frMatch) {
    day = Number(frMatch[1]);
    month = Number(frMatch[2]);
    year = Number(frMatch[3]);
  } else if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1970 || year > 2100) {
    return null;
  }

  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const dateKey = `${year}-${mm}-${dd}`;
  return {
    dateKey,
    dateIso: `${dateKey}T12:00:00.000Z`,
  };
}

/**
 * Parses French ("45,50 €", "1 250,00") or English ("45.50", "1,250.00") amounts.
 */
function parseFlexibleAmount(raw: string): { amount: number; sign: '+' | '-' | null } | null {
  const cleaned = raw
    .replace(/[€$£]/g, '')
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/−/g, '-')
    .trim();

  if (!cleaned) return null;

  let sign: '+' | '-' | null = null;
  let numeric = cleaned;
  if (numeric.startsWith('+')) {
    sign = '+';
    numeric = numeric.slice(1);
  } else if (numeric.startsWith('-')) {
    sign = '-';
    numeric = numeric.slice(1);
  }

  if (!numeric || !/^[0-9.,]+$/.test(numeric)) return null;

  const hasComma = numeric.includes(',');
  const hasDot = numeric.includes('.');

  if (hasComma && hasDot) {
    // Whichever separator appears last is the decimal separator
    if (numeric.lastIndexOf(',') > numeric.lastIndexOf('.')) {
      numeric = numeric.replace(/\./g, '').replace(',', '.');
    } else {
      numeric = numeric.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Handle multiple commas as thousands separator, single comma as decimal
    const parts = numeric.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      numeric = `${parts[0]}.${parts[1]}`;
    } else {
      numeric = numeric.replace(/,/g, '');
    }
  }

  const parsed = Number(numeric);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return { amount: roundCurrency(parsed), sign };
}

function parseTransactionType(
  rawType: string,
  amountSign: '+' | '-' | null
): TransactionType {
  const norm = normalizeHeader(rawType);
  if (
    norm.startsWith('entree') ||
    norm.startsWith('revenu') ||
    norm.startsWith('income') ||
    norm.startsWith('credit') ||
    norm === '+'
  ) {
    return 'INCOME';
  }
  if (
    norm.startsWith('sortie') ||
    norm.startsWith('depense') ||
    norm.startsWith('expense') ||
    norm.startsWith('debit') ||
    norm === '-'
  ) {
    return 'EXPENSE';
  }
  return amountSign === '+' ? 'INCOME' : 'EXPENSE';
}

function makeDuplicateFingerprint(
  dateKey: string,
  amount: number,
  note: string | null
): string {
  return `${dateKey}|${amount.toFixed(2)}|${normalizeKey(note ?? '')}`;
}

/**
 * Pure CSV transaction parser symmetric with `formatTransactionsCSV`.
 * Supports UTF-8 with or without BOM, `;` or `,` delimiters, French & English decimals,
 * `JJ/MM/AAAA` & `AAAA-MM-JJ` dates, automatic new-category detection, and duplicate detection.
 */
export function parseTransactionsCSV(
  csvContent: string,
  options?: {
    existingCategories?: CategoryDTO[];
    existingTransactions?: TransactionDTO[];
  }
): CsvImportParseResult {
  const stripped = csvContent.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(stripped);
  const matrix = parseCsvMatrix(stripped, delimiter);

  if (matrix.length < 2) {
    return {
      delimiter,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      newCategoriesToCreate: [],
      headerError:
        'Le fichier CSV doit contenir une ligne d’en-têtes et au moins une ligne de données.',
    };
  }

  const headerCells = matrix[0].map(normalizeHeader);

  const findCol = (matchers: string[]): number =>
    headerCells.findIndex((h) => matchers.some((m) => h === m || h.startsWith(m)));

  const dateCol = findCol(['date']);
  const typeCol = findCol(['type', 'sens']);
  const categoryCol = findCol(['categorie', 'category', 'poste']);
  const amountCol = findCol(['montant', 'amount', 'valeur', 'prix']);
  const noteCol = findCol(['note', 'libelle', 'description', 'motif']);

  if (dateCol === -1 || amountCol === -1) {
    return {
      delimiter,
      rows: [],
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      newCategoriesToCreate: [],
      headerError:
        'Colonnes obligatoires introuvables. Colonnes attendues : Date ; Type ; Catégorie ; Montant ; Note.',
    };
  }

  const existingCategories = options?.existingCategories ?? [];
  const existingTransactions = options?.existingTransactions ?? [];

  // Build existing duplicate fingerprints from date + amount + note
  const existingFingerprints = new Set<string>();
  for (const tx of existingTransactions) {
    const dk = toISODateOnly(new Date(tx.date));
    existingFingerprints.add(makeDuplicateFingerprint(dk, tx.amount, tx.note));
  }

  const seenInCsvFingerprints = new Set<string>();
  const newCatMap = new Map<string, NewCategorySpec>();
  const rows: ParsedImportRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i];
    const rawDate = (line[dateCol] ?? '').trim();
    const rawType = typeCol >= 0 ? (line[typeCol] ?? '').trim() : '';
    const rawCategory = categoryCol >= 0 ? (line[categoryCol] ?? '').trim() : '';
    const rawAmount = (line[amountCol] ?? '').trim();
    const rawNote = noteCol >= 0 ? (line[noteCol] ?? '').trim() : '';

    const errors: string[] = [];

    const parsedDate = parseFlexibleDate(rawDate);
    if (!parsedDate) {
      errors.push(`Date illisible (« ${rawDate || 'vide'} »)`);
    }

    const parsedAmount = parseFlexibleAmount(rawAmount);
    if (!parsedAmount) {
      errors.push(`Montant invalide (« ${rawAmount || 'vide'} »)`);
    }

    const type = parseTransactionType(rawType, parsedAmount?.sign ?? null);
    const categoryName = rawCategory || (type === 'INCOME' ? 'Revenus' : 'Autre');
    const normCatName = normalizeKey(categoryName);

    // Match against existing categories (prefer same type, then fallback by name)
    const matchedCat =
      existingCategories.find(
        (c) => normalizeKey(c.name) === normCatName && c.type === type
      ) ??
      existingCategories.find((c) => normalizeKey(c.name) === normCatName) ??
      null;

    const willCreateCategory = !matchedCat;
    const isValid = errors.length === 0;

    let isDuplicate = false;
    const cleanNote = rawNote || null;

    if (isValid && parsedDate && parsedAmount) {
      const fp = makeDuplicateFingerprint(
        parsedDate.dateKey,
        parsedAmount.amount,
        cleanNote
      );
      if (existingFingerprints.has(fp) || seenInCsvFingerprints.has(fp)) {
        isDuplicate = true;
      } else {
        seenInCsvFingerprints.add(fp);
      }

      if (willCreateCategory) {
        const catMapKey = `${type}:${normCatName}`;
        if (!newCatMap.has(catMapKey)) {
          newCatMap.set(catMapKey, { name: categoryName, type });
        }
      }
    }

    rows.push({
      rowNumber: i + 1,
      rawDate,
      dateIso: parsedDate?.dateIso ?? null,
      dateKey: parsedDate?.dateKey ?? null,
      type,
      categoryName: matchedCat?.name ?? categoryName,
      categoryId: matchedCat?.id ?? null,
      willCreateCategory,
      amount: parsedAmount?.amount ?? null,
      note: cleanNote,
      isValid,
      errors,
      isDuplicate,
    });
  }

  return {
    delimiter,
    rows,
    validCount: rows.filter((r) => r.isValid).length,
    invalidCount: rows.filter((r) => !r.isValid).length,
    duplicateCount: rows.filter((r) => r.isValid && r.isDuplicate).length,
    newCategoriesToCreate: Array.from(newCatMap.values()),
  };
}

/**
 * Generates a ready-to-fill blank CSV template compatible with Excel & Apple Numbers.
 */
export function generateTransactionsTemplateCSV(): string {
  const lines = [
    'Date;Type (Entrée/Sortie);Catégorie;Montant (€);Note',
    '26/11/2026;Sortie;Courses;45,50;Exemple de dépense (à remplacer)',
    '01/11/2026;Entrée;Salaire;2500,00;Exemple de revenu (à remplacer)',
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}
