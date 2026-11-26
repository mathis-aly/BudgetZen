import {
  MonthlyCloseSummary,
  PriceEntryDTO,
  RecurringPaymentDTO,
  ReserveExpenseDTO,
  TransactionDTO,
  WealthAssetDTO,
} from './types';
import {
  getDaysInMonth,
  getMonthKey,
  roundCurrency,
} from './format';
import {
  computeCurrentBalance,
  filterTransactionsByMonth,
  getMonthlyFixedIncome,
} from './budget';
import { computeRemainingFixedCharges } from './recurring';
import { calculateProductInflation } from './inflation';

export interface MonthlySummarySettingsInput {
  mandatoryReserveRate: number;
  manualInflationRate: number;
  initialBalance?: number;
}

export interface MonthlySummaryOptions {
  monthKey?: string;
  referenceDate?: Date;
  recurringPayments?: RecurringPaymentDTO[];
  reserveExpenses?: ReserveExpenseDTO[];
}

/**
 * Returns true when `referenceDate` falls within the last `daysThreshold` days
 * of its calendar month (default: last 3 days — e.g. 28, 29, 30 for a 30-day month).
 */
export function isWithinEndOfMonthWindow(
  referenceDate: Date = new Date(),
  daysThreshold: number = 3
): boolean {
  const daysInMonth = getDaysInMonth(
    referenceDate.getFullYear(),
    referenceDate.getMonth()
  );
  const daysRemainingInclusive = daysInMonth - referenceDate.getDate() + 1;
  return daysRemainingInclusive <= Math.max(1, daysThreshold);
}

/**
 * Pure closing aggregator preparing all end-of-month metrics for the Guided Monthly Close wizard.
 * Signature: computeMonthlySummary(transactions, assets, priceEntries, settings, options?)
 */
export function computeMonthlySummary(
  transactions: TransactionDTO[],
  assets: Pick<WealthAssetDTO, 'id' | 'currentValue'>[],
  priceEntries: PriceEntryDTO[],
  settings: MonthlySummarySettingsInput,
  options?: MonthlySummaryOptions
): MonthlyCloseSummary {
  const referenceDate = options?.referenceDate ?? new Date();
  const monthKey = options?.monthKey ?? getMonthKey(referenceDate);
  const recurringPayments = options?.recurringPayments ?? [];
  const reserveExpenses = options?.reserveExpenses ?? [];

  const monthTxs = filterTransactionsByMonth(transactions, monthKey);
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const tx of monthTxs) {
    if (tx.type === 'INCOME') totalIncome += tx.amount;
    else totalExpenses += tx.amount;
  }

  totalIncome = roundCurrency(totalIncome);
  totalExpenses = roundCurrency(totalExpenses);
  const netCashFlow = roundCurrency(totalIncome - totalExpenses);
  const savingsRatePercent =
    totalIncome > 0
      ? roundCurrency(((totalIncome - totalExpenses) / totalIncome) * 100)
      : 0;

  const mandatoryReserveRate = Math.max(0, settings.mandatoryReserveRate);
  const expectedFixedIncome = getMonthlyFixedIncome(recurringPayments);
  const reserveIncomeBase = Math.max(totalIncome, expectedFixedIncome);
  const reserveAmount = roundCurrency(
    reserveIncomeBase * (mandatoryReserveRate / 100)
  );
  const reserveUsed = roundCurrency(
    reserveExpenses
      .filter((e) => getMonthKey(new Date(e.date)) === monthKey)
      .reduce((sum, e) => sum + e.amount, 0)
  );
  const reserveRemaining = roundCurrency(Math.max(0, reserveAmount - reserveUsed));

  const currentBalance =
    settings.initialBalance !== undefined
      ? computeCurrentBalance(settings.initialBalance, transactions, reserveExpenses)
      : netCashFlow;

  const { remainingAmount: remainingFixedCharges } = computeRemainingFixedCharges(
    recurringPayments,
    monthKey,
    transactions
  );

  const finalResteAVivre = roundCurrency(
    currentBalance - remainingFixedCharges - reserveRemaining
  );
  const surplusAvailable = roundCurrency(Math.max(0, finalResteAVivre));

  const assetsTotal = roundCurrency(
    assets.reduce((sum, a) => sum + Math.max(0, a.currentValue), 0)
  );
  const netWorthEnd = roundCurrency(assetsTotal + currentBalance);

  // Group priceEntries by productId to compute basket inflation index purely from entries
  const entriesByProduct = new Map<string, PriceEntryDTO[]>();
  for (const entry of priceEntries) {
    const list = entriesByProduct.get(entry.productId) ?? [];
    list.push(entry);
    entriesByProduct.set(entry.productId, list);
  }

  let comparableCount = 0;
  let deltaSum = 0;
  for (const productEntries of entriesByProduct.values()) {
    const stats = calculateProductInflation(productEntries);
    if (stats.hasComparison) {
      comparableCount += 1;
      deltaSum += stats.deltaPercent;
    }
  }

  const personalInflation =
    comparableCount > 0
      ? roundCurrency(deltaSum / comparableCount)
      : roundCurrency(settings.manualInflationRate);

  return {
    monthKey,
    totalIncome,
    totalExpenses,
    netCashFlow,
    savingsRatePercent,
    mandatoryReserveRate,
    reserveAmount,
    reserveUsed,
    reserveRemaining,
    currentBalance,
    remainingFixedCharges,
    finalResteAVivre,
    surplusAvailable,
    assetsTotal,
    netWorthEnd,
    personalInflation,
    basketComparableCount: comparableCount,
  };
}
