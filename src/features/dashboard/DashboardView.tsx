'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Flame,
  Pencil,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  AccountSettingsDTO,
  BudgetSummary,
  CashErosionResult,
  CategoryBudgetStatus,
  CategoryDTO,
  OptimizationTip,
  RebalanceSuggestion,
  TransactionDTO,
  UpcomingRecurringItem,
  formatCurrency,
  formatDateShort,
  formatPercent,
} from '@/core';
import {
  AlertStatusBadge,
  Badge,
  Button,
  Card,
  CategoryIcon,
  EditorialBlock,
  EditorialStagger,
  ProgressBar,
  RollingNumber,
  SectionHeader,
  SpendingPaceGauge,
} from '@/components/ui';
import { cn } from '@/lib/cn';

export type NavTab =
  | 'dashboard'
  | 'transactions'
  | 'categories'
  | 'recurring'
  | 'wealth'
  | 'price-tracker'
  | 'monthly-close'
  | 'taxes'
  | 'custom-indices'
  | 'analytics'
  | 'settings';

export function DashboardView({
  settings,
  summary,
  cashErosion,
  categoryStatuses,
  upcomingRecurring,
  recentTransactions,
  categories,
  topTip,
  onNavigate,
  onEditBalance,
  onOpenExceptionalExpense,
  onValidateRecurring,
  onApplyRebalance,
  onEditTransaction,
}: {
  settings: AccountSettingsDTO;
  summary: BudgetSummary;
  cashErosion: CashErosionResult;
  categoryStatuses: CategoryBudgetStatus[];
  upcomingRecurring: UpcomingRecurringItem[];
  recentTransactions: TransactionDTO[];
  categories: CategoryDTO[];
  topTip: OptimizationTip | null;
  onNavigate: (tab: NavTab) => void;
  onEditBalance: () => void;
  onOpenExceptionalExpense: () => void;
  onValidateRecurring: (item: UpcomingRecurringItem) => Promise<void>;
  onApplyRebalance: (rebalance: RebalanceSuggestion) => Promise<void>;
  onEditTransaction: (tx: TransactionDTO) => void;
}) {
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [rebalancing, setRebalancing] = useState(false);

  const currency = settings.currency || 'EUR';
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const alertCategories = categoryStatuses.filter(
    (s) => s.status === 'red' || s.status === 'orange'
  );
  const healthyCategories = categoryStatuses
    .filter((s) => s.status === 'green' && s.monthlyLimit > 0)
    .slice(0, 4);

  const handleValidate = async (item: UpcomingRecurringItem) => {
    setValidatingId(item.payment.id);
    try {
      await onValidateRecurring(item);
    } finally {
      setValidatingId(null);
    }
  };

  const handleRebalance = async (rebalance: RebalanceSuggestion) => {
    setRebalancing(true);
    try {
      await onApplyRebalance(rebalance);
    } finally {
      setRebalancing(false);
    }
  };

  return (
    <EditorialStagger className="space-y-6">
      {/* 1. HERO LEDGER CARD: Editorial Serif Reste à Vivre + Swiss Grid Breakdown + Gauge */}
      <EditorialBlock>
        <Card padded={false} className="overflow-hidden">
          {/* Top Hero Row */}
          <div className="p-5 sm:p-6 flex items-start justify-between gap-4">
            <div>
              <p className="editorial-kicker">
                Position nette disponible · Reste à vivre exact
              </p>

              <p
                className={cn(
                  'font-serif text-[44px] sm:text-[56px] font-normal tracking-[-0.025em] leading-[1.05] mt-2',
                  summary.resteAVivre < 0
                    ? 'text-[#B91C1C] dark:text-[#EF4444]'
                    : 'text-[#141413] dark:text-[#F2F0E8]'
                )}
              >
                <RollingNumber value={summary.resteAVivre} currency={currency} />
              </p>
              <p className="text-xs text-[#5C5B57] dark:text-[#9A9890] mt-2">
                Disponible après déduction des échéances fixes restantes et du bouclier de
                sécurité ({formatPercent(summary.mandatoryReserveRate, 1)})
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={onEditBalance}
              title="Ajuster le solde bancaire"
              className="shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ajuster solde</span>
            </Button>
          </div>

          {/* Swiss Financial Press 4-Column Hairline Divider Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-[#E2E0D8] dark:border-[#2A2A27] divide-y sm:divide-y-0 sm:divide-x divide-[#E2E0D8] dark:divide-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413]">
            <div className="p-3.5 sm:p-4">
              <p className="editorial-kicker">Solde actuel</p>
              <p className="font-mono text-base sm:text-lg font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1">
                {formatCurrency(summary.currentBalance, currency)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('recurring')}
              className="p-3.5 sm:p-4 text-left hover:bg-[#F7F6F2] dark:hover:bg-[#1E1E1B] transition-colors"
            >
              <p className="editorial-kicker">
                Fixes restants ({summary.remainingFixedCount})
              </p>
              <p className="font-mono text-base sm:text-lg font-semibold tabular-nums text-[#B45309] dark:text-[#F59E0B] mt-1">
                {summary.remainingFixedCharges > 0
                  ? formatCurrency(-summary.remainingFixedCharges, currency)
                  : '0 €'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="p-3.5 sm:p-4 text-left hover:bg-[#F7F6F2] dark:hover:bg-[#1E1E1B] transition-colors"
            >
              <p className="editorial-kicker">
                Bouclier ({formatPercent(summary.mandatoryReserveRate, 1)})
              </p>
              <p className="font-mono text-base sm:text-lg font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1">
                {summary.reserveRemainingThisMonth > 0
                  ? formatCurrency(-summary.reserveRemainingThisMonth, currency)
                  : '0 €'}
              </p>
            </button>

            <div className="p-3.5 sm:p-4">
              <p className="editorial-kicker">
                Budget / jour ({summary.daysRemainingInMonth}j)
              </p>
              <p className="font-mono text-base sm:text-lg font-semibold tabular-nums text-[#15803D] dark:text-[#22C55E] mt-1">
                {formatCurrency(summary.dailySafeSpend, currency)}
              </p>
            </div>
          </div>

          {/* Surgical Spending Pace Gauge */}
          <div className="p-4 sm:px-6 sm:py-4 border-t border-[#E2E0D8] dark:border-[#2A2A27]">
            <SpendingPaceGauge
              spendingPacePercent={summary.spendingPacePercent}
              monthProgressPercent={summary.monthProgressPercent}
              paceStatus={summary.paceStatus}
              currentDayOfMonth={summary.currentDayOfMonth}
              daysInMonth={summary.daysInMonth}
            />
          </div>
        </Card>
      </EditorialBlock>

      {/* 1B. BOUCLIER IMPRÉVUS (MANDATORY RESERVE) — Matte Editorial Strip */}
      <EditorialBlock>
        <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-2 border-l-[#15803D] dark:border-l-[#22C55E]">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="h-9 w-9 rounded-md border border-[#15803D]/25 dark:border-[#22C55E]/30 bg-[#15803D]/[0.07] dark:bg-[#22C55E]/[0.1] text-[#15803D] dark:text-[#22C55E] flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-[#141413] dark:text-[#F2F0E8]">
                  Bouclier Imprévus · Réserve {formatPercent(summary.mandatoryReserveRate, 1)}
                </p>
                <Badge tone="green">
                  {formatCurrency(summary.reserveRemainingThisMonth, currency)} SÉCURISÉS
                </Badge>
              </div>
              <div className="max-w-md">
                <ProgressBar
                  value={
                    summary.mandatoryReserveAmount > 0
                      ? (summary.reserveRemainingThisMonth /
                          summary.mandatoryReserveAmount) *
                        100
                      : 0
                  }
                  status="green"
                  markerPercent={80}
                  height="sm"
                />
              </div>
              <p className="font-mono text-[11px] text-[#5C5B57] dark:text-[#9A9890] tabular-nums">
                {summary.reserveUsedThisMonth > 0
                  ? `${formatCurrency(summary.reserveUsedThisMonth, currency)} utilisés sur ${formatCurrency(summary.mandatoryReserveAmount, currency)} bloqués`
                  : `${formatCurrency(summary.mandatoryReserveAmount, currency)} bloqués automatiquement sur les revenus du mois`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={onOpenExceptionalExpense}>
              Imprévu
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigate('settings')}
              className="font-mono text-[11px]"
            >
              Ajuster →
            </Button>
          </div>
        </Card>
      </EditorialBlock>

      {/* 2. PRIORITY ALERTS: Orange & Red Categories Automatically Promoted */}
      {alertCategories.length > 0 && (
        <EditorialBlock>
          <section>
            <SectionHeader
              title="Alertes prioritaires"
              subtitle="Postes ayant franchi leur seuil de vigilance (80 %) ou leur plafond mensuel"
              action={
                <button
                  type="button"
                  onClick={() => onNavigate('categories')}
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#141413] dark:text-[#F2F0E8] hover:underline"
                >
                  Plafonds
                  <ArrowRight className="h-3 w-3" />
                </button>
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {alertCategories.map((item) => {
                const isRed = item.status === 'red';
                return (
                  <Card
                    key={item.category.id}
                    className={cn(
                      'p-4 border-l-2',
                      isRed
                        ? 'border-l-[#B91C1C] dark:border-l-[#EF4444]'
                        : 'border-l-[#B45309] dark:border-l-[#F59E0B]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2.5 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryIcon
                          icon={item.category.icon}
                          color={item.category.color}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#141413] dark:text-[#F2F0E8] truncate">
                            {item.category.name}
                          </p>
                          <p className="font-mono text-xs text-[#5C5B57] dark:text-[#9A9890] tabular-nums">
                            {formatCurrency(item.spent, currency)} /{' '}
                            {formatCurrency(item.monthlyLimit, currency)}
                          </p>
                        </div>
                      </div>
                      <AlertStatusBadge
                        status={item.status}
                        usagePercent={item.usagePercent}
                      />
                    </div>

                    <ProgressBar
                      value={item.usagePercent}
                      status={item.status}
                      markerPercent={item.category.alertThreshold}
                      height="md"
                    />

                    <div className="flex items-center justify-between mt-2.5 font-mono text-[11px] tabular-nums">
                      {isRed ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#B91C1C] dark:text-[#EF4444]">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Dépassement : +{formatCurrency(Math.abs(item.remaining), currency)}
                        </span>
                      ) : (
                        <span className="font-semibold text-[#B45309] dark:text-[#F59E0B]">
                          Reste : {formatCurrency(item.remaining, currency)}
                        </span>
                      )}
                      <span className="text-[#5C5B57] dark:text-[#9A9890]">
                        Seuil {item.category.alertThreshold}%
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        </EditorialBlock>
      )}

      {/* 3. UPCOMING FIXED PAYMENTS + TOP OPTIMIZER RECOMMENDATION */}
      <EditorialBlock>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Upcoming 7-day recurring bills */}
          <section>
            <SectionHeader
              title="Prélèvements sous 7 jours"
              subtitle={
                upcomingRecurring.length > 0
                  ? `${upcomingRecurring.length} échéance(s) fixe(s) imminente(s)`
                  : 'Aucune charge fixe imminente'
              }
              action={
                <button
                  type="button"
                  onClick={() => onNavigate('recurring')}
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#141413] dark:text-[#F2F0E8] hover:underline"
                >
                  Échéancier
                  <ArrowRight className="h-3 w-3" />
                </button>
              }
            />

            <Card
              padded={false}
              className="overflow-hidden divide-y divide-[#E2E0D8] dark:divide-[#2A2A27]"
            >
              {upcomingRecurring.length === 0 ? (
                <div className="p-6 text-center space-y-1.5">
                  <CheckCircle2 className="h-6 w-6 text-[#15803D] dark:text-[#22C55E] mx-auto" />
                  <p className="text-sm font-semibold text-[#141413] dark:text-[#F2F0E8]">
                    Échéancier à jour
                  </p>
                  <p className="text-xs text-[#5C5B57] dark:text-[#9A9890]">
                    Aucun prélèvement fixe prévu sur les 7 prochains jours.
                  </p>
                </div>
              ) : (
                upcomingRecurring.map((item) => {
                  const dueLabel = item.isOverdue
                    ? `RETARD ${Math.abs(item.daysUntilDue)}J`
                    : item.daysUntilDue === 0
                      ? "AUJOURD'HUI"
                      : item.daysUntilDue === 1
                        ? 'DEMAIN'
                        : `J+${item.daysUntilDue}`;

                  return (
                    <div
                      key={`${item.payment.id}-${item.billingMonth}`}
                      className="flex items-center justify-between gap-3 px-4 py-3.5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryIcon
                          icon={item.category?.icon ?? 'CalendarClock'}
                          color={item.category?.color ?? '#141413'}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#141413] dark:text-[#F2F0E8] truncate">
                            {item.payment.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge
                              tone={
                                item.isOverdue
                                  ? 'red'
                                  : item.daysUntilDue <= 2
                                    ? 'orange'
                                    : 'neutral'
                              }
                            >
                              <CalendarClock className="h-2.5 w-2.5" />
                              {dueLabel}
                            </Badge>
                            <span className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890]">
                              le {item.payment.dayOfMonth}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-mono text-sm font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8]">
                          {formatCurrency(item.payment.amount, currency)}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={validatingId === item.payment.id}
                          onClick={() => handleValidate(item)}
                          className="h-7 px-2.5 font-mono text-[10px] text-[#15803D] border-[#15803D]/30 hover:bg-[#15803D]/[0.08] dark:text-[#22C55E] dark:border-[#22C55E]/35"
                          title="Marquer comme débité en un clic"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Débité
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </Card>
          </section>

          {/* Top Optimization Recommendation */}
          <section>
            <SectionHeader
              title="Note d’optimisation"
              subtitle="Synthèse analytique et érosion monétaire"
              action={
                <button
                  type="button"
                  onClick={() => onNavigate('analytics')}
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#141413] dark:text-[#F2F0E8] hover:underline"
                >
                  Analyse
                  <ArrowRight className="h-3 w-3" />
                </button>
              }
            />

            {topTip ? (
              <Card className="p-4 sm:p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 editorial-kicker">
                      <Sparkles className="h-3.5 w-3.5 text-[#141413] dark:text-[#F2F0E8]" />
                      Recommandation prioritaire
                    </span>
                    <Badge
                      tone={
                        topTip.severity === 'critical'
                          ? 'red'
                          : topTip.severity === 'warning'
                            ? 'orange'
                            : topTip.severity === 'positive'
                              ? 'green'
                              : 'blue'
                      }
                    >
                      {topTip.metric}
                    </Badge>
                  </div>

                  <h3 className="font-serif text-lg font-medium text-[#141413] dark:text-[#F2F0E8] leading-snug">
                    {topTip.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-[#5C5B57] dark:text-[#9A9890]">
                    {topTip.description}
                  </p>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-[#E2E0D8] dark:border-[#2A2A27]">
                  {topTip.rebalance ? (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={rebalancing}
                      onClick={() => handleRebalance(topTip.rebalance!)}
                      className="w-full"
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      Appliquer le rééquilibrage (
                      {formatCurrency(topTip.rebalance.amount, currency)})
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onNavigate('analytics')}
                      className="w-full"
                    >
                      Consulter toutes les recommandations
                    </Button>
                  )}

                  {/* Discrete Cash Erosion Alert Strip */}
                  {cashErosion.annualLoss >= 5 && (
                    <button
                      type="button"
                      onClick={() => onNavigate('wealth')}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-sm border border-[#B45309]/25 dark:border-[#F59E0B]/30 bg-[#B45309]/[0.06] hover:bg-[#B45309]/[0.11] dark:bg-[#F59E0B]/[0.09] transition-colors text-left"
                    >
                      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold text-[#B45309] dark:text-[#F59E0B] min-w-0 truncate">
                        <Flame className="h-3.5 w-3.5 shrink-0" />
                        ÉROSION CASH DORMANT ({formatPercent(cashErosion.inflationRate, 1)}/AN)
                      </span>
                      <span className="font-mono text-[11px] font-bold tabular-nums text-[#B45309] dark:text-[#F59E0B] shrink-0">
                        −{formatCurrency(cashErosion.annualLoss, currency)}/an
                      </span>
                    </button>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-6 text-center">
                <p className="text-xs text-[#5C5B57] dark:text-[#9A9890]">
                  Aucune recommandation active.
                </p>
              </Card>
            )}
          </section>
        </div>
      </EditorialBlock>

      {/* 4. HEALTHY BUDGETS + RECENT TRANSACTIONS */}
      <EditorialBlock>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Healthy Budgets */}
          <section>
            <SectionHeader
              title="Enveloppes maîtrisées"
              subtitle="Budgets mensuels sous le seuil de vigilance"
              action={
                <button
                  type="button"
                  onClick={() => onNavigate('categories')}
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#141413] dark:text-[#F2F0E8] hover:underline"
                >
                  Tout voir
                  <ArrowRight className="h-3 w-3" />
                </button>
              }
            />
            <Card
              padded={false}
              className="overflow-hidden divide-y divide-[#E2E0D8] dark:divide-[#2A2A27]"
            >
              {healthyCategories.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#5C5B57] dark:text-[#9A9890]">
                  Définissez des plafonds mensuels sur vos catégories.
                </div>
              ) : (
                healthyCategories.map((item) => (
                  <div key={item.category.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryIcon
                          icon={item.category.icon}
                          color={item.category.color}
                          size="sm"
                        />
                        <span className="text-sm font-medium text-[#141413] dark:text-[#F2F0E8] truncate">
                          {item.category.name}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] shrink-0">
                        {formatCurrency(item.spent, currency)}{' '}
                        <span className="text-[#5C5B57] dark:text-[#9A9890] font-normal">
                          / {formatCurrency(item.monthlyLimit, currency)}
                        </span>
                      </span>
                    </div>
                    <ProgressBar
                      value={item.usagePercent}
                      status={item.status}
                      markerPercent={item.category.alertThreshold}
                      height="sm"
                    />
                  </div>
                ))
              )}
            </Card>
          </section>

          {/* Recent Transactions */}
          <section>
            <SectionHeader
              title="Journal récent"
              subtitle="Dernières écritures comptabilisées"
              action={
                <button
                  type="button"
                  onClick={() => onNavigate('transactions')}
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#141413] dark:text-[#F2F0E8] hover:underline"
                >
                  Historique
                  <ArrowRight className="h-3 w-3" />
                </button>
              }
            />
            <Card
              padded={false}
              className="overflow-hidden divide-y divide-[#E2E0D8] dark:divide-[#2A2A27]"
            >
              {recentTransactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#5C5B57] dark:text-[#9A9890]">
                  Aucune opération ce mois-ci. Appuyez sur ⌘E ou N.
                </div>
              ) : (
                recentTransactions.slice(0, 5).map((tx) => {
                  const cat = categoryMap.get(tx.categoryId);
                  return (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => onEditTransaction(tx)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#FCFBF9] dark:hover:bg-[#1E1E1B] text-left transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryIcon
                          icon={cat?.icon ?? 'Tag'}
                          color={cat?.color ?? '#141413'}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#141413] dark:text-[#F2F0E8] truncate">
                            {tx.note || cat?.name || 'Transaction'}
                          </p>
                          <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890]">
                            {cat?.name ?? 'Autre'} · {formatDateShort(tx.date)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'font-mono text-sm font-semibold tabular-nums shrink-0',
                          tx.type === 'INCOME'
                            ? 'text-[#15803D] dark:text-[#22C55E]'
                            : 'text-[#141413] dark:text-[#F2F0E8]'
                        )}
                      >
                        {tx.type === 'INCOME'
                          ? formatCurrency(tx.amount, currency, { showSign: true })
                          : formatCurrency(-tx.amount, currency)}
                      </span>
                    </button>
                  );
                })
              )}
            </Card>
          </section>
        </div>
      </EditorialBlock>
    </EditorialStagger>
  );
}
