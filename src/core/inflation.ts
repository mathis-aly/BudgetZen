import {
  BasketInflationIndex,
  BasketProductItem,
  CategoryDTO,
  CategoryInflationItem,
  PersonalInflationReport,
  PriceEntryDTO,
  ProductInflationStats,
  TrackedProductDTO,
  TransactionDTO,
} from './types';
import { getMonthKey, roundCurrency } from './format';

/**
 * Computes the user's real personal inflation rate by comparing average monthly
 * spending per expense category between the current calendar year and the previous year.
 */
export function computePersonalInflation(params: {
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  referenceDate?: Date;
}): PersonalInflationReport {
  const ref = params.referenceDate ?? new Date();
  const currentYear = ref.getFullYear();
  const previousYear = currentYear - 1;

  const categoryMap = new Map(params.categories.map((c) => [c.id, c]));

  // Track totals per category AND distinct active months per year for accurate monthly averages
  const prevByCat = new Map<string, { total: number; months: Set<string> }>();
  const currByCat = new Map<string, { total: number; months: Set<string> }>();
  const prevGlobalMonths = new Set<string>();
  const currGlobalMonths = new Set<string>();

  for (const tx of params.transactions) {
    if (tx.type !== 'EXPENSE') continue;
    const d = new Date(tx.date);
    const y = d.getFullYear();
    const mk = getMonthKey(d);

    if (y === previousYear) {
      prevGlobalMonths.add(mk);
      const entry = prevByCat.get(tx.categoryId) ?? { total: 0, months: new Set() };
      entry.total += tx.amount;
      entry.months.add(mk);
      prevByCat.set(tx.categoryId, entry);
    } else if (y === currentYear) {
      currGlobalMonths.add(mk);
      const entry = currByCat.get(tx.categoryId) ?? { total: 0, months: new Set() };
      entry.total += tx.amount;
      entry.months.add(mk);
      currByCat.set(tx.categoryId, entry);
    }
  }

  const prevMonthsCount = prevGlobalMonths.size;
  const currMonthsCount = currGlobalMonths.size;

  if (prevMonthsCount === 0 || currMonthsCount === 0) {
    return {
      hasComparisonData: false,
      previousYear,
      currentYear,
      previousMonthsSampled: prevMonthsCount,
      currentMonthsSampled: currMonthsCount,
      personalInflationRate: 0,
      totalPreviousMonthlyAvg: 0,
      totalCurrentMonthlyAvg: 0,
      monthlyCostDelta: 0,
      categories: [],
    };
  }

  const items: CategoryInflationItem[] = [];
  let totalPrevAvg = 0;
  let totalCurrAvg = 0;

  for (const [categoryId, prevData] of prevByCat.entries()) {
    const currData = currByCat.get(categoryId);
    if (!currData) continue;

    const prevAvg = roundCurrency(prevData.total / prevMonthsCount);
    const currAvg = roundCurrency(currData.total / currMonthsCount);
    if (prevAvg < 1) continue;

    const monthlyDelta = roundCurrency(currAvg - prevAvg);
    const inflationRate = roundCurrency(((currAvg - prevAvg) / prevAvg) * 100);
    const cat = categoryMap.get(categoryId);

    totalPrevAvg += prevAvg;
    totalCurrAvg += currAvg;

    items.push({
      categoryId,
      name: cat?.name ?? 'Autre',
      color: cat?.color ?? '#007AFF',
      icon: cat?.icon ?? 'Tag',
      previousMonthlyAvg: prevAvg,
      currentMonthlyAvg: currAvg,
      monthlyDelta,
      inflationRate,
    });
  }

  totalPrevAvg = roundCurrency(totalPrevAvg);
  totalCurrAvg = roundCurrency(totalCurrAvg);
  const monthlyCostDelta = roundCurrency(totalCurrAvg - totalPrevAvg);
  const personalInflationRate =
    totalPrevAvg > 0
      ? roundCurrency(((totalCurrAvg - totalPrevAvg) / totalPrevAvg) * 100)
      : 0;

  items.sort((a, b) => b.inflationRate - a.inflationRate);

  return {
    hasComparisonData: items.length > 0,
    previousYear,
    currentYear,
    previousMonthsSampled: prevMonthsCount,
    currentMonthsSampled: currMonthsCount,
    personalInflationRate,
    totalPreviousMonthlyAvg: totalPrevAvg,
    totalCurrentMonthlyAvg: totalCurrAvg,
    monthlyCostDelta,
    categories: items,
  };
}

