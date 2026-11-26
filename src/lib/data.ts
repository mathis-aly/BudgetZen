import { prisma } from './prisma';
import type {
  AccountSettingsDTO,
  CategoryDTO,
  CustomIndexDTO,
  CustomIndexType,
  FinancialProjectCategory,
  FinancialProjectDTO,
  IndexComponentSourceType,
  MonthlyReportDTO,
  PlanningEdgeDTO,
  PlanningNodeDTO,
  RecurringPaymentDTO,
  ReserveExpenseDTO,
  TaxDeductionMode,
  TaxEntryCategory,
  TaxEntryDTO,
  TaxProfileDTO,
  TrackedProductDTO,
  TransactionDTO,
  TransactionType,
  UserSettingsDTO,
  WealthAssetCategory,
  WealthAssetDTO,
} from '@/core';

export interface AppBootstrapData {
  settings: AccountSettingsDTO;
  userSettings: UserSettingsDTO;
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  recurringPayments: RecurringPaymentDTO[];
  wealthAssets: WealthAssetDTO[];
  reserveExpenses: ReserveExpenseDTO[];
  trackedProducts: TrackedProductDTO[];
  monthlyReports: MonthlyReportDTO[];
  taxProfile: TaxProfileDTO;
  taxEntries: TaxEntryDTO[];
  customIndices: CustomIndexDTO[];
  financialProjects: FinancialProjectDTO[];
  planningNodes?: PlanningNodeDTO[];
  planningEdges?: PlanningEdgeDTO[];
}

const VALID_PROJECT_CATEGORIES: FinancialProjectCategory[] = [
  'REAL_ESTATE',
  'VEHICLE',
  'OTHER',
];

const VALID_WEALTH_CATEGORIES: WealthAssetCategory[] = [
  'SAVINGS',
  'STOCKS',
  'REAL_ESTATE',
  'OTHER',
];

