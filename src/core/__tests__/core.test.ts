import { describe, expect, it } from 'vitest';
import {
  calculateBasketInflationIndex,
  calculateCapitalTax2026,
  calculateCashErosion,
  calculateIncomeTax2026,
  calculateProductInflation,
  computeBudgetSummary,
  computeCategoryBudgetStatuses,
  computeCompositeIndexValue,
  computeGlobalTaxSummary,
  computeIndexVariations,
  computeMonthlySummary,
  computePersonalInflation,
  convertToCSV,
  evaluateAlertStatus,
  formatMonthlyReportsCSV,
  formatTransactionsCSV,
  generateOptimizationTips,
  getUpcomingRecurringPayments,
  isWithinEndOfMonthWindow,
  parseQuickCommand,
  parseTransactionsCSV,
  previewTransactionImpact,
  projectWealthGrowth,
  recordExceptionalExpense,
  CategoryDTO,
  PriceEntryDTO,
  RecurringPaymentDTO,
  TrackedProductDTO,
  TransactionDTO,
} from '../index';

const categories: CategoryDTO[] = [
  {
    id: 'cat-food',
    name: 'Courses',
    type: 'EXPENSE',
    color: '#34C759',
    icon: 'ShoppingCart',
    monthlyLimit: 400,
    alertThreshold: 80,
    isArchived: false,
    sortOrder: 1,
  },
  {
    id: 'cat-resto',
    name: 'Restaurants & Sorties',
    type: 'EXPENSE',
    color: '#FF9500',
    icon: 'Utensils',
    monthlyLimit: 200,
    alertThreshold: 80,
    isArchived: false,
    sortOrder: 2,
  },
  {
    id: 'cat-shopping',
    name: 'Shopping',
    type: 'EXPENSE',
    color: '#AF52DE',
    icon: 'ShoppingBag',
    monthlyLimit: 200,
    alertThreshold: 80,
    isArchived: false,
    sortOrder: 3,
  },
  {
    id: 'cat-housing',
    name: 'Logement',
    type: 'EXPENSE',
    color: '#007AFF',
    icon: 'Home',
    monthlyLimit: 950,
    alertThreshold: 95,
    isArchived: false,
    sortOrder: 4,
  },
  {
    id: 'cat-salary',
    name: 'Salaire',
    type: 'INCOME',
    color: '#30D158',
    icon: 'Briefcase',
    monthlyLimit: 0,
    alertThreshold: 80,
    isArchived: false,
    sortOrder: 5,
  },
];

