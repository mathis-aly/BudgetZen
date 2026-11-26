import {
  CategoryDistributionPoint,
  CategoryDTO,
  TransactionDTO,
} from './types';
import { roundCurrency } from './format';

export type AnalyticsTimeframe =
  | 'DAY'
  | 'WEEK'
  | 'MONTH'
  | '1Y'
  | '3Y'
  | '5Y'
  | '10Y'
  | 'ALL';

export type AnalyticsGranularity = 'hour' | 'day' | 'month' | 'quarter' | 'year';

export interface TimeframeSeriesPoint {
  bucketKey: string;
  label: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface TimeframeComparisonKPIs {
  hasPreviousData: boolean;
  previousIncome: number;
  previousExpenses: number;
  previousNetSavings: number;
  incomeChangePercent: number | null;
  expensesChangePercent: number | null;
  netSavingsChangePercent: number | null;
}

export interface TimeframeAnalyticsResult {
  timeframe: AnalyticsTimeframe;
  granularity: AnalyticsGranularity;
  granularityLabel: string;
  requestedStartDate: string;
  effectiveStartDate: string;
  endDate: string;
  earliestTransactionDate: string | null;
  isDataTruncatedToHistory: boolean;
  rangeLabel: string;
  transactionCount: number;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRatePercent: number;
  activeDaysCount: number;
  averageDailyExpense: number;
  averageMonthlyExpense: number;
  comparison: TimeframeComparisonKPIs | null;
  series: TimeframeSeriesPoint[];
  categoryDistribution: CategoryDistributionPoint[];
}

const SHORT_MONTHS_FR = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function formatRangeDateFR(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatDayMonth(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function formatMonthYearShort(year: number, monthIndex: number): string {
  const yy = String(year).slice(-2);
  return `${SHORT_MONTHS_FR[monthIndex]} ${yy}`;
}

function computePercentChange(current: number, previous: number): number | null {
  if (Math.abs(previous) < 0.01) return null;
  return roundCurrency(((current - previous) / Math.abs(previous)) * 100);
}

function getWindowBounds(
  timeframe: AnalyticsTimeframe,
  ref: Date,
  earliestTxDate: Date | null
): { start: Date; end: Date; prevStart: Date | null; prevEnd: Date | null } {
  const end = endOfDay(ref);

  if (timeframe === 'DAY') {
    const start = startOfDay(ref);
    const prevRef = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 1);
    return {
      start,
      end,
      prevStart: startOfDay(prevRef),
      prevEnd: endOfDay(prevRef),
    };
  }

  if (timeframe === 'WEEK') {
    const start = startOfDay(
      new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 6)
    );
    const prevEnd = endOfDay(
      new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 7)
    );
    const prevStart = startOfDay(
      new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 13)
    );
    return { start, end, prevStart, prevEnd };
  }

  if (timeframe === 'MONTH') {
    const start = startOfDay(
      new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 29)
    );
    const prevEnd = endOfDay(
      new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 30)
    );
    const prevStart = startOfDay(
      new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 59)
    );
    return { start, end, prevStart, prevEnd };
  }

  if (timeframe === '1Y' || timeframe === '3Y' || timeframe === '5Y' || timeframe === '10Y') {
    const yearsBack =
      timeframe === '1Y' ? 1 : timeframe === '3Y' ? 3 : timeframe === '5Y' ? 5 : 10;
    const start = startOfDay(
      new Date(ref.getFullYear() - yearsBack, ref.getMonth(), ref.getDate() + 1)
    );
    const prevEnd = endOfDay(
      new Date(ref.getFullYear() - yearsBack, ref.getMonth(), ref.getDate())
    );
    const prevStart = startOfDay(
      new Date(ref.getFullYear() - yearsBack * 2, ref.getMonth(), ref.getDate() + 1)
    );
    return { start, end, prevStart, prevEnd };
  }

  // ALL: from earliest recorded transaction up to referenceDate
  const start = earliestTxDate ? startOfDay(earliestTxDate) : startOfDay(ref);
  return { start, end, prevStart: null, prevEnd: null };
}

