'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type { MonthlyReportDTO } from '@/core';

export interface AssetUpdatePayload {
  assetId: string;
  newValue: number;
}

export interface PriceEntryPayload {
  productId: string;
  price: number;
  store?: string | null;
}

export interface CloseMonthActionInput {
  month: string; // "YYYY-MM"
  totalIncome: number;
  totalExpenses: number;
  reserveAmount: number;
  netWorthEnd: number;
  personalInflation: number;
  notes?: string | null;
  assetUpdates: AssetUpdatePayload[];
  priceEntries: PriceEntryPayload[];
}

export interface CloseMonthActionResult {
  ok: boolean;
  error?: string;
  report?: MonthlyReportDTO;
  updatedAssetsCount?: number;
  createdPricesCount?: number;
}

/**
 * Transactional Server Action (`prisma.$transaction`) executing simultaneously upon final validation:
 * 1. Updates `currentValue` + `lastUpdated` on each modified `WealthAsset` and creates its `AssetSnapshot`.
 * 2. Inserts all newly recorded `PriceEntry` observations from Step 3.
 * 3. Persists the definitive `MonthlyReport` for the closed month.
 */
export async function closeMonthAction(
  input: CloseMonthActionInput
): Promise<CloseMonthActionResult> {
  try {
    if (!/^\d{4}-\d{2}$/.test(input.month)) {
      return { ok: false, error: 'Format de mois invalide (attendu : YYYY-MM).' };
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      let updatedAssetsCount = 0;

      // 1. Update modified WealthAssets & record AssetSnapshots
      for (const update of input.assetUpdates) {
        if (!Number.isFinite(update.newValue) || update.newValue < 0) continue;
        const rounded = Math.round(update.newValue * 100) / 100;

        await tx.wealthAsset.update({
          where: { id: update.assetId },
          data: {
            currentValue: rounded,
            lastUpdated: now,
          },
        });

        await tx.assetSnapshot.create({
          data: {
            assetId: update.assetId,
            value: rounded,
            recordedAt: now,
          },
        });

        updatedAssetsCount += 1;
      }

      // 2. Insert new PriceEntry observations from Step 3
      let createdPricesCount = 0;
      for (const entry of input.priceEntries) {
        if (!Number.isFinite(entry.price) || entry.price <= 0) continue;
        const rounded = Math.round(entry.price * 100) / 100;

        await tx.priceEntry.create({
          data: {
            productId: entry.productId,
            price: rounded,
            store: entry.store?.trim() || null,
            recordedAt: now,
          },
        });

        createdPricesCount += 1;
      }

      // 3. Persist the definitive MonthlyReport (upsert handles re-closing/updating cleanly)
      const reportRow = await tx.monthlyReport.upsert({
        where: { month: input.month },
        update: {
          totalIncome: Math.round(input.totalIncome * 100) / 100,
          totalExpenses: Math.round(input.totalExpenses * 100) / 100,
          reserveAmount: Math.round(input.reserveAmount * 100) / 100,
          netWorthEnd: Math.round(input.netWorthEnd * 100) / 100,
          personalInflation: Math.round(input.personalInflation * 100) / 100,
          notes: input.notes?.trim() || null,
          closedAt: now,
        },
        create: {
          month: input.month,
          totalIncome: Math.round(input.totalIncome * 100) / 100,
          totalExpenses: Math.round(input.totalExpenses * 100) / 100,
          reserveAmount: Math.round(input.reserveAmount * 100) / 100,
          netWorthEnd: Math.round(input.netWorthEnd * 100) / 100,
          personalInflation: Math.round(input.personalInflation * 100) / 100,
          notes: input.notes?.trim() || null,
          closedAt: now,
        },
      });

      return {
        report: {
          id: reportRow.id,
          month: reportRow.month,
          totalIncome: reportRow.totalIncome,
          totalExpenses: reportRow.totalExpenses,
          reserveAmount: reportRow.reserveAmount,
          netWorthEnd: reportRow.netWorthEnd,
          personalInflation: reportRow.personalInflation,
          notes: reportRow.notes,
          closedAt: reportRow.closedAt.toISOString(),
        },
        updatedAssetsCount,
        createdPricesCount,
      };
    });

    revalidatePath('/');

    return {
      ok: true,
      report: result.report,
      updatedAssetsCount: result.updatedAssetsCount,
      createdPricesCount: result.createdPricesCount,
    };
  } catch (error) {
    console.error('closeMonthAction error:', error);
    return {
      ok: false,
      error: 'Erreur lors de la clôture transactionnelle du mois.',
    };
  }
}