describe('Core Budget Engine', () => {
  it('evaluates 3-state alert thresholds accurately', () => {
    expect(evaluateAlertStatus(159, 200, 80)).toBe('green'); // 79.5%
    expect(evaluateAlertStatus(160, 200, 80)).toBe('orange'); // 80%
    expect(evaluateAlertStatus(199, 200, 80)).toBe('orange'); // 99.5%
    expect(evaluateAlertStatus(200, 200, 80)).toBe('red'); // 100%
    expect(evaluateAlertStatus(240, 200, 80)).toBe('red'); // 120%
  });

  it('calculates exact Reste à vivre = Solde actuel - Unpaid fixed charges', () => {
    const refDate = new Date('2026-11-15T12:00:00.000Z');
    const transactions: TransactionDTO[] = [
      {
        id: 't1',
        amount: 2800,
        type: 'INCOME',
        date: '2026-11-01T09:00:00.000Z',
        note: 'Salaire',
        categoryId: 'cat-salary',
        recurringPaymentId: null,
        billingMonth: null,
      },
      {
        id: 't2',
        amount: 900,
        type: 'EXPENSE',
        date: '2026-11-05T09:00:00.000Z',
        note: 'Loyer',
        categoryId: 'cat-housing',
        recurringPaymentId: 'rec-rent',
        billingMonth: '2026-11',
      },
      {
        id: 't3',
        amount: 350,
        type: 'EXPENSE',
        date: '2026-11-10T09:00:00.000Z',
        note: 'Courses',
        categoryId: 'cat-food',
        recurringPaymentId: null,
        billingMonth: null,
      },
    ];

    const recurring: RecurringPaymentDTO[] = [
      {
        id: 'rec-rent',
        title: 'Loyer',
        amount: 900,
        dayOfMonth: 5,
        categoryId: 'cat-housing',
        isActive: true,
        note: null,
        lastPaidMonth: '2026-11', // already paid
      },
      {
        id: 'rec-internet',
        title: 'Fibre',
        amount: 40,
        dayOfMonth: 18,
        categoryId: 'cat-housing',
        isActive: true,
        note: null,
        lastPaidMonth: '2026-10', // unpaid for Nov
      },
      {
        id: 'rec-gym',
        title: 'Sport',
        amount: 35,
        dayOfMonth: 22,
        categoryId: 'cat-shopping',
        isActive: true,
        note: null,
        lastPaidMonth: null, // unpaid for Nov
      },
    ];

    const summary = computeBudgetSummary({
      initialBalance: 500,
      transactions,
      categories,
      recurringPayments: recurring,
      referenceDate: refDate,
    });

    // Current balance: 500 + 2800 - 900 - 350 = 2050
    expect(summary.currentBalance).toBe(2050);
    // Remaining unpaid fixed charges: 40 + 35 = 75
    expect(summary.remainingFixedCharges).toBe(75);
    expect(summary.remainingFixedCount).toBe(2);
    // Exact Reste à vivre: 2050 - 75 = 1975
    expect(summary.resteAVivre).toBe(1975);
  });

  it('promotes red and orange categories automatically to the top', () => {
    const transactions: TransactionDTO[] = [
      {
        id: 't1',
        amount: 225, // 112.5% -> RED
        type: 'EXPENSE',
        date: '2026-11-12T10:00:00.000Z',
        note: 'Restos',
        categoryId: 'cat-resto',
        recurringPaymentId: null,
        billingMonth: null,
      },
      {
        id: 't2',
        amount: 340, // 85% -> ORANGE
        type: 'EXPENSE',
        date: '2026-11-12T10:00:00.000Z',
        note: 'Supermarché',
        categoryId: 'cat-food',
        recurringPaymentId: null,
        billingMonth: null,
      },
      {
        id: 't3',
        amount: 40, // 20% -> GREEN
        type: 'EXPENSE',
        date: '2026-11-12T10:00:00.000Z',
        note: 'Chemise',
        categoryId: 'cat-shopping',
        recurringPaymentId: null,
        billingMonth: null,
      },
    ];

    const statuses = computeCategoryBudgetStatuses({
      categories,
      transactions,
      monthKey: '2026-11',
    });

    expect(statuses[0].category.id).toBe('cat-resto');
    expect(statuses[0].status).toBe('red');
    expect(statuses[1].category.id).toBe('cat-food');
    expect(statuses[1].status).toBe('orange');
    expect(statuses[2].status).toBe('green');
  });

  it('previews real-time category & reste à vivre impact before saving', () => {
    const preview = previewTransactionImpact({
      category: categories[1], // Restaurants limit 200, alert 80%
      currentCategorySpent: 140,
      candidateAmount: 30,
      transactionType: 'EXPENSE',
      currentResteAVivre: 1000,
    });

    expect(preview.projectedSpent).toBe(170);
    expect(preview.monthlyLimit).toBe(200);
    expect(preview.currentStatus).toBe('green');
    expect(preview.projectedStatus).toBe('orange');
    expect(preview.statusWorsened).toBe(true);
    expect(preview.projectedResteAVivre).toBe(970);
  });

  it('detects upcoming fixed payments in next 7 days', () => {
    const refDate = new Date('2026-11-26T12:00:00.000Z');
    const recurring: RecurringPaymentDTO[] = [
      {
        id: 'r1',
        title: 'Mobile',
        amount: 19.99,
        dayOfMonth: 28,
        categoryId: 'cat-housing',
        isActive: true,
        note: null,
        lastPaidMonth: '2026-10',
      },
      {
        id: 'r2',
        title: 'Loyer prochain mois',
        amount: 900,
        dayOfMonth: 1,
        categoryId: 'cat-housing',
        isActive: true,
        note: null,
        lastPaidMonth: '2026-11',
      },
      {
        id: 'r3',
        title: 'Assurance lointaine',
        amount: 45,
        dayOfMonth: 15,
        categoryId: 'cat-housing',
        isActive: true,
        note: null,
        lastPaidMonth: '2026-11',
      },
    ];

    const upcoming = getUpcomingRecurringPayments(recurring, refDate, 7, categories);
    expect(upcoming.map((u) => u.payment.id)).toEqual(['r1', 'r2']);
    expect(upcoming[0].daysUntilDue).toBe(2);
    expect(upcoming[1].daysUntilDue).toBe(5);
  });

  it('generates surge, daily budget, and rebalancing optimization tips', () => {
    const refDate = new Date('2026-11-20T12:00:00.000Z');
    const transactions: TransactionDTO[] = [
      // Previous 2 months average for Restaurants = 150 €
      {
        id: 'p1',
        amount: 150,
        type: 'EXPENSE',
        date: '2026-09-15T10:00:00.000Z',
        note: null,
        categoryId: 'cat-resto',
        recurringPaymentId: null,
        billingMonth: null,
      },
      {
        id: 'p2',
        amount: 150,
        type: 'EXPENSE',
        date: '2026-10-15T10:00:00.000Z',
        note: null,
        categoryId: 'cat-resto',
        recurringPaymentId: null,
        billingMonth: null,
      },
      // Current month: Restaurants 235 € (exceeded limit 200 by 35 €, AND +56.7% vs avg!)
      {
        id: 'c1',
        amount: 235,
        type: 'EXPENSE',
        date: '2026-11-14T10:00:00.000Z',
        note: null,
        categoryId: 'cat-resto',
        recurringPaymentId: null,
        billingMonth: null,
      },
      // Current month: Courses 340 € / 400 € (orange -> daily budget tip)
      {
        id: 'c2',
        amount: 340,
        type: 'EXPENSE',
        date: '2026-11-16T10:00:00.000Z',
        note: null,
        categoryId: 'cat-food',
        recurringPaymentId: null,
        billingMonth: null,
      },
      // Current month: Shopping 30 € / 200 € (green surplus -> rebalance donor)
      {
        id: 'c3',
        amount: 30,
        type: 'EXPENSE',
        date: '2026-11-10T10:00:00.000Z',
        note: null,
        categoryId: 'cat-shopping',
        recurringPaymentId: null,
        billingMonth: null,
      },
      // Income
      {
        id: 'inc1',
        amount: 2800,
        type: 'INCOME',
        date: '2026-11-01T10:00:00.000Z',
        note: 'Salaire',
        categoryId: 'cat-salary',
        recurringPaymentId: null,
        billingMonth: null,
      },
    ];

    const summary = computeBudgetSummary({
      initialBalance: 400,
      transactions,
      categories,
      recurringPayments: [],
      referenceDate: refDate,
    });
    const statuses = computeCategoryBudgetStatuses({
      categories,
      transactions,
      monthKey: '2026-11',
    });

    const tips = generateOptimizationTips({
      monthKey: '2026-11',
      summary,
      categoryStatuses: statuses,
      categories,
      transactions,
    });

    expect(tips.some((t) => t.type === 'rebalance')).toBe(true);
    expect(tips.some((t) => t.type === 'surge' && t.categoryId === 'cat-resto')).toBe(true);
    expect(tips.some((t) => t.type === 'daily_budget' && t.categoryId === 'cat-food')).toBe(true);
  });

  it('deducts mandatory reserve rate from Reste à vivre and isolates exceptional expenses from category alerts', () => {
    const refDate = new Date('2026-11-15T12:00:00.000Z');
    const transactions: TransactionDTO[] = [
      {
        id: 't-inc',
        amount: 3000,
        type: 'INCOME',
        date: '2026-11-01T10:00:00.000Z',
        note: 'Salaire',
        categoryId: 'cat-salary',
        recurringPaymentId: null,
        billingMonth: null,
      },
      {
        id: 't-food',
        amount: 200,
        type: 'EXPENSE',
        date: '2026-11-08T10:00:00.000Z',
        note: 'Courses',
        categoryId: 'cat-food',
        recurringPaymentId: null,
        billingMonth: null,
      },
    ];
    const recurring: RecurringPaymentDTO[] = [
      {
        id: 'r-net',
        title: 'Fibre',
        amount: 50,
        dayOfMonth: 20,
        categoryId: 'cat-housing',
        isActive: true,
        note: null,
        lastPaidMonth: '2026-10',
      },
    ];

    // Balance = 500 + 3000 - 200 = 3300; Remaining fixes = 50; Reserve 10% of 3000 = 300
    // Expected Reste à vivre = 3300 - 50 - 300 = 2950
    const before = computeBudgetSummary({
      initialBalance: 500,
      transactions,
      categories,
      recurringPayments: recurring,
      mandatoryReserveRate: 10,
      referenceDate: refDate,
    });
    expect(before.mandatoryReserveAmount).toBe(300);
    expect(before.resteAVivre).toBe(2950);

    // Record exceptional expense of 120 € drawn from reserve
    const drawdown = recordExceptionalExpense({
      amount: 120,
      date: '2026-11-12T10:00:00.000Z',
      note: 'Réparation pneu',
      monthIncome: before.monthIncome,
      mandatoryReserveRate: 10,
      existingReserveExpenses: [],
    });
    expect(drawdown.shieldBefore).toBe(300);
    expect(drawdown.shieldAfter).toBe(180);
    expect(drawdown.coveredByReserve).toBe(120);
    expect(drawdown.overflowFromBalance).toBe(0);

    // After drawdown: balance drops by 120 (3180), shield remaining is 180, Reste à vivre stays protected at 2950!
    const after = computeBudgetSummary({
      initialBalance: 500,
      transactions,
      categories,
      recurringPayments: recurring,
      mandatoryReserveRate: 10,
      reserveExpenses: drawdown.updatedReserveExpenses,
      referenceDate: refDate,
    });
    expect(after.currentBalance).toBe(3180);
    expect(after.reserveRemainingThisMonth).toBe(180);
    expect(after.resteAVivre).toBe(2950);

    // Category budget statuses remain untouched (Courses still 200 / 400 = green)
    const catStatuses = computeCategoryBudgetStatuses({
      categories,
      transactions,
      monthKey: '2026-11',
    });
    const foodStatus = catStatuses.find((c) => c.category.id === 'cat-food');
    expect(foodStatus?.spent).toBe(200);
    expect(foodStatus?.status).toBe('green');
  });

  it('projects compound wealth growth and inflation-adjusted real purchasing power', () => {
    const projection = projectWealthGrowth(
      [
        {
          currentValue: 10000,
          monthlyContribution: 200,
          expectedAnnualYield: 6,
        },
      ],
      10,
      2.5,
      2026
    );

    expect(projection.timeline).toHaveLength(11); // year 0..10
    expect(projection.initialCapital).toBe(10000);
    expect(projection.totalContributed).toBe(10000 + 200 * 12 * 10);
    expect(projection.finalNominalValue).toBeGreaterThan(projection.totalContributed);
    // Exact real value check: nominal / (1.025)^10
    const expectedReal =
      Math.round((projection.finalNominalValue / Math.pow(1.025, 10)) * 100) / 100;
    expect(projection.finalRealValue).toBeCloseTo(expectedReal, 1);
    expect(projection.totalInflationLoss).toBeGreaterThan(0);

    // Cash erosion check
    const erosion = calculateCashErosion(2000, 2.5);
    expect(erosion.realValueAfterOneYear).toBeCloseTo(2000 / 1.025, 1);
    expect(erosion.annualLoss).toBeGreaterThan(45);
    expect(erosion.fiveYearLoss).toBeGreaterThan(erosion.annualLoss * 4);
  });

  it('computes personal inflation comparing current year vs previous year category averages', () => {
    const refDate = new Date('2026-11-26T12:00:00.000Z');
    const transactions: TransactionDTO[] = [
      // 2025: 2 months, Courses avg 300 €/mo, Logement avg 900 €/mo -> total avg 1200 €/mo
      {
        id: 'y25-1',
        amount: 300,
        type: 'EXPENSE',
        date: '2025-03-10T10:00:00.000Z',
        note: null,
        categoryId: 'cat-food',
        recurringPaymentId: null,
        billingMonth: null,
      },
      {
        id: 'y25-2',
        amount: 300,
        type: 'EXPENSE',
        date: '2025-06-10T10:00:00.000Z',
        note: null,
        categoryId: 'cat-food',
        recurringPaymentId: null,
        billingMonth: null,
      },
      {
        id: 'y25-3',
        amount: 900,
        type: 'EXPENSE',
        date: '2025-03-05T10:00:00.000Z',
        note: null,
        categoryId: 'cat-housing',
        recurringPaymentId: null,
        billingMonth: null,
      },
      {
        id: 'y25-4',
        amount: 900,
        type: 'EXPENSE',
        date: '2025-06-05T10:00:00.000Z',
        note: null,
        categoryId: 'cat-housing',
        recurringPaymentId: null,
        billingMonth: null,
      },
      // 2026: 1 month, Courses 330 (+10%), Logement 930 (+3.33%) -> total 1260 (+5%)
      {
        id: 'y26-1',
        amount: 330,
        type: 'EXPENSE',
        date: '2026-11-10T10:00:00.000Z',
        note: null,
        categoryId: 'cat-food',
        recurringPaymentId: null,
        billingMonth: null,
      },
      {
        id: 'y26-2',
        amount: 930,
        type: 'EXPENSE',
        date: '2026-11-05T10:00:00.000Z',
        note: null,
        categoryId: 'cat-housing',
        recurringPaymentId: null,
        billingMonth: null,
      },
    ];

    const report = computePersonalInflation({
      transactions,
      categories,
      referenceDate: refDate,
    });

    expect(report.hasComparisonData).toBe(true);
    expect(report.previousYear).toBe(2025);
    expect(report.currentYear).toBe(2026);
    expect(report.personalInflationRate).toBe(5);
    expect(report.categories[0].categoryId).toBe('cat-food');
    expect(report.categories[0].inflationRate).toBe(10);
  });

  it('adds cash erosion optimization alert when manualInflationRate is configured', () => {
    const refDate = new Date('2026-11-20T12:00:00.000Z');
    const summary = computeBudgetSummary({
      initialBalance: 3500,
      transactions: [],
      categories,
      recurringPayments: [],
      mandatoryReserveRate: 10,
      referenceDate: refDate,
    });
    const tips = generateOptimizationTips({
      monthKey: '2026-11',
      summary,
      categoryStatuses: [],
      categories,
      transactions: [],
      manualInflationRate: 2.5,
    });
    expect(tips.some((t) => t.type === 'cash_erosion')).toBe(true);
  });

  it('calculates product price inflation (first or 12-month baseline) and global basket index', () => {
    // Product 1: entries spanning > 12 months -> baseline should pick the entry closest to 12m ago (Nov 2025: 8.00 €)
    const oliveOilEntries: PriceEntryDTO[] = [
      { id: 'e0', productId: 'p1', price: 6.5, store: 'Carrefour', recordedAt: '2024-06-01T10:00:00.000Z' },
      { id: 'e1', productId: 'p1', price: 8.0, store: 'Carrefour', recordedAt: '2025-11-15T10:00:00.000Z' },
      { id: 'e2', productId: 'p1', price: 9.0, store: 'Monoprix', recordedAt: '2026-05-15T10:00:00.000Z' },
      { id: 'e3', productId: 'p1', price: 10.0, store: 'Carrefour', recordedAt: '2026-11-20T10:00:00.000Z' },
    ];
    const oliveStats = calculateProductInflation(oliveOilEntries);
    expect(oliveStats.hasComparison).toBe(true);
    expect(oliveStats.baselinePrice).toBe(8.0);
    expect(oliveStats.latestPrice).toBe(10.0);
    expect(oliveStats.deltaAmount).toBe(2.0);
    expect(oliveStats.deltaPercent).toBe(25);
    expect(oliveStats.averagePrice).toBe(8.38);

    // Product 2: price drop (-10%) within 12 months
    const fuelEntries: PriceEntryDTO[] = [
      { id: 'f1', productId: 'p2', price: 2.0, store: 'Total', recordedAt: '2026-02-01T10:00:00.000Z' },
      { id: 'f2', productId: 'p2', price: 1.8, store: 'Total', recordedAt: '2026-11-20T10:00:00.000Z' },
    ];
    const fuelStats = calculateProductInflation(fuelEntries);
    expect(fuelStats.deltaAmount).toBe(-0.2);
    expect(fuelStats.deltaPercent).toBe(-10);

    // Global Basket Inflation Index: average of +25% and -10% = +7.5%
    const products: TrackedProductDTO[] = [
      {
        id: 'p1',
        name: "Huile d'olive",
        unit: '1 L',
        targetAlertPercent: 5,
        createdAt: '2024-06-01T10:00:00.000Z',
        entries: oliveOilEntries,
      },
      {
        id: 'p2',
        name: 'Essence SP95',
        unit: '1 L',
        targetAlertPercent: 5,
        createdAt: '2026-02-01T10:00:00.000Z',
        entries: fuelEntries,
      },
    ];

    const basket = calculateBasketInflationIndex(products);
    expect(basket.trackedCount).toBe(2);
    expect(basket.comparableCount).toBe(2);
    expect(basket.averageInflationPercent).toBe(7.5);
    expect(basket.productsRisingCount).toBe(1);
    expect(basket.productsFallingCount).toBe(1);
    expect(basket.alertTriggeredCount).toBe(1);
    expect(basket.items[0].product.id).toBe('p1');
    expect(basket.items[0].isAlertTriggered).toBe(true);
  });

  it('prepares monthly closing summary and detects the last 3 days of the month window', () => {
    // November has 30 days: 27 -> false (4 days left), 28/29/30 -> true
    expect(isWithinEndOfMonthWindow(new Date('2026-11-27T12:00:00Z'), 3)).toBe(false);
    expect(isWithinEndOfMonthWindow(new Date('2026-11-28T12:00:00Z'), 3)).toBe(true);
    expect(isWithinEndOfMonthWindow(new Date('2026-11-30T12:00:00Z'), 3)).toBe(true);

    const txs: TransactionDTO[] = [
      {
        id: 'mc-1',
        amount: 3000,
        type: 'INCOME',
        date: '2026-11-01T10:00:00.000Z',
        note: 'Salaire',
        categoryId: 'cat-salary',
        recurringPaymentId: null,
        billingMonth: null,
      },
      {
        id: 'mc-2',
        amount: 1800,
        type: 'EXPENSE',
        date: '2026-11-10T10:00:00.000Z',
        note: 'Dépenses',
        categoryId: 'cat-food',
        recurringPaymentId: null,
        billingMonth: null,
      },
    ];
    const assets = [
      { id: 'a1', currentValue: 10000 },
      { id: 'a2', currentValue: 15000 },
    ];
    const entries: PriceEntryDTO[] = [
      { id: 'pe1', productId: 'p1', price: 10, store: null, recordedAt: '2026-01-10T10:00:00.000Z' },
      { id: 'pe2', productId: 'p1', price: 10.6, store: null, recordedAt: '2026-11-20T10:00:00.000Z' }, // +6%
    ];

    const closeSummary = computeMonthlySummary(
      txs,
      assets,
      entries,
      { mandatoryReserveRate: 10, manualInflationRate: 2.5, initialBalance: 500 },
      { monthKey: '2026-11' }
    );

    expect(closeSummary.totalIncome).toBe(3000);
    expect(closeSummary.totalExpenses).toBe(1800);
    expect(closeSummary.reserveAmount).toBe(300);
    // Balance = 500 + 3000 - 1800 = 1700; netWorthEnd = 25000 + 1700 = 26700
    expect(closeSummary.currentBalance).toBe(1700);
    expect(closeSummary.finalResteAVivre).toBe(1400);
    expect(closeSummary.netWorthEnd).toBe(26700);
    expect(closeSummary.personalInflation).toBe(6);
    expect(closeSummary.savingsRatePercent).toBe(40);
  });

  it('generates UTF-8 BOM semicolon CSV with French decimals, DD/MM/YYYY dates, and proper escaping', () => {
    const raw = convertToCSV(
      [{ title: 'Note avec "guillemets"; et\nretour ligne', amount: 45.5, empty: null }],
      [
        { header: 'Titre', accessor: (r) => r.title },
        { header: 'Montant', accessor: (r) => r.amount },
        { header: 'Vide', accessor: (r) => r.empty },
      ]
    );

    expect(raw.startsWith('\uFEFF')).toBe(true);
    expect(raw).toContain('Titre;Montant;Vide\r\n');
    expect(raw).toContain('"Note avec ""guillemets""; et\nretour ligne";45,50;');

    const txCsv = formatTransactionsCSV(
      [
        {
          id: 'tx-csv-1',
          amount: 45.5,
          type: 'EXPENSE',
          date: '2026-11-26T12:00:00.000Z',
          note: 'Bistrot "Le Zen"',
          categoryId: 'cat-resto',
          recurringPaymentId: null,
          billingMonth: null,
        },
        {
          id: 'tx-csv-2',
          amount: 2920,
          type: 'INCOME',
          date: '2026-11-01T12:00:00.000Z',
          note: null,
          categoryId: 'cat-salary',
          recurringPaymentId: null,
          billingMonth: null,
        },
      ],
      categories
    );

    const txLines = txCsv.replace(/^\uFEFF/, '').split('\r\n');
    expect(txLines[0]).toBe('Date;Type (Entrée/Sortie);Catégorie;Montant (€);Note');
    expect(txLines[1]).toBe('26/11/2026;Sortie;Restaurants & Sorties;45,50;"Bistrot ""Le Zen"""');
    expect(txLines[2]).toBe('01/11/2026;Entrée;Salaire;2920,00;');

    const reportCsv = formatMonthlyReportsCSV([
      {
        id: 'rep-1',
        month: '2026-10',
        totalIncome: 2970,
        totalExpenses: 1825.24,
        reserveAmount: 297,
        netWorthEnd: 29190,
        personalInflation: 3.4,
        notes: 'Mois maîtrisé',
        closedAt: '2026-10-30T12:00:00.000Z',
      },
    ]);

    const repLines = reportCsv.replace(/^\uFEFF/, '').split('\r\n');
    expect(repLines[0]).toBe(
      'Mois;Revenus Totaux (€);Dépenses Totales (€);Réserve Sécurisée (€);Patrimoine Net (€);Inflation Personnelle (%);Date de Clôture;Notes'
    );
    expect(repLines[1]).toBe(
      '2026-10;2970,00;1825,24;297,00;29190,00;3,4;30/10/2026;Mois maîtrisé'
    );
  });

  it('calculates 2026 French progressive income tax, décote, PFU 31.4%, and 2OP recommendation', () => {
    // Low income (18 000 €, 1 part): gross = (18000 - 11600)*0.11 = 704 €, décote = 897 - 0.4525*704 = 578.44 €, net = 125.56 €
    const lowTax = calculateIncomeTax2026(18000, 1);
    expect(lowTax.tmi).toBe(11);
    expect(lowTax.grossTax).toBe(704);
    expect(lowTax.decote).toBeGreaterThan(500);
    expect(lowTax.netTax).toBeLessThan(200);

    // Mid income (40 000 €, 1 part):
    // 0..11600 -> 0
    // 11600..29579 -> 17979 * 0.11 = 1977.69
    // 29579..40000 -> 10421 * 0.30 = 3126.30
    // gross = 5103.99, no décote
    const midTax = calculateIncomeTax2026(40000, 1);
    expect(midTax.tmi).toBe(30);
    expect(midTax.grossTax).toBeCloseTo(5103.99, 1);
    expect(midTax.decote).toBe(0);
    expect(midTax.netTax).toBeCloseTo(5103.99, 1);

    // Capital tax 2026: PFU = 31.4% (12.8% IR + 18.6% PS)
    const capTmi11 = calculateCapitalTax2026(1000, 11);
    expect(capTmi11.pfuTotal).toBe(314);
    expect(capTmi11.progressiveTotal).toBe(296); // 110 + 186
    expect(capTmi11.isOption2OPAdvantageous).toBe(true);
    expect(capTmi11.savingsWith2OP).toBe(18);

    const capTmi30 = calculateCapitalTax2026(1000, 30);
    expect(capTmi30.pfuTotal).toBe(314);
    expect(capTmi30.isOption2OPAdvantageous).toBe(false);
    expect(capTmi30.recommendedMode).toBe('PFU');

    // Global tax summary balanceDue = totalEstimatedTax - withheldTaxPaid
    const globalSummary = computeGlobalTaxSummary({
      profile: {
        id: 1,
        fiscalParts: 1,
        deductionMode: 'STANDARD_10',
        actualFeesAmount: 0,
        withheldTaxPaid: 3000,
        updatedAt: '2026-11-26T10:00:00.000Z',
      },
      entries: [
        { id: 'tx1', year: 2026, category: 'INCOME', label: 'Salaire', taxableBase: 40000, computedTax: 0, notes: null },
        { id: 'tx2', year: 2026, category: 'CAPITAL', label: 'Dividendes', taxableBase: 1000, computedTax: 314, notes: null },
        { id: 'tx3', year: 2026, category: 'LOCAL', label: 'Taxe foncière', taxableBase: 0, computedTax: 800, notes: null },
      ],
      year: 2026,
    });
    // 10% deduction on 40000 = 4000 -> RNI 36000
    expect(globalSummary.netTaxableIncome).toBe(36000);
    expect(globalSummary.totalEstimatedTax).toBeGreaterThan(4000);
    expect(globalSummary.balanceDue).toBeCloseTo(globalSummary.totalEstimatedTax - 3000, 2);
  });

  it('computes weighted base-100 composite index values and multi-horizon variations', () => {
    const compResult = computeCompositeIndexValue(
      [
        { id: 'c1', sourceId: 'p1', label: 'Produit A', weightPercent: 60, baseReferenceValue: 10 },
        { id: 'c2', sourceId: 'p2', label: 'Produit B', weightPercent: 40, baseReferenceValue: 20 },
      ],
      { c1: 12, c2: 21 }, // A: +20% (120), B: +5% (105) -> 0.6*120 + 0.4*105 = 72 + 42 = 114
      100
    );

    expect(compResult.isWeightValid).toBe(true);
    expect(compResult.value).toBe(114);
    expect(compResult.deltaPercent).toBe(14);

    const variations = computeIndexVariations(
      [
        { id: 'd1', indexId: 'i1', value: 100, recordedAt: '2025-11-20T12:00:00.000Z' },
        { id: 'd2', indexId: 'i1', value: 106, recordedAt: '2026-05-20T12:00:00.000Z' },
        { id: 'd3', indexId: 'i1', value: 110, recordedAt: '2026-10-20T12:00:00.000Z' },
        { id: 'd4', indexId: 'i1', value: 114, recordedAt: '2026-11-26T12:00:00.000Z' },
      ],
      114,
      100,
      new Date('2026-11-26T12:00:00.000Z')
    );

    expect(variations.sinceCreationPercent).toBe(14);
    expect(variations.oneYearPercent).toBe(14);
    expect(variations.sixMonthsPercent).toBeCloseTo(((114 - 106) / 106) * 100, 1);
    expect(variations.oneMonthPercent).toBeCloseTo(((114 - 110) / 110) * 100, 1);
  });

  it('parses quick Command Palette transaction commands accurately', () => {
    const expense = parseQuickCommand('-18.50 courses pain complet', categories);
    expect(expense).not.toBeNull();
    expect(expense?.type).toBe('EXPENSE');
    expect(expense?.amount).toBe(18.5);
    expect(expense?.category.id).toBe('cat-food');
    expect(expense?.matchedByKeyword).toBe(true);
    expect(expense?.note).toBe('pain complet');
    expect(expense?.previewLabel).toContain('Enregistrer une sortie de');
    expect(expense?.previewLabel).toContain('[Courses]');
    expect(expense?.previewLabel).toContain('Note : pain complet');

    const income = parseQuickCommand('+2100 salaire', categories);
    expect(income).not.toBeNull();
    expect(income?.type).toBe('INCOME');
    expect(income?.amount).toBe(2100);
    expect(income?.category.id).toBe('cat-salary');
    expect(income?.note).toBeNull();
    expect(income?.previewLabel).toContain('Enregistrer une entrée de');
    expect(income?.previewLabel).toContain('[Salaire]');

    // Shorthand alias ("resto" -> "Restaurants & Sorties") & comma decimal
    const resto = parseQuickCommand('-24,90 resto sushis', categories);
    expect(resto?.category.id).toBe('cat-resto');
    expect(resto?.amount).toBe(24.9);
    expect(resto?.note).toBe('sushis');

    // Non-amount queries return null so normal cmdk search works
    expect(parseQuickCommand('patrimoine', categories)).toBeNull();
    expect(parseQuickCommand('', categories)).toBeNull();
  });

  it('parses UTF-8 BOM/comma/semicolon CSV transactions, detects new categories, invalid rows, and duplicates', () => {
    const existingTxs: TransactionDTO[] = [
      {
        id: 'ex-1',
        amount: 45.5,
        type: 'EXPENSE',
        date: '2026-11-26T12:00:00.000Z',
        note: 'Boulangerie',
        categoryId: 'cat-food',
        recurringPaymentId: null,
        billingMonth: null,
      },
    ];

    const semicolonCsv = [
      '\uFEFFDate;Type (Entrée/Sortie);Catégorie;Montant (€);Note',
      '26/11/2026;Sortie;Courses;45,50 €;Boulangerie', // duplicate of ex-1
      '2026-11-25;Entrée;Salaire;2 800,00 €;Virement mensuel', // valid ISO date + French thousands
      '24/11/2026;Sortie;Animaux;32.90;Croquettes chat', // valid English decimal + NEW category!
      '32/13/2026;Sortie;Courses;15,00;Date invalide', // invalid date
      '20/11/2026;Sortie;Courses;abc;Montant invalide', // invalid amount
    ].join('\r\n');

    const parsed = parseTransactionsCSV(semicolonCsv, {
      existingCategories: categories,
      existingTransactions: existingTxs,
    });

    expect(parsed.delimiter).toBe(';');
    expect(parsed.validCount).toBe(3);
    expect(parsed.invalidCount).toBe(2);
    expect(parsed.duplicateCount).toBe(1);
    expect(parsed.rows[0].isDuplicate).toBe(true);
    expect(parsed.rows[1].type).toBe('INCOME');
    expect(parsed.rows[1].amount).toBe(2800);
    expect(parsed.rows[2].willCreateCategory).toBe(true);
    expect(parsed.rows[2].categoryName).toBe('Animaux');
    expect(parsed.newCategoriesToCreate).toEqual([{ name: 'Animaux', type: 'EXPENSE' }]);
    expect(parsed.rows[3].isValid).toBe(false);
    expect(parsed.rows[4].isValid).toBe(false);

    // Comma delimiter auto-detection & round-trip check
    const commaCsv = 'Date,Type,Catégorie,Montant,Note\n26/11/2026,Sortie,Courses,19.99,Test virgule';
    const commaParsed = parseTransactionsCSV(commaCsv, { existingCategories: categories });
    expect(commaParsed.delimiter).toBe(',');
    expect(commaParsed.validCount).toBe(1);
    expect(commaParsed.rows[0].amount).toBe(19.99);
  });
});
