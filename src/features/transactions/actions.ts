'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type { TransactionType } from '@/core';

export interface ImportTransactionRowPayload {
  dateIso: string;
  type: TransactionType;
  categoryName: string;
  categoryId?: string | null;
  amount: number;
  note?: string | null;
}

export interface ImportTransactionsActionResult {
  ok: boolean;
  error?: string;
  importedCount?: number;
  createdCategoriesCount?: number;
}

const AUTO_CATEGORY_COLORS = [
  '#15803D',
  '#B45309',
  '#1D4ED8',
  '#7C3AED',
  '#0F766E',
  '#B91C1C',
  '#475569',
];

function normalizeCategoryKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Transactional Server Action (`prisma.$transaction`) that atomically:
 * 1. Auto-creates any missing categories referenced in the imported CSV rows.
 * 2. Inserts all validated transactions into SQLite without touching existing records.
 */
export async function importTransactionsAction(
  rows: ImportTransactionRowPayload[]
): Promise<ImportTransactionsActionResult> {
  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'Aucune transaction valide à importer.' };
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingCats = await tx.category.findMany();
      const catByKey = new Map<string, string>();
      const catByName = new Map<string, string>();

      let maxSortOrder = 0;
      for (const c of existingCats) {
        if (c.sortOrder > maxSortOrder) maxSortOrder = c.sortOrder;
        const norm = normalizeCategoryKey(c.name);
        catByKey.set(`${c.type}:${norm}`, c.id);
        if (!catByName.has(norm)) catByName.set(norm, c.id);
      }

      let createdCategoriesCount = 0;
      const toCreateData: Array<{
        amount: number;
        type: string;
        date: Date;
        note: string | null;
        categoryId: string;
      }> = [];

      for (const row of rows) {
        const parsedAmount = Math.round(Number(row.amount) * 100) / 100;
        const parsedDate = new Date(row.dateIso);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || Number.isNaN(parsedDate.getTime())) {
          continue;
        }

        const txType: TransactionType = row.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
        const cleanCatName = (row.categoryName || '').trim() || (txType === 'INCOME' ? 'Revenus' : 'Autre');
        const norm = normalizeCategoryKey(cleanCatName);

        let resolvedCategoryId =
          row.categoryId && existingCats.some((c) => c.id === row.categoryId)
            ? row.categoryId
            : catByKey.get(`${txType}:${norm}`) ?? catByName.get(norm) ?? null;

        if (!resolvedCategoryId) {
          maxSortOrder += 1;
          const color =
            AUTO_CATEGORY_COLORS[
              (existingCats.length + createdCategoriesCount) %
                AUTO_CATEGORY_COLORS.length
            ];
          const createdCat = await tx.category.create({
            data: {
              name: cleanCatName,
              type: txType,
              color,
              icon: txType === 'INCOME' ? 'Briefcase' : 'Tag',
              monthlyLimit: 0,
              alertThreshold: 80,
              sortOrder: maxSortOrder,
            },
          });
          resolvedCategoryId = createdCat.id;
          catByKey.set(`${txType}:${norm}`, createdCat.id);
          catByName.set(norm, createdCat.id);
          createdCategoriesCount += 1;
        }

        toCreateData.push({
          amount: parsedAmount,
          type: txType,
          date: parsedDate,
          note: row.note?.trim() || null,
          categoryId: resolvedCategoryId,
        });
      }

      if (toCreateData.length === 0) {
        return { importedCount: 0, createdCategoriesCount: 0 };
      }

      await tx.transaction.createMany({ data: toCreateData });

      return {
        importedCount: toCreateData.length,
        createdCategoriesCount,
      };
    });

    revalidatePath('/');

    return {
      ok: true,
      importedCount: result.importedCount,
      createdCategoriesCount: result.createdCategoriesCount,
    };
  } catch (error) {
    console.error('importTransactionsAction error:', error);
    return {
      ok: false,
      error: "Erreur lors de l'importation transactionnelle du fichier CSV.",
    };
  }
}