export async function getBootstrapData(): Promise<AppBootstrapData> {
  let [settingsRow, userSettingsRow, taxProfileRow] = await Promise.all([
    prisma.accountSettings.findUnique({ where: { id: 'default' } }),
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    prisma.taxProfile.findUnique({ where: { id: 1 } }),
  ]);

  if (!settingsRow) {
    settingsRow = await prisma.accountSettings.create({
      data: {
        id: 'default',
        accountName: 'Compte Courant',
        initialBalance: 0,
        currency: 'EUR',
        monthlyIncomeTarget: 2800,
      },
    });
  }

  if (!userSettingsRow) {
    userSettingsRow = await prisma.userSettings.create({
      data: {
        id: 1,
        mandatoryReserveRate: 10.0,
        manualInflationRate: 2.5,
      },
    });
  }

  if (!taxProfileRow) {
    taxProfileRow = await prisma.taxProfile.create({
      data: {
        id: 1,
        fiscalParts: 1.0,
        deductionMode: 'STANDARD_10',
        actualFeesAmount: 0,
        withheldTaxPaid: 0,
      },
    });
  }

  const [
    categoriesRows,
    transactionsRows,
    recurringRows,
    wealthAssetsRows,
    reserveExpensesRows,
    trackedProductsRows,
    monthlyReportsRows,
    taxEntriesRows,
    customIndicesRows,
    financialProjectsRows,
  ] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.transaction.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.recurringPayment.findMany({
      orderBy: [{ dayOfMonth: 'asc' }, { title: 'asc' }],
    }),
    prisma.wealthAsset.findMany({
      orderBy: [{ currentValue: 'desc' }, { name: 'asc' }],
      include: {
        snapshots: {
          orderBy: { recordedAt: 'asc' },
        },
      },
    }),
    prisma.reserveExpense.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.trackedProduct.findMany({
      orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
      include: {
        entries: {
          orderBy: { recordedAt: 'asc' },
        },
      },
    }),
    prisma.monthlyReport.findMany({
      orderBy: { month: 'desc' },
    }),
    prisma.taxEntry.findMany({
      orderBy: [{ year: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.customIndex.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        components: true,
        dataPoints: { orderBy: { recordedAt: 'asc' } },
      },
    }),
    prisma.financialProject.findMany({
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    settings: {
      id: settingsRow.id,
      accountName: settingsRow.accountName,
      initialBalance: settingsRow.initialBalance,
      currency: settingsRow.currency,
      monthlyIncomeTarget: settingsRow.monthlyIncomeTarget,
    },
    userSettings: {
      id: userSettingsRow.id,
      mandatoryReserveRate: userSettingsRow.mandatoryReserveRate,
      manualInflationRate: userSettingsRow.manualInflationRate,
      updatedAt: userSettingsRow.updatedAt.toISOString(),
    },
    categories: categoriesRows.map((c) => ({
      id: c.id,
      name: c.name,
      type: (c.type === 'INCOME' ? 'INCOME' : 'EXPENSE') as TransactionType,
      color: c.color,
      icon: c.icon,
      monthlyLimit: c.monthlyLimit,
      alertThreshold: c.alertThreshold,
      isArchived: c.isArchived,
      sortOrder: c.sortOrder,
    })),
    transactions: transactionsRows.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: (t.type === 'INCOME' ? 'INCOME' : 'EXPENSE') as TransactionType,
      date: t.date.toISOString(),
      note: t.note,
      categoryId: t.categoryId,
      recurringPaymentId: t.recurringPaymentId,
      billingMonth: t.billingMonth,
    })),
    recurringPayments: recurringRows.map((r) => ({
      id: r.id,
      title: r.title,
      amount: r.amount,
      type: (r.type === 'INCOME' ? 'INCOME' : 'EXPENSE') as TransactionType,
      isTaxable: r.isTaxable,
      dayOfMonth: r.dayOfMonth,
      categoryId: r.categoryId,
      isActive: r.isActive,
      note: r.note,
      lastPaidMonth: r.lastPaidMonth,
    })),
    wealthAssets: wealthAssetsRows.map((a) => ({
      id: a.id,
      name: a.name,
      category: (VALID_WEALTH_CATEGORIES.includes(a.category as WealthAssetCategory)
        ? a.category
        : 'OTHER') as WealthAssetCategory,
      currentValue: a.currentValue,
      monthlyContribution: a.monthlyContribution,
      expectedAnnualYield: a.expectedAnnualYield,
      lastUpdated: a.lastUpdated.toISOString(),
      snapshots: a.snapshots.map((s) => ({
        id: s.id,
        assetId: s.assetId,
        value: s.value,
        recordedAt: s.recordedAt.toISOString(),
      })),
    })),
    reserveExpenses: reserveExpensesRows.map((e) => ({
      id: e.id,
      amount: e.amount,
      date: e.date.toISOString(),
      note: e.note,
    })),
    trackedProducts: trackedProductsRows.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      targetAlertPercent: p.targetAlertPercent,
      createdAt: p.createdAt.toISOString(),
      entries: p.entries.map((e) => ({
        id: e.id,
        productId: e.productId,
        price: e.price,
        store: e.store,
        recordedAt: e.recordedAt.toISOString(),
      })),
    })),
    monthlyReports: monthlyReportsRows.map((r) => ({
      id: r.id,
      month: r.month,
      totalIncome: r.totalIncome,
      totalExpenses: r.totalExpenses,
      reserveAmount: r.reserveAmount,
      netWorthEnd: r.netWorthEnd,
      personalInflation: r.personalInflation,
      notes: r.notes,
      closedAt: r.closedAt.toISOString(),
    })),
    taxProfile: {
      id: taxProfileRow.id,
      fiscalParts: taxProfileRow.fiscalParts,
      deductionMode: (taxProfileRow.deductionMode === 'ACTUAL_FEES'
        ? 'ACTUAL_FEES'
        : 'STANDARD_10') as TaxDeductionMode,
      actualFeesAmount: taxProfileRow.actualFeesAmount,
      withheldTaxPaid: taxProfileRow.withheldTaxPaid,
      updatedAt: taxProfileRow.updatedAt.toISOString(),
    },
    taxEntries: taxEntriesRows.map((e) => ({
      id: e.id,
      year: e.year,
      category: (['INCOME', 'CAPITAL', 'LOCAL', 'OTHER'].includes(e.category)
        ? e.category
        : 'OTHER') as TaxEntryCategory,
      label: e.label,
      taxableBase: e.taxableBase,
      computedTax: e.computedTax,
      notes: e.notes,
    })),
    customIndices: customIndicesRows.map((idx) => ({
      id: idx.id,
      name: idx.name,
      description: idx.description,
      baseValue: idx.baseValue,
      type: (idx.type === 'MANUAL' ? 'MANUAL' : 'COMPOSITE') as CustomIndexType,
      createdAt: idx.createdAt.toISOString(),
      components: idx.components.map((c) => ({
        id: c.id,
        indexId: c.indexId,
        sourceType: c.sourceType as IndexComponentSourceType,
        sourceId: c.sourceId,
        label: c.label,
        weightPercent: c.weightPercent,
        baseReferenceValue: c.baseReferenceValue,
      })),
      dataPoints: idx.dataPoints.map((d) => ({
        id: d.id,
        indexId: d.indexId,
        value: d.value,
        recordedAt: d.recordedAt.toISOString(),
      })),
    })),
    financialProjects: financialProjectsRows.map((p) => ({
      id: p.id,
      name: p.name,
      category: (VALID_PROJECT_CATEGORIES.includes(
        p.category as FinancialProjectCategory
      )
        ? p.category
        : 'OTHER') as FinancialProjectCategory,
      currentPrice: p.currentPrice,
      extraFeesPercent: p.extraFeesPercent,
      annualPriceGrowthPercent: p.annualPriceGrowthPercent,
      targetMonths: p.targetMonths,
      savedAmount: p.savedAmount,
      useLoan: p.useLoan,
      downPaymentPercent: p.downPaymentPercent,
      loanInterestRate: p.loanInterestRate,
      loanDurationYears: p.loanDurationYears,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}
