import {
  AlertStatus,
  BudgetSummary,
  CategoryBudgetStatus,
  CategoryDistributionPoint,
  CategoryDTO,
  ExceptionalExpenseResult,
  MonthlyEvolutionPoint,
  PaceStatus,
  RecurringPaymentDTO,
  ReserveExpenseDTO,
  TransactionDTO,
  TransactionImpactPreview,
  TransactionType,
} from './types';
import {
  formatMonthLabel,
  getDaysInMonth,
  getMonthKey,
  parseMonthKey,
  roundCurrency,
  shiftMonthKey,
} from './format';
import { computeRemainingFixedCharges } from './recurring';

/**
 * Evaluates the 3-state alert status for a category:
 * - green:  usage < alertThreshold (default 80%)
 * - orange: alertThreshold <= usage < 100%
 * - red:    usage >= 100%
 */
export function evaluateAlertStatus(
  spent: number,
  monthlyLimit: number,
  alertThreshold: number = 80
): AlertStatus {
  if (monthlyLimit <= 0) {
    return 'green';
  }
  const usagePercent = (spent / monthlyLimit) * 100;
  if (usagePercent >= 100) return 'red';
  if (usagePercent >= alertThreshold) return 'orange';
  return 'green';
}

export function getAlertSeverityRank(status: AlertStatus): number {
  switch (status) {
    case 'red':
      return 2;
    case 'orange':
      return 1;
    case 'green':
      return 0;
  }
}

/**
 * Computes the exact current bank balance from initial balance + all transactions
 * minus any exceptional reserve drawdowns.
 */
export function computeCurrentBalance(
  initialBalance: number,
  transactions: TransactionDTO[],
  reserveExpenses: ReserveExpenseDTO[] = []
): number {
  let balance = initialBalance;
  for (const tx of transactions) {
    if (tx.type === 'INCOME') {
      balance += tx.amount;
    } else {
      balance -= tx.amount;
    }
  }
  for (const exp of reserveExpenses) {
    balance -= exp.amount;
  }
  return roundCurrency(balance);
}

/**
 * Pure function to record an exceptional expense ("Dépense exceptionnelle")
 * drawn from the mandatory safety reserve without touching or triggering
 * monthly limits of regular spending categories.
 */
export function recordExceptionalExpense(params: {
  id?: string;
  amount: number;
  date?: string;
  note?: string | null;
  monthIncome: number;
  mandatoryReserveRate: number;
  existingReserveExpenses: ReserveExpenseDTO[];
}): ExceptionalExpenseResult {
  const safeAmount = roundCurrency(Math.max(0, params.amount));
  const isoDate = params.date ?? new Date().toISOString();
  const targetMonthKey = getMonthKey(new Date(isoDate));

  const mandatoryReserveAmount = roundCurrency(
    Math.max(0, params.monthIncome) * (Math.max(0, params.mandatoryReserveRate) / 100)
  );

  const usedBefore = roundCurrency(
    params.existingReserveExpenses
      .filter((e) => getMonthKey(new Date(e.date)) === targetMonthKey)
      .reduce((sum, e) => sum + e.amount, 0)
  );

  const shieldBefore = roundCurrency(Math.max(0, mandatoryReserveAmount - usedBefore));
  const coveredByReserve = roundCurrency(Math.min(shieldBefore, safeAmount));
  const overflowFromBalance = roundCurrency(Math.max(0, safeAmount - shieldBefore));
  const shieldAfter = roundCurrency(Math.max(0, shieldBefore - safeAmount));

  const expense: ReserveExpenseDTO = {
    id: params.id ?? `res-${Date.now()}`,
    amount: safeAmount,
    date: isoDate,
    note: params.note?.trim() || null,
  };

  return {
    expense,
    updatedReserveExpenses: [expense, ...params.existingReserveExpenses],
    shieldBefore,
    shieldAfter,
    coveredByReserve,
    overflowFromBalance,
  };
}

/**
 * Filters transactions belonging to a given monthKey ("YYYY-MM").
 */