function chooseGranularity(
  timeframe: AnalyticsTimeframe,
  effectiveStart: Date,
  end: Date
): { granularity: AnalyticsGranularity; label: string } {
  if (timeframe === 'DAY') {
    return { granularity: 'hour', label: 'Par heure' };
  }
  if (timeframe === 'WEEK' || timeframe === 'MONTH') {
    return { granularity: 'day', label: 'Par jour' };
  }
  if (timeframe === '1Y' || timeframe === '3Y') {
    return { granularity: 'month', label: 'Par mois' };
  }
  // 5Y, 10Y, ALL: by year if actual span > 5 years, else by quarter
  const spanYears =
    (end.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (spanYears > 5) {
    return { granularity: 'year', label: 'Par année' };
  }
  return { granularity: 'quarter', label: 'Par trimestre' };
}

function getBucketInfo(
  date: Date,
  granularity: AnalyticsGranularity
): { key: string; label: string } {
  const y = date.getFullYear();
  const m = date.getMonth();

  if (granularity === 'hour') {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return { key: `${hh}:${mm}`, label: `${hh}:${mm}` };
  }

  if (granularity === 'day') {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return { key: `${y}-${mm}-${dd}`, label: `${dd}/${mm}` };
  }

  if (granularity === 'month') {
    const mm = String(m + 1).padStart(2, '0');
    return { key: `${y}-${mm}`, label: formatMonthYearShort(y, m) };
  }

  if (granularity === 'quarter') {
    const q = Math.floor(m / 3) + 1;
    return { key: `${y}-Q${q}`, label: `T${q} ${y}` };
  }

  return { key: String(y), label: String(y) };
}

/**
 * Generates ordered empty buckets between `start` and `end` so charts show continuous
 * timelines without unnecessary empty bars outside available history.
 */
function buildTimelineSkeleton(
  start: Date,
  end: Date,
  granularity: AnalyticsGranularity,
  inRangeTxs: TransactionDTO[]
): Map<string, TimeframeSeriesPoint> {
  const map = new Map<string, TimeframeSeriesPoint>();

  if (granularity === 'hour') {
    // Group by exact transaction HH:mm (or hour) for DAY view
    const sorted = [...inRangeTxs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    for (const tx of sorted) {
      const info = getBucketInfo(new Date(tx.date), 'hour');
      if (!map.has(info.key)) {
        map.set(info.key, {
          bucketKey: info.key,
          label: info.label,
          income: 0,
          expenses: 0,
          savings: 0,
        });
      }
    }
    return map;
  }

  if (granularity === 'day') {
    const cursor = startOfDay(start);
    const limit = endOfDay(end);
    while (cursor <= limit) {
      const info = getBucketInfo(cursor, 'day');
      map.set(info.key, {
        bucketKey: info.key,
        label: info.label,
        income: 0,
        expenses: 0,
        savings: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return map;
  }

  if (granularity === 'month') {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= endMonth) {
      const info = getBucketInfo(cursor, 'month');
      map.set(info.key, {
        bucketKey: info.key,
        label: info.label,
        income: 0,
        expenses: 0,
        savings: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return map;
  }

  if (granularity === 'quarter') {
    let y = start.getFullYear();
    let q = Math.floor(start.getMonth() / 3) + 1;
    const endY = end.getFullYear();
    const endQ = Math.floor(end.getMonth() / 3) + 1;

    while (y < endY || (y === endY && q <= endQ)) {
      const key = `${y}-Q${q}`;
      map.set(key, {
        bucketKey: key,
        label: `T${q} ${y}`,
        income: 0,
        expenses: 0,
        savings: 0,
      });
      q += 1;
      if (q > 4) {
        q = 1;
        y += 1;
      }
    }
    return map;
  }

  // Year granularity
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    const key = String(y);
    map.set(key, {
      bucketKey: key,
      label: key,
      income: 0,
      expenses: 0,
      savings: 0,
    });
  }
  return map;
}

/**
 * Pure multi-horizon temporal aggregator for the Analytics module.
 * Supports: DAY | WEEK | MONTH | 1Y | 3Y | 5Y | 10Y | ALL.
 * Automatically adapts granularity, clamps long horizons cleanly to available history,
 * computes comparative KPIs vs equivalent previous period, and recalculates category distribution.
 */
export function aggregateSeriesByTimeframe(
  transactions: TransactionDTO[],
  timeframe: AnalyticsTimeframe,
  options?: {
    referenceDate?: Date;
    categories?: CategoryDTO[];
  }
): TimeframeAnalyticsResult {
  const ref = options?.referenceDate ?? new Date();
  const categories = options?.categories ?? [];

  let earliestTxDate: Date | null = null;
  for (const tx of transactions) {
    const d = new Date(tx.date);
    if (!Number.isNaN(d.getTime())) {
      if (!earliestTxDate || d < earliestTxDate) {
        earliestTxDate = d;
      }
    }
  }

  const { start: requestedStart, end, prevStart, prevEnd } = getWindowBounds(
    timeframe,
    ref,
    earliestTxDate
  );

  // For multi-year horizons, avoid rendering years of empty zero bars before the first recorded transaction
  const isMultiYearHorizon =
    timeframe === '1Y' ||
    timeframe === '3Y' ||
    timeframe === '5Y' ||
    timeframe === '10Y';
  const isDataTruncatedToHistory = Boolean(
    isMultiYearHorizon &&
      earliestTxDate &&
      startOfDay(earliestTxDate) > requestedStart
  );
  const effectiveStart =
    isDataTruncatedToHistory && earliestTxDate
      ? startOfDay(earliestTxDate)
      : requestedStart;

  const { granularity, label: granularityLabel } = chooseGranularity(
    timeframe,
    effectiveStart,
    end
  );

  const inRangeTxs = transactions.filter((tx) => {
    const t = new Date(tx.date).getTime();
    return t >= requestedStart.getTime() && t <= end.getTime();
  });

  const buckets = buildTimelineSkeleton(effectiveStart, end, granularity, inRangeTxs);

  let totalIncome = 0;
  let totalExpenses = 0;
  const spentByCategory = new Map<string, number>();

  for (const tx of inRangeTxs) {
    const d = new Date(tx.date);
    const info = getBucketInfo(d, granularity);
    const bucket = buckets.get(info.key) ?? {
      bucketKey: info.key,
      label: info.label,
      income: 0,
      expenses: 0,
      savings: 0,
    };

    if (tx.type === 'INCOME') {
      totalIncome += tx.amount;
      bucket.income += tx.amount;
    } else {
      totalExpenses += tx.amount;
      bucket.expenses += tx.amount;
      spentByCategory.set(
        tx.categoryId,
        (spentByCategory.get(tx.categoryId) ?? 0) + tx.amount
      );
    }
    buckets.set(info.key, bucket);
  }

  const series: TimeframeSeriesPoint[] = Array.from(buckets.values()).map((b) => {
    const income = roundCurrency(b.income);
    const expenses = roundCurrency(b.expenses);
    return {
      ...b,
      income,
      expenses,
      savings: roundCurrency(income - expenses),
    };
  });

  totalIncome = roundCurrency(totalIncome);
  totalExpenses = roundCurrency(totalExpenses);
  const netSavings = roundCurrency(totalIncome - totalExpenses);
  const savingsRatePercent =
    totalIncome > 0
      ? roundCurrency(((totalIncome - totalExpenses) / totalIncome) * 100)
      : 0;

  // Compute exact active days covered for realistic daily / monthly averages
  const activeDaysCount = Math.max(
    1,
    Math.round((end.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const averageDailyExpense = roundCurrency(totalExpenses / activeDaysCount);
  const equivalentMonths = Math.max(1, activeDaysCount / 30.4375);
  const averageMonthlyExpense = roundCurrency(totalExpenses / equivalentMonths);

  // Previous equivalent period comparative KPIs
  let comparison: TimeframeComparisonKPIs | null = null;
  if (prevStart && prevEnd) {
    let prevIncome = 0;
    let prevExpenses = 0;
    let prevCount = 0;

    for (const tx of transactions) {
      const t = new Date(tx.date).getTime();
      if (t >= prevStart.getTime() && t <= prevEnd.getTime()) {
        prevCount += 1;
        if (tx.type === 'INCOME') prevIncome += tx.amount;
        else prevExpenses += tx.amount;
      }
    }

    prevIncome = roundCurrency(prevIncome);
    prevExpenses = roundCurrency(prevExpenses);
    const prevNet = roundCurrency(prevIncome - prevExpenses);

    comparison = {
      hasPreviousData: prevCount > 0,
      previousIncome: prevIncome,
      previousExpenses: prevExpenses,
      previousNetSavings: prevNet,
      incomeChangePercent:
        prevCount > 0 ? computePercentChange(totalIncome, prevIncome) : null,
      expensesChangePercent:
        prevCount > 0 ? computePercentChange(totalExpenses, prevExpenses) : null,
      netSavingsChangePercent:
        prevCount > 0 ? computePercentChange(netSavings, prevNet) : null,
    };
  }

  // Category distribution recalculated over the selected timeframe
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const categoryDistribution: CategoryDistributionPoint[] = Array.from(
    spentByCategory.entries()
  )
    .filter(([, amount]) => amount > 0)
    .map(([categoryId, rawAmount]) => {
      const cat = categoryMap.get(categoryId);
      const amount = roundCurrency(rawAmount);
      const percentage =
        totalExpenses > 0 ? roundCurrency((amount / totalExpenses) * 100) : 0;
      const monthlyLimit = cat?.monthlyLimit ?? 0;

      return {
        categoryId,
        name: cat?.name ?? 'Autre',
        color: cat?.color ?? '#141413',
        icon: cat?.icon ?? 'Tag',
        amount,
        percentage,
        monthlyLimit,
        status: 'green' as const,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const rangeLabel =
    timeframe === 'DAY'
      ? formatRangeDateFR(ref)
      : `${formatRangeDateFR(effectiveStart)} — ${formatRangeDateFR(end)}`;

  return {
    timeframe,
    granularity,
    granularityLabel,
    requestedStartDate: requestedStart.toISOString(),
    effectiveStartDate: effectiveStart.toISOString(),
    endDate: end.toISOString(),
    earliestTransactionDate: earliestTxDate ? earliestTxDate.toISOString() : null,
    isDataTruncatedToHistory,
    rangeLabel,
    transactionCount: inRangeTxs.length,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRatePercent,
    activeDaysCount,
    averageDailyExpense,
    averageMonthlyExpense,
    comparison,
    series,
    categoryDistribution,
  };
}

export { formatDayMonth };
