import {
  BudgetSummary,
  CategoryBudgetStatus,
  CategoryDTO,
  OptimizationTip,
  TransactionDTO,
} from './types';
import {
  formatCurrency,
  formatPercent,
  roundCurrency,
  shiftMonthKey,
} from './format';
import { filterTransactionsByMonth } from './budget';
import { calculateCashErosion } from './wealth';

export interface OptimizerInput {
  monthKey: string;
  summary: BudgetSummary;
  categoryStatuses: CategoryBudgetStatus[];
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  currency?: string;
  lookbackMonths?: number;
  manualInflationRate?: number;
}

/**
 * Pure rule-based optimization engine.
 * Generates contextual recommendation cards:
 * 1. Rebalancing suggestions between an exceeded category and a surplus category.
 * 2. Surge detection (>20% above previous months' average for a category).
 * 3. Remaining daily budget on tight (orange) or exceeded (red) categories.
 * 4. Overall monthly spending pace & end-of-month savings forecast.
 */
export function generateOptimizationTips(input: OptimizerInput): OptimizationTip[] {
  const {
    monthKey,
    summary,
    categoryStatuses,
    transactions,
    currency = 'EUR',
    lookbackMonths = 3,
    manualInflationRate = 0,
  } = input;

  const tips: OptimizationTip[] = [];

  // ---------------------------------------------------------------------------
  // Rule 1: Rebalancing proposal between an over-limit category and a surplus one
  // ---------------------------------------------------------------------------
  const exceededCategories = categoryStatuses
    .filter((s) => s.status === 'red' && s.monthlyLimit > 0 && s.spent > s.monthlyLimit)
    .sort((a, b) => b.spent - b.monthlyLimit - (a.spent - a.monthlyLimit));

  const surplusCategories = categoryStatuses
    .filter(
      (s) =>
        s.status === 'green' &&
        s.monthlyLimit > 0 &&
        s.usagePercent < 65 &&
        s.remaining >= 20
    )
    .sort((a, b) => b.remaining - a.remaining);

  if (exceededCategories.length > 0 && surplusCategories.length > 0) {
    const target = exceededCategories[0];
    const donor = surplusCategories[0];
    const overrun = roundCurrency(target.spent - target.monthlyLimit);
    // Transfer at most 60% of donor's remaining margin so donor stays comfortably green
    const maxSafeTransfer = roundCurrency(donor.remaining * 0.6);
    const suggestedAmount = Math.max(
      10,
      Math.ceil(Math.min(overrun, maxSafeTransfer) / 5) * 5
    );

    if (suggestedAmount > 0 && suggestedAmount <= donor.remaining) {
      tips.push({
        id: `rebalance-${donor.category.id}-${target.category.id}`,
        type: 'rebalance',
        severity: 'critical',
        title: `Rééquilibrage vers ${target.category.name}`,
        description: `Votre budget ${target.category.name} dépasse son plafond de ${formatCurrency(
          overrun,
          currency
        )}. Vous pouvez transférer ${formatCurrency(
          suggestedAmount,
          currency
        )} depuis ${donor.category.name} (il y reste ${formatCurrency(
          donor.remaining,
          currency
        )}) pour absorber l'écart sans toucher à votre reste à vivre.`,
        metric: `−${formatCurrency(suggestedAmount, currency)} → ${target.category.name}`,
        categoryId: target.category.id,
        rebalance: {
          fromCategoryId: donor.category.id,
          fromCategoryName: donor.category.name,
          toCategoryId: target.category.id,
          toCategoryName: target.category.name,
          amount: suggestedAmount,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 2: Surge detection (>20% above historical monthly average)
  // ---------------------------------------------------------------------------
  const pastMonthKeys: string[] = [];
  for (let i = 1; i <= lookbackMonths; i++) {
    pastMonthKeys.push(shiftMonthKey(monthKey, -i));
  }

  for (const status of categoryStatuses) {
    if (status.spent < 25) continue;

    let historicalTotal = 0;
    let monthsWithData = 0;

    for (const pastKey of pastMonthKeys) {
      const monthSpent = filterTransactionsByMonth(transactions, pastKey)
        .filter((tx) => tx.type === 'EXPENSE' && tx.categoryId === status.category.id)
        .reduce((sum, tx) => sum + tx.amount, 0);

      if (monthSpent > 0) {
        historicalTotal += monthSpent;
        monthsWithData += 1;
      }
    }

    if (monthsWithData === 0) continue;

    const historicalAvg = roundCurrency(historicalTotal / monthsWithData);
    if (historicalAvg < 15) continue;

    const deltaAmount = roundCurrency(status.spent - historicalAvg);
    const increasePercent = roundCurrency(((status.spent - historicalAvg) / historicalAvg) * 100);

    if (increasePercent > 20 && deltaAmount >= 15) {
      tips.push({
        id: `surge-${status.category.id}`,
        type: 'surge',
        severity: increasePercent >= 40 ? 'critical' : 'warning',
        title: `Hausse de +${formatPercent(increasePercent)} sur ${status.category.name}`,
        description: `Vous avez dépensé ${formatCurrency(
          status.spent,
          currency
        )} ce mois-ci contre une moyenne de ${formatCurrency(
          historicalAvg,
          currency
        )} sur les ${monthsWithData} derniers mois (+${formatCurrency(deltaAmount, currency)}).`,
        metric: `+${formatPercent(increasePercent)} vs moy.`,
        categoryId: status.category.id,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Rule 3: Remaining daily budget on tight (orange) categories
  // ---------------------------------------------------------------------------
  const tightCategories = categoryStatuses
    .filter((s) => s.status === 'orange' && s.monthlyLimit > 0 && s.remaining > 0)
    .sort((a, b) => b.usagePercent - a.usagePercent);

  for (const tight of tightCategories.slice(0, 2)) {
    const dailyAllowance = roundCurrency(
      tight.remaining / Math.max(1, summary.daysRemainingInMonth)
    );
    tips.push({
      id: `daily-${tight.category.id}`,
      type: 'daily_budget',
      severity: 'warning',
      title: `Budget journalier serré : ${tight.category.name}`,
      description: `Il vous reste ${formatCurrency(
        tight.remaining,
        currency
      )} sur ${tight.category.name} pour les ${
        summary.daysRemainingInMonth
      } derniers jours du mois, soit ${formatCurrency(
        dailyAllowance,
        currency
      )} / jour maximum pour rester sous votre plafond.`,
      metric: `${formatCurrency(dailyAllowance, currency)} / jour`,
      categoryId: tight.category.id,
    });
  }

  // ---------------------------------------------------------------------------
  // Rule 4: Spending pace vs month progress & projected savings
  // ---------------------------------------------------------------------------
  if (summary.paceDeltaPercent > 12) {
    tips.push({
      id: 'pace-warning',
      type: 'pace',
      severity: summary.paceDeltaPercent > 25 ? 'critical' : 'warning',
      title: 'Rythme de dépense supérieur au calendrier',
      description: `Vous avez consommé ${formatPercent(
        summary.spendingPacePercent
      )} de vos budgets alors que le mois n'est écoulé qu'à ${formatPercent(
        summary.monthProgressPercent
      )}. Limitez vos achats variables à ${formatCurrency(
        summary.dailySafeSpend,
        currency
      )} / jour.`,
      metric: `+${formatPercent(summary.paceDeltaPercent)} d'avance`,
    });
  } else if (summary.resteAVivre > 0 && exceededCategories.length === 0) {
    tips.push({
      id: 'pace-positive',
      type: 'savings',
      severity: 'positive',
      title: 'Excellente maîtrise budgétaire',
      description: `Vos dépenses suivent un rythme sain (${formatPercent(
        summary.spendingPacePercent
      )} consommés à ${formatPercent(
        summary.monthProgressPercent
      )} du mois). Avec ${formatCurrency(
        summary.resteAVivre,
        currency
      )} de reste à vivre, vous disposez de ${formatCurrency(
        summary.dailySafeSpend,
        currency
      )} / jour jusqu'à la fin du mois.`,
      metric: `${formatCurrency(summary.dailySafeSpend, currency)} / jour`,
    });
  } else if (summary.resteAVivre <= 0) {
    tips.push({
      id: 'reste-a-vivre-negative',
      type: 'pace',
      severity: 'critical',
      title: 'Reste à vivre sous tension',
      description: `Après provision de vos ${formatCurrency(
        summary.remainingFixedCharges,
        currency
      )} d'échéances fixes restantes, votre reste à vivre est de ${formatCurrency(
        summary.resteAVivre,
        currency
      )}. Reportez les dépenses non essentielles jusqu'au prochain revenu.`,
      metric: formatCurrency(summary.resteAVivre, currency),
    });
  }

  // ---------------------------------------------------------------------------
  // Rule 5: Monetary erosion on dormant checking account cash
  // ---------------------------------------------------------------------------
  if (manualInflationRate > 0 && summary.currentBalance >= 500) {
    const erosion = calculateCashErosion(summary.currentBalance, manualInflationRate);
    if (erosion.annualLoss >= 5) {
      tips.push({
        id: 'cash-erosion-alert',
        type: 'cash_erosion',
        severity: 'info',
        title: `Érosion monétaire sur liquidités dormantes (${formatPercent(
          manualInflationRate,
          1
        )}/an)`,
        description: `Vos ${formatCurrency(
          summary.currentBalance,
          currency
        )} non placés sur le compte courant perdent environ ${formatCurrency(
          erosion.annualLoss,
          currency
        )} de pouvoir d'achat par an (${formatCurrency(
          erosion.fiveYearLoss,
          currency
        )} sur 5 ans). Pensez à placer l'excédent au-delà de votre matelas courant.`,
        metric: `−${formatCurrency(erosion.annualLoss, currency)} / an`,
      });
    }
  }

  // Order: critical -> warning -> info -> positive
  const severityOrder: Record<OptimizationTip['severity'], number> = {
    critical: 0,
    warning: 1,
    info: 2,
    positive: 3,
  };

  return tips.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
