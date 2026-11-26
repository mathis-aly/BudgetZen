'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Flame,
  Gauge,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AnalyticsTimeframe,
  CategoryDTO,
  OptimizationTip,
  RebalanceSuggestion,
  TransactionDTO,
  aggregateSeriesByTimeframe,
  formatCurrency,
  formatPercent,
} from '@/core';
import {
  Badge,
  Button,
  Card,
  CategoryIcon,
  RollingNumber,
  SectionHeader,
  TimeframeSelector,
  useTheme,
} from '@/components/ui';
import { cn } from '@/lib/cn';

function formatDeltaBadge(val: number | null): string | null {
  if (val === null) return null;
  return `${val > 0 ? '+' : ''}${formatPercent(val, 1)}`;
}

export function AnalyticsView({
  transactions,
  categories,
  tips,
  currency = 'EUR',
  onApplyRebalance,
}: {
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  tips: OptimizationTip[];
  currency?: string;
  onApplyRebalance: (rebalance: RebalanceSuggestion) => Promise<void>;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('1Y');
  const [rebalancingId, setRebalancingId] = useState<string | null>(null);

  const analytics = useMemo(
    () =>
      aggregateSeriesByTimeframe(transactions, timeframe, {
        categories,
        referenceDate: new Date(),
      }),
    [transactions, timeframe, categories]
  );

  const historyNotice = useMemo(() => {
    if (!analytics.isDataTruncatedToHistory || !analytics.earliestTransactionDate) {
      return null;
    }
    const formattedStart = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(analytics.earliestTransactionDate));
    return `Note : l’historique enregistré débute le ${formattedStart} — seules les périodes disponibles sont affichées.`;
  }, [analytics.isDataTruncatedToHistory, analytics.earliestTransactionDate]);

  const handleApplyRebalance = async (tipId: string, rebalance: RebalanceSuggestion) => {
    setRebalancingId(tipId);
    try {
      await onApplyRebalance(rebalance);
    } finally {
      setRebalancingId(null);
    }
  };

  const getTipIcon = (tip: OptimizationTip) => {
    switch (tip.type) {
      case 'rebalance':
        return <ArrowLeftRight className="h-4 w-4 text-[#B91C1C] dark:text-[#EF4444]" />;
      case 'surge':
        return <TrendingUp className="h-4 w-4 text-[#B45309] dark:text-[#F59E0B]" />;
      case 'daily_budget':
        return <Gauge className="h-4 w-4 text-[#B45309] dark:text-[#F59E0B]" />;
      case 'savings':
        return <CheckCircle2 className="h-4 w-4 text-[#15803D] dark:text-[#22C55E]" />;
      case 'cash_erosion':
        return <Flame className="h-4 w-4 text-[#B45309] dark:text-[#F59E0B]" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-[#B91C1C] dark:text-[#EF4444]" />;
    }
  };

  const isShortHorizon =
    timeframe === 'DAY' || timeframe === 'WEEK' || timeframe === 'MONTH';
  const incomeDelta = formatDeltaBadge(
    analytics.comparison?.incomeChangePercent ?? null
  );
  const expenseDelta = formatDeltaBadge(
    analytics.comparison?.expensesChangePercent ?? null
  );
  const savingsDelta = formatDeltaBadge(
    analytics.comparison?.netSavingsChangePercent ?? null
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Analyse & Optimisation"
        subtitle="Agrégation temporelle multi-horizons, ventilation sectorielle et recommandations"
      />

      {/* 1. SWISS EDITORIAL MULTI-HORIZON TIMEFRAME SELECTOR */}
      <TimeframeSelector
        value={timeframe}
        onChange={setTimeframe}
        rangeLabel={analytics.rangeLabel}
        granularityLabel={analytics.granularityLabel}
        historyNotice={historyNotice}
      />

      {/* 2. COMPARATIVE KPI SYNTHESIS STRIP (4 HAIRLINE CELLS) */}
      <Card padded={false} className="overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E0D8] dark:divide-[#2A2A27]">
          {/* Entrées */}
          <div className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="editorial-kicker">Entrées</p>
              {incomeDelta && (
                <Badge
                  tone={
                    (analytics.comparison?.incomeChangePercent ?? 0) >= 0
                      ? 'green'
                      : 'red'
                  }
                >
                  {incomeDelta}
                </Badge>
              )}
            </div>
            <p className="font-mono text-xl font-semibold tabular-nums text-[#15803D] dark:text-[#22C55E] mt-1.5">
              <RollingNumber value={analytics.totalIncome} currency={currency} />
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5">
              {analytics.comparison?.hasPreviousData
                ? `Préc. ${formatCurrency(analytics.comparison.previousIncome, currency)}`
                : `${analytics.transactionCount} opération(s)`}
            </p>
          </div>

          {/* Sorties */}
          <div className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="editorial-kicker">Sorties</p>
              {expenseDelta && (
                <Badge
                  tone={
                    (analytics.comparison?.expensesChangePercent ?? 0) <= 0
                      ? 'green'
                      : 'orange'
                  }
                >
                  {expenseDelta}
                </Badge>
              )}
            </div>
            <p className="font-mono text-xl font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1.5">
              <RollingNumber value={analytics.totalExpenses} currency={currency} />
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5">
              {analytics.comparison?.hasPreviousData
                ? `Préc. ${formatCurrency(analytics.comparison.previousExpenses, currency)}`
                : `${analytics.categoryDistribution.length} catégorie(s)`}
            </p>
          </div>

          {/* Épargne nette & Taux */}
          <div className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="editorial-kicker">Épargne nette</p>
              {savingsDelta && (
                <Badge
                  tone={
                    (analytics.comparison?.netSavingsChangePercent ?? 0) >= 0
                      ? 'green'
                      : 'red'
                  }
                >
                  {savingsDelta}
                </Badge>
              )}
            </div>
            <p
              className={cn(
                'font-mono text-xl font-semibold tabular-nums mt-1.5',
                analytics.netSavings >= 0
                  ? 'text-[#15803D] dark:text-[#22C55E]'
                  : 'text-[#B91C1C] dark:text-[#EF4444]'
              )}
            >
              <RollingNumber value={analytics.netSavings} currency={currency} />
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5">
              Taux d’épargne moyen :{' '}
              <strong className="text-[#141413] dark:text-[#F2F0E8]">
                {formatPercent(analytics.savingsRatePercent, 1)}
              </strong>
            </p>
          </div>

          {/* Dépense moyenne */}
          <div className="p-4">
            <p className="editorial-kicker">
              {isShortHorizon ? 'Dépense moy. / jour' : 'Dépense moy. / mois'}
            </p>
            <p className="font-mono text-xl font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1.5">
              <RollingNumber
                value={
                  isShortHorizon
                    ? analytics.averageDailyExpense
                    : analytics.averageMonthlyExpense
                }
                currency={currency}
              />
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5 tabular-nums">
              {isShortHorizon
                ? `Sur ${analytics.activeDaysCount} jour${analytics.activeDaysCount > 1 ? 's' : ''}`
                : `${formatCurrency(analytics.averageDailyExpense, currency)} / jour`}
            </p>
          </div>
        </div>
      </Card>

      {/* 3. CHARTS GRID (EVOLUTION + CATEGORY DISTRIBUTION) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Evolution BarChart adapting automatically to granularity */}
        <Card className="p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-serif text-[18px] font-medium text-[#141413] dark:text-[#F2F0E8]">
                Revenus vs Dépenses
              </h3>
              <p className="font-mono text-[11px] text-[#5C5B57] dark:text-[#9A9890]">
                {analytics.granularityLabel} · {analytics.series.length} période
                {analytics.series.length > 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.06em] text-[#5C5B57] dark:text-[#9A9890]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[1px] bg-[#15803D] dark:bg-[#22C55E]" />
                Entrées
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[1px] bg-[#141413] dark:bg-[#F2F0E8]" />
                Sorties
              </span>
            </div>
          </div>

          {analytics.series.length === 0 ? (
            <div className="h-64 flex items-center justify-center border border-dashed border-[#E2E0D8] dark:border-[#2A2A27] rounded-md text-xs text-[#5C5B57] dark:text-[#9A9890]">
              Aucune opération enregistrée sur cette période.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.series}
                  margin={{ top: 8, right: 4, left: -14, bottom: 0 }}
                  barGap={3}
                >
                  <CartesianGrid
                    strokeDasharray="2 3"
                    vertical={false}
                    stroke={isDark ? '#2A2A27' : '#E2E0D8'}
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={{ stroke: isDark ? '#2A2A27' : '#E2E0D8' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={16}
                    tick={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      fill: isDark ? '#9A9890' : '#5C5B57',
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      fill: isDark ? '#9A9890' : '#5C5B57',
                    }}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${(v / 1000).toFixed(1)}k€` : `${Math.round(v)}€`
                    }
                  />
                  <Tooltip
                    cursor={{
                      fill: isDark
                        ? 'rgba(242,240,232,0.04)'
                        : 'rgba(20,20,19,0.03)',
                    }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value, currency),
                      name === 'income' ? 'Entrées' : 'Sorties',
                    ]}
                    contentStyle={{
                      borderRadius: '4px',
                      border: isDark ? '1px solid #2A2A27' : '1px solid #E2E0D8',
                      backgroundColor: isDark ? '#181816' : '#FFFFFF',
                      color: isDark ? '#F2F0E8' : '#141413',
                      boxShadow: 'none',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  />
                  <Bar
                    dataKey="income"
                    name="income"
                    fill={isDark ? '#22C55E' : '#15803D'}
                    radius={[2, 2, 0, 0]}
                    maxBarSize={22}
                  />
                  <Bar
                    dataKey="expenses"
                    name="expenses"
                    fill={isDark ? '#F2F0E8' : '#141413'}
                    radius={[2, 2, 0, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Compact Period Net Flow Strip (last up to 6 buckets) */}
          {analytics.series.length > 0 && (
            <div className="pt-3 border-t border-[#E2E0D8] dark:border-[#2A2A27]">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {analytics.series.slice(-6).map((pt) => (
                  <div
                    key={pt.bucketKey}
                    className="rounded-sm border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413] px-2 py-1.5 text-center"
                  >
                    <p className="font-mono text-[9px] text-[#5C5B57] dark:text-[#9A9890] truncate">
                      {pt.label}
                    </p>
                    <p
                      className={cn(
                        'font-mono text-[10px] font-semibold tabular-nums mt-0.5',
                        pt.savings >= 0
                          ? 'text-[#15803D] dark:text-[#22C55E]'
                          : 'text-[#B91C1C] dark:text-[#EF4444]'
                      )}
                    >
                      {formatCurrency(pt.savings, currency, {
                        compact: true,
                        showSign: true,
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Category Distribution Donut recalculated over the selected timeframe */}
        <Card className="p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="font-serif text-[18px] font-medium text-[#141413] dark:text-[#F2F0E8]">
              Répartition des dépenses
            </h3>
            <p className="font-mono text-[11px] text-[#5C5B57] dark:text-[#9A9890]">
              Ventilation sur la période · {analytics.rangeLabel}
            </p>
          </div>

          {analytics.categoryDistribution.length === 0 ? (
            <div className="h-56 flex items-center justify-center border border-dashed border-[#E2E0D8] dark:border-[#2A2A27] rounded-md text-xs text-[#5C5B57] dark:text-[#9A9890]">
              Aucune dépense enregistrée sur cet horizon.
            </div>
          ) : (
            <>
              <div className="relative h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.categoryDistribution}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={86}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {analytics.categoryDistribution.map((entry) => (
                        <Cell key={entry.categoryId} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value, currency)}
                      contentStyle={{
                        borderRadius: '4px',
                        border: isDark ? '1px solid #2A2A27' : '1px solid #E2E0D8',
                        backgroundColor: isDark ? '#181816' : '#FFFFFF',
                        color: isDark ? '#F2F0E8' : '#141413',
                        boxShadow: 'none',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="editorial-kicker">Total</span>
                  <span className="font-mono text-base font-bold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-0.5">
                    {formatCurrency(analytics.totalExpenses, currency)}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-[#E2E0D8] dark:divide-[#2A2A27]">
                {analytics.categoryDistribution.map((item) => (
                  <div
                    key={item.categoryId}
                    className="flex items-center justify-between gap-2 py-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CategoryIcon icon={item.icon} color={item.color} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#141413] dark:text-[#F2F0E8] truncate">
                          {item.name}
                        </p>
                        <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] tabular-nums">
                          {formatPercent(item.percentage, 1)} du total
                        </p>
                      </div>
                    </div>

                    <span className="font-mono text-xs font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] shrink-0">
                      {formatCurrency(item.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* 4. OPTIMIZATION ENGINE CONTEXTUAL CARDS */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#141413] dark:text-[#F2F0E8]" />
          <h3 className="font-serif text-[19px] font-medium text-[#141413] dark:text-[#F2F0E8]">
            Moteur d’optimisation ({tips.length} conseil{tips.length > 1 ? 's' : ''})
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {tips.map((tip) => (
            <Card
              key={tip.id}
              className={cn(
                'p-4 sm:p-5 flex flex-col justify-between gap-3.5 border-l-2',
                tip.severity === 'critical' &&
                  'border-l-[#B91C1C] dark:border-l-[#EF4444]',
                tip.severity === 'warning' &&
                  'border-l-[#B45309] dark:border-l-[#F59E0B]',
                tip.severity === 'positive' &&
                  'border-l-[#15803D] dark:border-l-[#22C55E]',
                tip.severity === 'info' &&
                  'border-l-[#141413] dark:border-l-[#F2F0E8]'
              )}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2">
                    <span className="h-7 w-7 rounded-sm border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413] flex items-center justify-center">
                      {getTipIcon(tip)}
                    </span>
                    <span className="editorial-kicker">
                      {tip.type === 'rebalance'
                        ? 'Rééquilibrage'
                        : tip.type === 'surge'
                          ? 'Détection de hausse'
                          : tip.type === 'daily_budget'
                            ? 'Budget journalier'
                            : tip.type === 'savings'
                              ? 'Épargne'
                              : tip.type === 'cash_erosion'
                                ? 'Érosion monétaire'
                                : 'Rythme mensuel'}
                    </span>
                  </div>

                  <Badge
                    tone={
                      tip.severity === 'critical'
                        ? 'red'
                        : tip.severity === 'warning'
                          ? 'orange'
                          : tip.severity === 'positive'
                            ? 'green'
                            : 'blue'
                    }
                  >
                    {tip.metric}
                  </Badge>
                </div>

                <h4 className="font-serif text-[17px] font-medium text-[#141413] dark:text-[#F2F0E8] leading-snug">
                  {tip.title}
                </h4>
                <p className="text-xs leading-relaxed text-[#5C5B57] dark:text-[#9A9890]">
                  {tip.description}
                </p>
              </div>

              {tip.rebalance && (
                <Button
                  size="sm"
                  variant="primary"
                  loading={rebalancingId === tip.id}
                  onClick={() => handleApplyRebalance(tip.id, tip.rebalance!)}
                  className="w-full"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  Transférer {formatCurrency(tip.rebalance.amount, currency)} (
                  {tip.rebalance.fromCategoryName} → {tip.rebalance.toCategoryName})
                </Button>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
