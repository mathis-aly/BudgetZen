import { describe, expect, it } from 'vitest';
import { computeBudgetSummary, getMonthlyFixedIncome } from '../budget';
import { getUpcomingRecurringPayments } from '../recurring';
import { computeGlobalTaxSummary } from '../taxes';
import type {
  CategoryDTO,
  RecurringPaymentDTO,
  TaxProfileDTO,
  TransactionDTO,
} from '../types';

const sampleCategories: CategoryDTO[] = [
  {
    id: 'cat-salary',
    name: 'Salaire',
    type: 'INCOME',
    color: '#15803D',
    icon: 'Wallet',
    monthlyLimit: 0,
    alertThreshold: 80,
    isArchived: false,
    sortOrder: 1,
  },
  {
    id: 'cat-housing',
    name: 'Logement',
    type: 'EXPENSE',
    color: '#B91C1C',
    icon: 'Home',
    monthlyLimit: 1000,
    alertThreshold: 80,
    isArchived: false,
    sortOrder: 2,
  },
];

describe('Recurring fixed income & budget propagation engine', () => {
  it('computes Reste à vivre prudently while sizing mandatory reserve and projectedEndOfMonthBalance', () => {
    const refDate = new Date('2026-11-02T12:00:00.000Z');
    const recurring: RecurringPaymentDTO[] = [
      {
        id: 'inc-salary',
        title: 'Salaire CDI',
        amount: 3000,
        type: 'INCOME',
        isTaxable: true,
        dayOfMonth: 5,
        categoryId: 'cat-salary',
        isActive: true,
        note: null,
        lastPaidMonth: '2026-10', // unpaid yet for Nov
      },
      {
        id: 'inc-apl',
        title: 'APL / Aide',
        amount: 200,
        type: 'INCOME',
        isTaxable: false,
        dayOfMonth: 6,
        categoryId: 'cat-salary',
        isActive: true,
        note: null,
        lastPaidMonth: '2026-10', // unpaid yet for Nov
      },
      {
        id: 'exp-rent',
        title: 'Loyer',
        amount: 900,
        type: 'EXPENSE',
        isTaxable: true,
        dayOfMonth: 4,
        categoryId: 'cat-housing',
        isActive: true,
        note: null,
        lastPaidMonth: '2026-10', // unpaid yet for Nov
      },
    ];

    const summary = computeBudgetSummary({
      initialBalance: 1500,
      transactions: [],
      categories: sampleCategories,
      recurringPayments: recurring,
      mandatoryReserveRate: 10,
      referenceDate: refDate,
    });

    // Expected fixed income: 3000 + 200 = 3200
    expect(summary.expectedMonthlyFixedIncome).toBe(3200);
    expect(summary.remainingFixedIncome).toBe(3200);
    expect(summary.remainingFixedCharges).toBe(900);
    // Reserve sized on day 1 against expectedMonthlyFixedIncome (10% of 3200 = 320)
    expect(summary.mandatoryReserveAmount).toBe(320);
    // Prudent Reste à vivre: 1500 - 900 - 320 = 280 (uncollected 3200 is NOT spendable yet!)
    expect(summary.resteAVivre).toBe(280);
    // End-of-month projection: 1500 + 3200 - 900 - 320 = 3480
    expect(summary.projectedEndOfMonthBalance).toBe(3480);

    // Taxable filter excludes APL (200 €)
    expect(getMonthlyFixedIncome(recurring)).toBe(3200);
    expect(getMonthlyFixedIncome(recurring, { taxableOnly: true })).toBe(3000);
  });

  it('uses actual monthIncome for mandatory reserve if already higher than recurring fixed income', () => {
    const refDate = new Date('2026-11-15T12:00:00.000Z');
    const recurring: RecurringPaymentDTO[] = [
      {
        id: 'inc-salary',
        title: 'Salaire',
        amount: 2500,
        type: 'INCOME',
        isTaxable: true,
        dayOfMonth: 1,
        categoryId: 'cat-salary',
        isActive: true,
        note: null,
        lastPaidMonth: '2026-11', // already collected
      },
    ];
    const txs: TransactionDTO[] = [
      {
        id: 'tx-sal',
        amount: 2500,
        type: 'INCOME',
        date: '2026-11-01T10:00:00.000Z',
        note: 'Salaire',
        categoryId: 'cat-salary',
        recurringPaymentId: 'inc-salary',
        billingMonth: '2026-11',
      },
      {
        id: 'tx-bonus',
        amount: 1000,
        type: 'INCOME',
        date: '2026-11-10T10:00:00.000Z',
        note: 'Prime',
        categoryId: 'cat-salary',
        recurringPaymentId: null,
        billingMonth: null,
      },
    ];

    const summary = computeBudgetSummary({
      initialBalance: 0,
      transactions: txs,
      categories: sampleCategories,
      recurringPayments: recurring,
      mandatoryReserveRate: 10,
      referenceDate: refDate,
    });

    // Actual monthIncome (3500) > recurring (2500) => reserve = 350
    expect(summary.mandatoryReserveAmount).toBe(350);
    expect(summary.remainingFixedIncome).toBe(0);
    expect(summary.projectedEndOfMonthBalance).toBe(summary.resteAVivre);
  });

  it('orders mixed INCOME and EXPENSE items chronologically inside 7-day window', () => {
    const refDate = new Date('2026-11-02T12:00:00.000Z');
    const recurring: RecurringPaymentDTO[] = [
      {
        id: 'inc-1',
        title: 'Salaire',
        amount: 2800,
        type: 'INCOME',
        isTaxable: true,
        dayOfMonth: 5,
        categoryId: 'cat-salary',
        isActive: true,
        note: null,
        lastPaidMonth: null,
      },
      {
        id: 'exp-1',
        title: 'Loyer',
        amount: 900,
        type: 'EXPENSE',
        dayOfMonth: 4,
        categoryId: 'cat-housing',
        isActive: true,
        note: null,
        lastPaidMonth: null,
      },
      {
        id: 'exp-2',
        title: 'Internet',
        amount: 35,
        type: 'EXPENSE',
        dayOfMonth: 7,
        categoryId: 'cat-housing',
        isActive: true,
        note: null,
        lastPaidMonth: null,
      },
    ];

    const upcoming = getUpcomingRecurringPayments(
      recurring,
      refDate,
      7,
      sampleCategories
    );
    expect(upcoming.map((u) => u.payment.id)).toEqual([
      'exp-1',
      'inc-1',
      'exp-2',
    ]);
  });

  it('pre-estimates annual taxable income in taxes without double counting manual entries', () => {
    const profile: TaxProfileDTO = {
      id: 1,
      fiscalParts: 1,
      deductionMode: 'STANDARD_10',
      actualFeesAmount: 0,
      withheldTaxPaid: 0,
      updatedAt: '2026-11-01T10:00:00.000Z',
    };

    const estimatedSummary = computeGlobalTaxSummary({
      profile,
      entries: [],
      year: 2026,
      estimatedAnnualTaxableIncome: 36000,
    });
    expect(estimatedSummary.grossIncomeBase).toBe(36000);
    expect(estimatedSummary.incomeTax.netTax).toBeGreaterThan(0);

    // When a manual INCOME entry exists, it overrides the recurring estimate without summing both
    const manualOverrideSummary = computeGlobalTaxSummary({
      profile,
      entries: [
        {
          id: 'e1',
          year: 2026,
          category: 'INCOME',
          label: 'Net imposable réel',
          taxableBase: 42000,
          computedTax: 0,
          notes: null,
        },
      ],
      year: 2026,
      estimatedAnnualTaxableIncome: 36000,
    });
    expect(manualOverrideSummary.grossIncomeBase).toBe(42000);
  });
});