export function filterTransactionsByMonth(
  transactions: TransactionDTO[],
  monthKey: string
): TransactionDTO[] {
  return transactions.filter((tx) => getMonthKey(new Date(tx.date)) === monthKey);
}

/**
 * Computes the complete BudgetSummary including the exact "Reste à vivre disponible":
 *   Reste à vivre disponible = Solde actuel − Échéances fixes restantes − Réserve obligatoire restante du mois
 * When no exceptional expense has been drawn from the reserve yet this month:
 *   Réserve obligatoire = Revenus mensuels * (mandatoryReserveRate / 100)
 */
export function computeBudgetSummary(params: {
  initialBalance: number;
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  recurringPayments: RecurringPaymentDTO[];
  mandatoryReserveRate?: number;
  reserveExpenses?: ReserveExpenseDTO[];
  referenceDate?: Date;
  monthKey?: string;
}): BudgetSummary {
  const referenceDate = params.referenceDate ?? new Date();
  const monthKey = params.monthKey ?? getMonthKey(referenceDate);
  const mandatoryReserveRate = Math.max(0, params.mandatoryReserveRate ?? 0);
  const reserveExpenses = params.reserveExpenses ?? [];
  const { year, monthIndex } = parseMonthKey(monthKey);
  const daysInMonth = getDaysInMonth(year, monthIndex);

  const currentMonthKey = getMonthKey(referenceDate);
  let currentDayOfMonth: number;
  if (monthKey === currentMonthKey) {
    currentDayOfMonth = referenceDate.getDate();
  } else if (monthKey < currentMonthKey) {
    currentDayOfMonth = daysInMonth;
  } else {
    currentDayOfMonth = 1;
  }

  const daysRemainingInMonth = Math.max(1, daysInMonth - currentDayOfMonth + 1);
  const monthProgressPercent = roundCurrency((currentDayOfMonth / daysInMonth) * 100);

  const currentBalance = computeCurrentBalance(
    params.initialBalance,
    params.transactions,
    reserveExpenses
  );
  const { remainingAmount, remainingCount, paidAmount } = computeRemainingFixedCharges(
    params.recurringPayments,
    monthKey,
    params.transactions
  );

  const monthTransactions = filterTransactionsByMonth(params.transactions, monthKey);
  let monthIncome = 0;
  let monthExpenses = 0;

  for (const tx of monthTransactions) {
    if (tx.type === 'INCOME') {
      monthIncome += tx.amount;
    } else {
      monthExpenses += tx.amount;
    }
  }

  monthIncome = roundCurrency(monthIncome);
  monthExpenses = roundCurrency(monthExpenses);
  const netMonthFlow = roundCurrency(monthIncome - monthExpenses);

  // Mandatory safety shield ("Bouclier Imprévus")
  const mandatoryReserveAmount = roundCurrency(
    monthIncome * (mandatoryReserveRate / 100)
  );
  const reserveUsedThisMonth = roundCurrency(
    reserveExpenses
      .filter((e) => getMonthKey(new Date(e.date)) === monthKey)
      .reduce((sum, e) => sum + e.amount, 0)
  );
  const reserveRemainingThisMonth = roundCurrency(
    Math.max(0, mandatoryReserveAmount - reserveUsedThisMonth)
  );

  // Core formula:
  // Reste à vivre = Solde actuel - Échéances fixes restantes - (Revenus mensuels * mandatoryReserveRate / 100 - part déjà puisée dans la réserve)
  const resteAVivre = roundCurrency(
    currentBalance - remainingAmount - reserveRemainingThisMonth
  );

  const activeBudgetedCategories = params.categories.filter(
    (c) => !c.isArchived && c.type === 'EXPENSE' && c.monthlyLimit > 0
  );
  const budgetedCategoryIds = new Set(activeBudgetedCategories.map((c) => c.id));
  const totalMonthlyBudget = roundCurrency(
    activeBudgetedCategories.reduce((sum, c) => sum + c.monthlyLimit, 0)
  );

  const budgetedExpenses = roundCurrency(
    monthTransactions
      .filter((tx) => tx.type === 'EXPENSE' && budgetedCategoryIds.has(tx.categoryId))
      .reduce((sum, tx) => sum + tx.amount, 0)
  );

  let spendingPacePercent = 0;
  if (totalMonthlyBudget > 0) {
    spendingPacePercent = roundCurrency((budgetedExpenses / totalMonthlyBudget) * 100);
  } else if (monthIncome > 0) {
    spendingPacePercent = roundCurrency((monthExpenses / monthIncome) * 100);
  }

  const paceDeltaPercent = roundCurrency(spendingPacePercent - monthProgressPercent);
  let paceStatus: PaceStatus = 'ahead';
  if (paceDeltaPercent > 15 || spendingPacePercent >= 100) {
    paceStatus = 'fast';
  } else if (paceDeltaPercent > 5) {
    paceStatus = 'watch';
  }

  const dailySafeSpend =
    resteAVivre > 0 ? roundCurrency(resteAVivre / daysRemainingInMonth) : 0;

  return {
    monthKey,
    currentBalance,
    remainingFixedCharges: remainingAmount,
    remainingFixedCount: remainingCount,
    paidFixedCharges: paidAmount,
    mandatoryReserveRate,
    mandatoryReserveAmount,
    reserveUsedThisMonth,
    reserveRemainingThisMonth,
    resteAVivre,
    monthIncome,
    monthExpenses,
    netMonthFlow,
    totalMonthlyBudget,
    budgetedExpenses,
    monthProgressPercent,
    spendingPacePercent,
    paceDeltaPercent,
    paceStatus,
    daysInMonth,
    currentDayOfMonth,
    daysRemainingInMonth,
    dailySafeSpend,
  };
}

