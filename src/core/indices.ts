import {
  CategoryDTO,
  CompositeIndexCalculation,
  CustomIndexDTO,
  IndexComponentDTO,
  IndexDataPointDTO,
  IndexVariationsResult,
  TrackedProductDTO,
  TransactionDTO,
  WealthAssetDTO,
} from './types';
import { getMonthKey, roundCurrency } from './format';
import { calculateProductInflation } from './inflation';

/**
 * Pure composite index calculator in base 100 (or custom `baseValue`).
 * `currentValues` maps either `component.id` or `component.sourceId` -> current numeric value.
 */
export function computeCompositeIndexValue(
  components: Pick<
    IndexComponentDTO,
    'id' | 'sourceId' | 'label' | 'weightPercent' | 'baseReferenceValue'
  >[],
  currentValues: Record<string, number>,
  baseValue: number = 100
): CompositeIndexCalculation {
  const safeBase = baseValue > 0 ? baseValue : 100;

  if (!components || components.length === 0) {
    return {
      value: safeBase,
      baseValue: safeBase,
      deltaFromBase: 0,
      deltaPercent: 0,
      totalWeight: 0,
      isWeightValid: false,
      componentBreakdown: [],
    };
  }

  let totalWeight = 0;
  let weightedSum = 0;
  const breakdown: CompositeIndexCalculation['componentBreakdown'] = [];

  for (const comp of components) {
    const weight = Math.max(0, Number.isFinite(comp.weightPercent) ? comp.weightPercent : 0);
    totalWeight += weight;

    const currentVal =
      currentValues[comp.id] ??
      (comp.sourceId ? currentValues[comp.sourceId] : undefined) ??
      comp.baseReferenceValue;

    const safeRef = comp.baseReferenceValue > 0 ? comp.baseReferenceValue : 1;
    const ratio = currentVal / safeRef;
    const weightedPoints = (weight / 100) * ratio * safeBase;
    weightedSum += weightedPoints;

    const componentVariationPercent = roundCurrency((ratio - 1) * 100);

    breakdown.push({
      componentId: comp.id,
      label: comp.label,
      weightPercent: roundCurrency(weight),
      baseReferenceValue: roundCurrency(comp.baseReferenceValue),
      currentValue: roundCurrency(currentVal),
      componentVariationPercent,
      weightedPoints: roundCurrency(weightedPoints),
    });
  }

  const normalizedValue =
    totalWeight > 0 ? roundCurrency((weightedSum / totalWeight) * 100) : safeBase;
  const deltaFromBase = roundCurrency(normalizedValue - safeBase);
  const deltaPercent = roundCurrency(((normalizedValue - safeBase) / safeBase) * 100);

  return {
    value: normalizedValue,
    baseValue: safeBase,
    deltaFromBase,
    deltaPercent,
    totalWeight: roundCurrency(totalWeight),
    isWeightValid: Math.abs(totalWeight - 100) < 0.05,
    componentBreakdown: breakdown,
  };
}

/**
 * Finds the point closest to `targetDate` that is on or before `targetDate`
 * (or the earliest point within a small tolerance window if none is strictly older).
 */
function findReferenceValueAtOffset(
  sortedPoints: IndexDataPointDTO[],
  referenceDate: Date,
  monthsBack: number
): number | null {
  if (sortedPoints.length < 2) return null;

  const target = new Date(referenceDate);
  target.setMonth(target.getMonth() - monthsBack);
  const targetMs = target.getTime();

  // Require data spanning at least 60% of the requested lookback horizon so we don't mislabel a 2-day diff as "1 year"
  const earliestMs = new Date(sortedPoints[0].recordedAt).getTime();
  const minSpanMs = monthsBack * 30 * 24 * 60 * 60 * 1000 * 0.6;
  if (referenceDate.getTime() - earliestMs < minSpanMs) {
    return null;
  }

  // Pick the point closest in time to `target`
  let closest = sortedPoints[0];
  let bestDiff = Math.abs(new Date(closest.recordedAt).getTime() - targetMs);

  for (const pt of sortedPoints) {
    const diff = Math.abs(new Date(pt.recordedAt).getTime() - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = pt;
    }
  }

  return closest.value;
}

