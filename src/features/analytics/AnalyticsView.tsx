'use client';

import React, { useState } from 'react';
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
  CategoryDistributionPoint,
  MonthlyEvolutionPoint,
  OptimizationTip,
  RebalanceSuggestion,
  formatCurrency,
  formatMonthLabel,
  formatPercent,
} from '@/core';
import {
  AlertStatusBadge,
  Badge,
  Button,
  Card,
  CategoryIcon,
  SectionHeader,
  useTheme,
} from '@/components/ui';
import { cn } from '@/lib/cn';

export function AnalyticsView({
  selectedMonthKey,
  distribution,
  monthlyEvolution,
  tips,
  currency = 'EUR',
  onApplyRebalance,
}: {
  selectedMonthKey: string;
  distribution: CategoryDistributionPoint[];
  monthlyEvolution: MonthlyEvolutionPoint[];
  tips: OptimizationTip[];
  currency?: string;
  onApplyRebalance: (rebalance: RebalanceSuggestion) => Promise<void>;
}) {
  const { theme } = useTheme();
  const [rebalancingId, setRebalancingId] = useState<string | null>(null);

  const totalMonthSpent = distribution.reduce((sum, d) => sum + d.amount, 0);
  const isDark = theme === 'dark';

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
        return <ArrowLeftRight className="h-4 w-4 text-[#FF3B30] dark:text-[#FF453A]" />;
      case 'surge':
        return <TrendingUp className="h-4 w-4 text-[#FF9500] dark:text-[#FF9F0A]" />;
      case 'daily_budget':
        return <Gauge className="h-4 w-4 text-[#FF9500] dark:text-[#FF9F0A]" />;
      case 'savings':
        return <CheckCircle2 className="h-4 w-4 text-[#34C759] dark:text-[#30D158]" />;
      case 'cash_erosion':
        return <Flame className="h-4 w-4 text-[#FF9500] dark:text-[#FF9F0A]" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-[#FF3B30] dark:text-[#FF453A]" />;
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Analyse & Optimisation"
        subtitle={`Recommandations intelligentes et tendances · ${formatMonthLabel(selectedMonthKey)}`}
      />

      {/* 1. OPTIMIZATION ENGINE CONTEXTUAL CARDS */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#007AFF] dark:text-[#0A84FF]" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Moteur d’optimisation ({tips.length} conseil{tips.length > 1 ? 's' : ''})
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {tips.map((tip) => (
            <Card
              key={tip.id}
              className={cn(
                'p-4 sm:p-5 flex flex-col justify-between gap-3.5 border-l-4',
                tip.severity === 'critical' &&
                  'border-l-[#FF3B30] dark:border-l-[#FF453A]',
                tip.severity === 'warning' &&
                  'border-l-[#FF9500] dark:border-l-[#FF9F0A]',
                tip.severity === 'positive' &&
                  'border-l-[#34C759] dark:border-l-[#30D158]',
                tip.severity === 'info' &&
                  'border-l-[#007AFF] dark:border-l-[#0A84FF]'
              )}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2">
                    <span className="h-7 w-7 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] flex items-center justify-center">
                      {getTipIcon(tip)}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
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

                <h4 className="text-[15px] font-semibold text-zinc-900 dark:text-white leading-snug">
                  {tip.title}
                </h4>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
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

      {/* 2. CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Donut Chart: Spending Distribution by Category */}
        <Card className="p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white">
              Répartition des dépenses
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Ventilation par catégorie sur {formatMonthLabel(selectedMonthKey)}
            </p>
          </div>

          {distribution.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-zinc-400">
              Aucune dépense enregistrée sur ce mois.
            </div>
          ) : (
            <>
              <div className="relative h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={88}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {distribution.map((entry) => (
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

                {/* Center total inside donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] font-medium text-zinc-400">Total</span>
                  <span className="text-lg font-bold tabular-nums text-zinc-900 dark:text-white">
                    {formatCurrency(totalMonthSpent, currency)}
                  </span>
                </div>
              </div>

              {/* Ranked breakdown list */}
              <div className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
                {distribution.map((item) => (
                  <div
                    key={item.categoryId}
                    className="flex items-center justify-between gap-2 py-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CategoryIcon icon={item.icon} color={item.color} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-zinc-400 tabular-nums">
                          {formatPercent(item.percentage, 1)} du total
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.monthlyLimit > 0 && item.status !== 'green' && (
                        <AlertStatusBadge
                          status={item.status}
                          usagePercent={(item.amount / item.monthlyLimit) * 100}
                        />
                      )}
                      <span className="text-xs font-bold tabular-nums text-zinc-900 dark:text-white">
                        {formatCurrency(item.amount, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Bar Chart: Monthly Evolution (Last 6 Months) */}
        <Card className="p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white">
              Évolution mensuelle (6 mois)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Comparaison de vos revenus et dépenses mois par mois
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyEvolution}
                margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
                barGap={4}
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
                  tickFormatter={(v) => `${Math.round(v)}€`}
                />
                <Tooltip
                  cursor={{
                    fill: isDark ? 'rgba(242,240,232,0.04)' : 'rgba(20,20,19,0.03)',
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value, currency),
                    name === 'income' ? 'Revenus' : 'Dépenses',
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
                  maxBarSize={20}
                />
                <Bar
                  dataKey="expenses"
                  name="expenses"
                  fill={isDark ? '#F2F0E8' : '#141413'}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Net Savings Strip */}
          <div className="space-y-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.07]">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#34C759]" />
                  Revenus
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#007AFF]" />
                  Dépenses
                </span>
              </div>
              <span>Solde net / mois</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {monthlyEvolution.map((m) => (
                <div
                  key={m.monthKey}
                  className="rounded-xl bg-zinc-50 dark:bg-white/[0.04] px-2 py-1.5 text-center"
                >
                  <p className="text-[10px] text-zinc-400 truncate">{m.label}</p>
                  <p
                    className={cn(
                      'text-[11px] font-bold tabular-nums mt-0.5',
                      m.savings >= 0
                        ? 'text-[#34C759] dark:text-[#30D158]'
                        : 'text-[#FF3B30] dark:text-[#FF453A]'
                    )}
                  >
                    {formatCurrency(m.savings, currency, {
                      compact: true,
                      showSign: true,
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