/**
 * Computes budget statuses per expense category for a month.
 * Categories in orange or red are automatically prioritized at the top.
 */
export function computeCategoryBudgetStatuses(params: {
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  monthKey: string;
  includeArchived?: boolean;
  prioritizeAlerts?: boolean;
}): CategoryBudgetStatus[] {
  const { categories, transactions, monthKey, includeArchived = false, prioritizeAlerts = true } =
    params;

  const monthExpenses = filterTransactionsByMonth(transactions, monthKey).filter(
    (tx) => tx.type === 'EXPENSE'
  );

  const spentByCategory = new Map<string, { total: number; count: number }>();
  for (const tx of monthExpenses) {
    const entry = spentByCategory.get(tx.categoryId) ?? { total: 0, count: 0 };
    entry.total += tx.amount;
    entry.count += 1;
    spentByCategory.set(tx.categoryId, entry);
  }

  const statuses: CategoryBudgetStatus[] = categories
    .filter((c) => c.type === 'EXPENSE' && (includeArchived || !c.isArchived))
    .map((category) => {
      const entry = spentByCategory.get(category.id) ?? { total: 0, count: 0 };
      const spent = roundCurrency(entry.total);
      const monthlyLimit = roundCurrency(category.monthlyLimit);
      const remaining = monthlyLimit > 0 ? roundCurrency(monthlyLimit - spent) : 0;
      const usagePercent =
        monthlyLimit > 0 ? roundCurrency((spent / monthlyLimit) * 100) : 0;
      const status = evaluateAlertStatus(spent, monthlyLimit, category.alertThreshold);

      return {
        category,
        spent,
        monthlyLimit,
        remaining,
        usagePercent,
        status,
        transactionCount: entry.count,
      };
    });

  if (prioritizeAlerts) {
    return statuses.sort((a, b) => {
      const rankDiff = getAlertSeverityRank(b.status) - getAlertSeverityRank(a.status);
      if (rankDiff !== 0) return rankDiff;
      if (a.usagePercent !== b.usagePercent) return b.usagePercent - a.usagePercent;
      return a.category.sortOrder - b.category.sortOrder;
    });
  }

  return statuses.sort((a, b) => a.category.sortOrder - b.category.sortOrder);
}

/**
 * Real-time impact preview before validating a new transaction in the Quick Add modal.
 * Example output drives: "Après cette dépense : 170 € / 200 €"
 */
