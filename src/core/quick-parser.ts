import { CategoryDTO, TransactionType } from './types';
import { formatCurrency, roundCurrency } from './format';

export interface ParsedQuickTransaction {
  amount: number;
  type: TransactionType;
  category: CategoryDTO;
  matchedByKeyword: boolean;
  note: string | null;
  previewLabel: string;
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  resto: ['restaurant', 'restaurants', 'sorties'],
  restos: ['restaurant', 'restaurants', 'sorties'],
  bar: ['restaurant', 'restaurants', 'sorties'],
  supermarche: ['courses'],
  bouffe: ['courses'],
  loyer: ['logement'],
  edf: ['logement', 'energie'],
  abo: ['abonnements'],
  abos: ['abonnements'],
  metro: ['transports'],
  uber: ['transports'],
  essence: ['transports'],
  pharma: ['sante'],
  pharmacie: ['sante'],
  medecin: ['sante'],
  sport: ['loisirs'],
  cine: ['loisirs'],
  cinema: ['loisirs'],
  paie: ['salaire'],
  freelance: ['revenus', 'annexes'],
};

function normalizeToken(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchCategoryToken(
  token: string,
  candidates: CategoryDTO[]
): CategoryDTO | null {
  const norm = normalizeToken(token);
  if (norm.length < 2) return null;

  const aliasTargets = CATEGORY_ALIASES[norm] ?? [];

  // 1. Exact full name or exact word match
  for (const cat of candidates) {
    const catNorm = normalizeToken(cat.name);
    const words = catNorm.split(' ');
    if (catNorm === norm || words.includes(norm)) {
      return cat;
    }
  }

  // 2. Prefix match on category name or any of its words
  for (const cat of candidates) {
    const catNorm = normalizeToken(cat.name);
    const words = catNorm.split(' ');
    if (
      catNorm.startsWith(norm) ||
      words.some((w) => w.startsWith(norm) || (norm.length >= 4 && norm.startsWith(w)))
    ) {
      return cat;
    }
  }

  // 3. Alias fallback (e.g. "resto" -> "Restaurants & Sorties")
  if (aliasTargets.length > 0) {
    for (const cat of candidates) {
      const catNorm = normalizeToken(cat.name);
      if (aliasTargets.some((alias) => catNorm.includes(alias))) {
        return cat;
      }
    }
  }

  return null;
}

/**
 * Pure parser for Spotlight/Command Palette quick transaction entry.
 * Examples:
 *  - "-18.50 courses pain"  -> EXPENSE 18.50€, category Courses, note "pain"
 *  - "+2100 salaire"        -> INCOME 2100€, category Salaire, note null
 *  - "12,90 resto dejeuner" -> EXPENSE 12.90€, category Restaurants & Sorties, note "dejeuner"
 */
export function parseQuickCommand(
  rawInput: string,
  categories: CategoryDTO[],
  currency: string = 'EUR'
): ParsedQuickTransaction | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Must start with an optional sign (+/-) followed by a numeric amount and optional €
  const match = trimmed.match(/^([+-])?\s*(\d+(?:[.,]\d{1,2})?)\s*€?(?:\s+(.*))?$/);
  if (!match) return null;

  const sign = match[1];
  const rawAmount = Number(match[2].replace(',', '.'));
  const rest = (match[3] ?? '').trim();

  if (!Number.isFinite(rawAmount) || rawAmount <= 0) return null;

  const amount = roundCurrency(rawAmount);
  const type: TransactionType = sign === '+' ? 'INCOME' : 'EXPENSE';

  const activeCandidates = categories.filter(
    (c) => !c.isArchived && c.type === type
  );
  if (activeCandidates.length === 0) return null;

  const tokens = rest ? rest.split(/\s+/) : [];
  let matchedCategory: CategoryDTO | null = null;
  let matchedByKeyword = false;
  let noteTokens = tokens;

  if (tokens.length > 0) {
    // Try matching first token as category
    const hit = matchCategoryToken(tokens[0], activeCandidates);
    if (hit) {
      matchedCategory = hit;
      matchedByKeyword = true;
      noteTokens = tokens.slice(1);
    }
  }

  const finalCategory = matchedCategory ?? activeCandidates[0];
  const note = noteTokens.length > 0 ? noteTokens.join(' ') : null;

  const formattedAmount = formatCurrency(amount, currency);
  const directionLabel = type === 'INCOME' ? 'une entrée' : 'une sortie';
  const noteSuffix = note ? ` — Note : ${note}` : '';
  const previewLabel = `Enregistrer ${directionLabel} de ${formattedAmount} dans [${finalCategory.name}]${noteSuffix}`;

  return {
    amount,
    type,
    category: finalCategory,
    matchedByKeyword,
    note,
    previewLabel,
  };
}