/**
 * Calculates price variation (% and €) for a tracked product between its baseline
 * observation (either the entry closest to 12 months before the latest price, or the
 * first recorded entry if all observations fall within 12 months) and its latest price,
 * plus the average, min, and max recorded prices.
 */
export function calculateProductInflation(
  entries: PriceEntryDTO[]
): ProductInflationStats {
  if (!entries || entries.length === 0) {
    return {
      entryCount: 0,
      hasComparison: false,
      baselinePrice: 0,
      baselineDate: null,
      latestPrice: 0,
      latestDate: null,
      latestStore: null,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0,
      deltaAmount: 0,
      deltaPercent: 0,
      sortedEntries: [],
    };
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  const latest = sorted[sorted.length - 1];
  const latestTime = new Date(latest.recordedAt).getTime();

  let sum = 0;
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (const e of sorted) {
    sum += e.price;
    if (e.price < minPrice) minPrice = e.price;
    if (e.price > maxPrice) maxPrice = e.price;
  }
  const averagePrice = roundCurrency(sum / sorted.length);

  if (sorted.length === 1) {
    return {
      entryCount: 1,
      hasComparison: false,
      baselinePrice: roundCurrency(latest.price),
      baselineDate: latest.recordedAt,
      latestPrice: roundCurrency(latest.price),
      latestDate: latest.recordedAt,
      latestStore: latest.store,
      averagePrice,
      minPrice: roundCurrency(minPrice),
      maxPrice: roundCurrency(maxPrice),
      deltaAmount: 0,
      deltaPercent: 0,
      sortedEntries: sorted,
    };
  }

  // Determine 12-month reference cutoff relative to the latest recorded entry
  const cutoffDate = new Date(latestTime);
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
  const cutoffTime = cutoffDate.getTime();

  // If there are observations older than 12 months, pick the observation closest to the 12-month mark
  // (preferring the first observation on or after the 12-month mark if one is older than cutoff, or closest before cutoff).
  let baseline = sorted[0];
  const olderThanCutoff = sorted.filter(
    (e) => new Date(e.recordedAt).getTime() <= cutoffTime
  );
  if (olderThanCutoff.length > 0) {
    // Most recent entry at or before the 12-month cutoff
    baseline = olderThanCutoff[olderThanCutoff.length - 1];
  }

  const baselinePrice = roundCurrency(baseline.price);
  const latestPrice = roundCurrency(latest.price);
  const deltaAmount = roundCurrency(latestPrice - baselinePrice);
  const deltaPercent =
    baselinePrice > 0
      ? roundCurrency(((latestPrice - baselinePrice) / baselinePrice) * 100)
      : 0;

  return {
    entryCount: sorted.length,
    hasComparison: true,
    baselinePrice,
    baselineDate: baseline.recordedAt,
    latestPrice,
    latestDate: latest.recordedAt,
    latestStore: latest.store,
    averagePrice,
    minPrice: roundCurrency(minPrice),
    maxPrice: roundCurrency(maxPrice),
    deltaAmount,
    deltaPercent,
    sortedEntries: sorted,
  };
}

/**
 * Calculates the global inflation index of the user's reference basket ("Panier témoin"):
 * arithmetic average of price variations (%) across all tracked products with >= 2 entries.
 */
export function calculateBasketInflationIndex(
  products: TrackedProductDTO[]
): BasketInflationIndex {
  const items: BasketProductItem[] = products.map((product) => {
    const stats = calculateProductInflation(product.entries);
    const isAlertTriggered =
      stats.hasComparison && stats.deltaPercent >= product.targetAlertPercent;
    return { product, stats, isAlertTriggered };
  });

  const comparable = items.filter((i) => i.stats.hasComparison);
  const averageInflationPercent =
    comparable.length > 0
      ? roundCurrency(
          comparable.reduce((sum, i) => sum + i.stats.deltaPercent, 0) /
            comparable.length
        )
      : 0;

  const productsRisingCount = comparable.filter((i) => i.stats.deltaPercent > 0).length;
  const productsFallingCount = comparable.filter((i) => i.stats.deltaPercent < 0).length;
  const alertTriggeredCount = items.filter((i) => i.isAlertTriggered).length;

  // Sort: alert-triggered first, then highest price increase first
  items.sort((a, b) => {
    if (a.isAlertTriggered !== b.isAlertTriggered) {
      return a.isAlertTriggered ? -1 : 1;
    }
    return b.stats.deltaPercent - a.stats.deltaPercent;
  });

  return {
    trackedCount: products.length,
    comparableCount: comparable.length,
    averageInflationPercent,
    productsRisingCount,
    productsFallingCount,
    alertTriggeredCount,
    items,
  };
}