/**
 * Computes percentage variations over 1 month, 6 months, 1 year, and since creation.
 */
export function computeIndexVariations(
  dataPoints: IndexDataPointDTO[],
  currentValue?: number,
  baseValue: number = 100,
  referenceDate: Date = new Date()
): IndexVariationsResult {
  const sorted = [...dataPoints].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  const effectiveCurrent =
    currentValue !== undefined
      ? roundCurrency(currentValue)
      : sorted.length > 0
        ? roundCurrency(sorted[sorted.length - 1].value)
        : roundCurrency(baseValue);

  const latestRefDate =
    sorted.length > 0
      ? new Date(
          Math.max(
            referenceDate.getTime(),
            new Date(sorted[sorted.length - 1].recordedAt).getTime()
          )
        )
      : referenceDate;

  const pct = (fromVal: number | null): number | null => {
    if (fromVal === null || fromVal <= 0) return null;
    return roundCurrency(((effectiveCurrent - fromVal) / fromVal) * 100);
  };

  const creationRef = sorted.length > 0 ? sorted[0].value : baseValue;
  const sinceCreationPercent =
    creationRef > 0
      ? roundCurrency(((effectiveCurrent - creationRef) / creationRef) * 100)
      : 0;

  return {
    currentValue: effectiveCurrent,
    oneMonthPercent: pct(findReferenceValueAtOffset(sorted, latestRefDate, 1)),
    sixMonthsPercent: pct(findReferenceValueAtOffset(sorted, latestRefDate, 6)),
    oneYearPercent: pct(findReferenceValueAtOffset(sorted, latestRefDate, 12)),
    sinceCreationPercent,
    sortedDataPoints: sorted,
  };
}

/**
 * Resolves live current values for every component of a COMPOSITE CustomIndex
 * from existing tracked products, expense categories, and wealth assets.
 */
export function resolveLiveCompositeValues(params: {
  index: CustomIndexDTO;
  trackedProducts: TrackedProductDTO[];
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  wealthAssets: WealthAssetDTO[];
  monthKey?: string;
}): Record<string, number> {
  const monthKey = params.monthKey ?? getMonthKey(new Date());
  const values: Record<string, number> = {};

  const productMap = new Map(params.trackedProducts.map((p) => [p.id, p]));
  const assetMap = new Map(params.wealthAssets.map((a) => [a.id, a]));

  for (const comp of params.index.components) {
    if (comp.sourceType === 'TRACKED_PRODUCT' && comp.sourceId) {
      const prod = productMap.get(comp.sourceId);
      if (prod && prod.entries.length > 0) {
        const stats = calculateProductInflation(prod.entries);
        values[comp.id] = stats.latestPrice;
        continue;
      }
    }

    if (comp.sourceType === 'WEALTH_ASSET' && comp.sourceId) {
      const asset = assetMap.get(comp.sourceId);
      if (asset) {
        values[comp.id] = asset.currentValue;
        continue;
      }
    }

    if (comp.sourceType === 'EXPENSE_CATEGORY' && comp.sourceId) {
      const spentThisMonth = params.transactions
        .filter(
          (tx) =>
            tx.type === 'EXPENSE' &&
            tx.categoryId === comp.sourceId &&
            getMonthKey(new Date(tx.date)) === monthKey
        )
        .reduce((sum, tx) => sum + tx.amount, 0);

      if (spentThisMonth > 0) {
        values[comp.id] = roundCurrency(spentThisMonth);
        continue;
      }
    }

    values[comp.id] = comp.baseReferenceValue;
  }

  return values;
}