export function previewTransactionImpact(params: {
  category: CategoryDTO;
  currentCategorySpent: number;
  candidateAmount: number;
  transactionType: TransactionType;
  currentResteAVivre: number;
}): TransactionImpactPreview {
  const { category, currentCategorySpent, candidateAmount, transactionType, currentResteAVivre } =
    params;

  const safeAmount = Number.isFinite(candidateAmount) && candidateAmount > 0 ? candidateAmount : 0;
  const currentSpent = roundCurrency(currentCategorySpent);
  const monthlyLimit = roundCurrency(category.monthlyLimit);

  const projectedSpent =
    transactionType === 'EXPENSE'
      ? roundCurrency(currentSpent + safeAmount)
      : currentSpent;

  const currentPercent =
    monthlyLimit > 0 ? roundCurrency((currentSpent / monthlyLimit) * 100) : 0;
  const projectedPercent =
    monthlyLimit > 0 ? roundCurrency((projectedSpent / monthlyLimit) * 100) : 0;

  const currentStatus = evaluateAlertStatus(currentSpent, monthlyLimit, category.alertThreshold);
  const projectedStatus = evaluateAlertStatus(
    projectedSpent,
    monthlyLimit,
    category.alertThreshold
  );

  const remainingAfter = monthlyLimit > 0 ? roundCurrency(monthlyLimit - projectedSpent) : 0;
  const willExceedLimit = monthlyLimit > 0 && projectedSpent > monthlyLimit;
  const exceededBy = willExceedLimit ? roundCurrency(projectedSpent - monthlyLimit) : 0;

  const projectedResteAVivre =
    transactionType === 'EXPENSE'
      ? roundCurrency(currentResteAVivre - safeAmount)
      : roundCurrency(currentResteAVivre + safeAmount);

  return {
    categoryId: category.id,
    categoryName: category.name,
    monthlyLimit,
    currentSpent,
    projectedSpent,
    remainingAfter,
    currentPercent,
    projectedPercent,
    currentStatus,
    projectedStatus,
    statusWorsened: getAlertSeverityRank(projectedStatus) > getAlertSeverityRank(currentStatus),
    willExceedLimit,
    exceededBy,
    projectedResteAVivre,
  };
}

/**
 * Computes monthly income vs expenses vs savings series for the last N months (for Recharts).
 */
export function computeMonthlyEvolution(
  transactions: TransactionDTO[],
  referenceMonthKey: string,
  monthsCount: number = 6
): MonthlyEvolutionPoint[] {
  const points: MonthlyEvolutionPoint[] = [];

  for (let i = monthsCount - 1; i >= 0; i--) {
    const key = shiftMonthKey(referenceMonthKey, -i);
    const monthTxs = filterTransactionsByMonth(transactions, key);
    let income = 0;
    let expenses = 0;

    for (const tx of monthTxs) {
      if (tx.type === 'INCOME') income += tx.amount;
      else expenses += tx.amount;
    }

    income = roundCurrency(income);
    expenses = roundCurrency(expenses);

    points.push({
      monthKey: key,
      label: formatMonthLabel(key, true),
      income,
      expenses,
      savings: roundCurrency(income - expenses),
    });
  }

  return points;
}

/**
 * Computes expense distribution by category for a target month (for Recharts donut & breakdown).
 */
export function computeCategoryDistribution(params: {
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  monthKey: string;
}): CategoryDistributionPoint[] {
  const statuses = computeCategoryBudgetStatuses({
    categories: params.categories,
    transactions: params.transactions,
    monthKey: params.monthKey,
    includeArchived: true,
    prioritizeAlerts: false,
  }).filter((s) => s.spent > 0);

  const totalSpent = statuses.reduce((sum, s) => sum + s.spent, 0);

  return statuses
    .map((s) => ({
      categoryId: s.category.id,
      name: s.category.name,
      color: s.category.color,
      icon: s.category.icon,
      amount: s.spent,
      percentage: totalSpent > 0 ? roundCurrency((s.spent / totalSpent) * 100) : 0,
      monthlyLimit: s.monthlyLimit,
      status: s.status,
    }))
    .sort((a, b) => b.amount - a.amount);
}
