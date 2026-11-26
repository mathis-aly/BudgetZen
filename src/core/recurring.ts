import {
  CategoryDTO,
  RecurringPaymentDTO,
  TransactionDTO,
  TransactionType,
  UpcomingRecurringItem,
} from './types';
import {
  getDaysInMonth,
  getMonthKey,
  parseMonthKey,
  roundCurrency,
  shiftMonthKey,
  toISODateOnly,
} from './format';

/**
 * Normalizes the recurring direction (`INCOME` vs `EXPENSE`), defaulting legacy rows to `EXPENSE`.
 */
export function getRecurringType(
  payment: Pick<RecurringPaymentDTO, 'type'>
): TransactionType {
  return payment.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
}

/**
 * Computes the actual due date for a recurring payment within a given month,
 * clamping dayOfMonth to the last day of that month (e.g., 31 -> 28/29 in Feb).
 */
export function getDueDateForMonth(dayOfMonth: number, year: number, monthIndex: number): Date {
  const maxDay = getDaysInMonth(year, monthIndex);
  const clampedDay = Math.max(1, Math.min(dayOfMonth, maxDay));
  return new Date(year, monthIndex, clampedDay, 12, 0, 0, 0);
}

/**
 * Determines whether a recurring payment has already been settled for a given billing month ("YYYY-MM").
 */
export function isRecurringPaidForMonth(
  payment: RecurringPaymentDTO,
  monthKey: string,
  transactions?: TransactionDTO[]
): boolean {
  if (payment.lastPaidMonth === monthKey) {
    return true;
  }
  if (!transactions || transactions.length === 0) {
    return false;
  }
  return transactions.some(
    (tx) => tx.recurringPaymentId === payment.id && tx.billingMonth === monthKey
  );
}

/**
 * Returns all active recurring payments for a given month with their status and due date.
 */
export function getMonthlyRecurringSchedule(
  payments: RecurringPaymentDTO[],
  monthKey: string,
  referenceDate: Date = new Date(),
  categories: CategoryDTO[] = [],
  transactions: TransactionDTO[] = []
): UpcomingRecurringItem[] {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const refStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );

  return payments
    .filter((p) => p.isActive)
    .map((payment) => {
      const due = getDueDateForMonth(payment.dayOfMonth, year, monthIndex);
      const diffMs = due.getTime() - refStart.getTime();
      const daysUntilDue = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const isPaid = isRecurringPaidForMonth(payment, monthKey, transactions);

      return {
        payment,
        category: categoryMap.get(payment.categoryId),
        dueDate: toISODateOnly(due),
        billingMonth: monthKey,
        daysUntilDue,
        isOverdue: !isPaid && daysUntilDue < 0,
        isPaid,
      };
    })
    .sort((a, b) => {
      if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
      return a.payment.dayOfMonth - b.payment.dayOfMonth;
    });
}

/**
 * Returns active unpaid recurring payments due within the next `windowDays` days
 * (default 7 days), including any overdue unpaid charges from earlier in the current month,
 * and seamlessly peeking into the next month when near month-end.
 */
export function getUpcomingRecurringPayments(
  payments: RecurringPaymentDTO[],
  referenceDate: Date = new Date(),
  windowDays: number = 7,
  categories: CategoryDTO[] = [],
  transactions: TransactionDTO[] = []
): UpcomingRecurringItem[] {
  const currentMonthKey = getMonthKey(referenceDate);
  const nextMonthKey = shiftMonthKey(currentMonthKey, 1);

  const currentItems = getMonthlyRecurringSchedule(
    payments,
    currentMonthKey,
    referenceDate,
    categories,
    transactions
  );

  const nextItems = getMonthlyRecurringSchedule(
    payments,
    nextMonthKey,
    referenceDate,
    categories,
    transactions
  );

  const seen = new Set<string>();
  const upcoming: UpcomingRecurringItem[] = [];

  for (const item of [...currentItems, ...nextItems]) {
    if (item.isPaid) continue;
    if (item.daysUntilDue <= windowDays) {
      const uniqueKey = `${item.payment.id}:${item.billingMonth}`;
      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey);
        upcoming.push(item);
      }
    }
  }

  return upcoming.sort(
    (a, b) =>
      a.daysUntilDue - b.daysUntilDue ||
      a.payment.dayOfMonth - b.payment.dayOfMonth
  );
}

/**
 * Computes the exact sum of remaining unpaid fixed EXPENSE charges for the specified month.
 */
export function computeRemainingFixedCharges(
  payments: RecurringPaymentDTO[],
  monthKey: string,
  transactions: TransactionDTO[] = []
): { remainingAmount: number; remainingCount: number; paidAmount: number } {
  let remainingAmount = 0;
  let remainingCount = 0;
  let paidAmount = 0;

  for (const payment of payments) {
    if (!payment.isActive || getRecurringType(payment) !== 'EXPENSE') continue;
    if (isRecurringPaidForMonth(payment, monthKey, transactions)) {
      paidAmount += payment.amount;
    } else {
      remainingAmount += payment.amount;
      remainingCount += 1;
    }
  }

  return {
    remainingAmount: roundCurrency(remainingAmount),
    remainingCount,
    paidAmount: roundCurrency(paidAmount),
  };
}

/**
 * Computes expected, collected, and remaining fixed INCOME items for the specified month.
 */
export function computeRemainingFixedIncome(
  payments: RecurringPaymentDTO[],
  monthKey: string,
  transactions: TransactionDTO[] = []
): {
  remainingAmount: number;
  remainingCount: number;
  paidAmount: number;
  totalExpectedAmount: number;
} {
  let remainingAmount = 0;
  let remainingCount = 0;
  let paidAmount = 0;
  let totalExpectedAmount = 0;

  for (const payment of payments) {
    if (!payment.isActive || getRecurringType(payment) !== 'INCOME') continue;
    totalExpectedAmount += payment.amount;
    if (isRecurringPaidForMonth(payment, monthKey, transactions)) {
      paidAmount += payment.amount;
    } else {
      remainingAmount += payment.amount;
      remainingCount += 1;
    }
  }

  return {
    remainingAmount: roundCurrency(remainingAmount),
    remainingCount,
    paidAmount: roundCurrency(paidAmount),
    totalExpectedAmount: roundCurrency(totalExpectedAmount),
  };
}
