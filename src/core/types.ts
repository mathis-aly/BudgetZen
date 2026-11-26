export type TransactionType = 'EXPENSE' | 'INCOME';

export type AlertStatus = 'green' | 'orange' | 'red';

export type PaceStatus = 'ahead' | 'watch' | 'fast';

export interface AccountSettingsDTO {
  id: string;
  accountName: string;
  initialBalance: number;
  currency: string;
  monthlyIncomeTarget: number;
}

export interface UserSettingsDTO {
  id: number;
  mandatoryReserveRate: number; // default 10.0 (%)
  manualInflationRate: number; // default 2.5 (%)
  updatedAt: string;
}

export type WealthAssetCategory = 'SAVINGS' | 'STOCKS' | 'REAL_ESTATE' | 'OTHER';

export interface AssetSnapshotDTO {
  id: string;
  assetId: string;
  value: number;
  recordedAt: string;
}

export interface WealthAssetDTO {
  id: string;
  name: string;
  category: WealthAssetCategory;
  currentValue: number;
  monthlyContribution: number;
  expectedAnnualYield: number; // annual %
  lastUpdated: string;
  snapshots?: AssetSnapshotDTO[];
}

export interface ReserveExpenseDTO {
  id: string;
  amount: number;
  date: string;
  note: string | null;
}

export interface ExceptionalExpenseResult {
  expense: ReserveExpenseDTO;
  updatedReserveExpenses: ReserveExpenseDTO[];
  shieldBefore: number;
  shieldAfter: number;
  coveredByReserve: number;
  overflowFromBalance: number;
}

export interface WealthProjectionYearPoint {
  year: number;
  calendarYear: number;
  nominalValue: number;
  realValue: number;
  totalContributed: number;
  compoundInterest: number;
  inflationLoss: number;
}

export interface WealthProjectionResult {
  years: number;
  inflationRate: number;
  initialCapital: number;
  totalMonthlyContribution: number;
  weightedAnnualYield: number;
  finalNominalValue: number;
  finalRealValue: number;
  totalContributed: number;
  totalInterestGenerated: number;
  totalInflationLoss: number;
  timeline: WealthProjectionYearPoint[];
}

export interface CashErosionResult {
  idleCashAmount: number;
  inflationRate: number;
  annualLoss: number;
  monthlyLoss: number;
  realValueAfterOneYear: number;
  fiveYearLoss: number;
}

export interface CategoryInflationItem {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  previousMonthlyAvg: number;
  currentMonthlyAvg: number;
  monthlyDelta: number;
  inflationRate: number; // %
}

export interface PersonalInflationReport {
  hasComparisonData: boolean;
  previousYear: number;
  currentYear: number;
  previousMonthsSampled: number;
  currentMonthsSampled: number;
  personalInflationRate: number; // weighted %
  totalPreviousMonthlyAvg: number;
  totalCurrentMonthlyAvg: number;
  monthlyCostDelta: number;
  categories: CategoryInflationItem[];
}

export interface PriceEntryDTO {
  id: string;
  productId: string;
  price: number;
  store: string | null;
  recordedAt: string;
}

export interface TrackedProductDTO {
  id: string;
  name: string;
  unit: string;
  targetAlertPercent: number;
  createdAt: string;
  entries: PriceEntryDTO[];
}

export interface ProductInflationStats {
  entryCount: number;
  hasComparison: boolean;
  baselinePrice: number;
  baselineDate: string | null;
  latestPrice: number;
  latestDate: string | null;
  latestStore: string | null;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  deltaAmount: number;
  deltaPercent: number;
  sortedEntries: PriceEntryDTO[];
}

export interface BasketProductItem {
  product: TrackedProductDTO;
  stats: ProductInflationStats;
  isAlertTriggered: boolean;
}

export interface BasketInflationIndex {
  trackedCount: number;
  comparableCount: number;
  averageInflationPercent: number;
  productsRisingCount: number;
  productsFallingCount: number;
  alertTriggeredCount: number;
  items: BasketProductItem[];
}

export interface MonthlyReportDTO {
  id: string;
  month: string; // "YYYY-MM"
  totalIncome: number;
  totalExpenses: number;
  reserveAmount: number;
  netWorthEnd: number;
  personalInflation: number;
  notes: string | null;
  closedAt: string;
}

export type SurplusAllocationOption =
  | 'KEEP_CHECKING'
  | 'TRANSFER_SAVINGS'
  | 'INVEST_LONG_TERM';

export interface MonthlyCloseSummary {
  monthKey: string;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  savingsRatePercent: number;
  mandatoryReserveRate: number;
  reserveAmount: number;
  reserveUsed: number;
  reserveRemaining: number;
  currentBalance: number;
  remainingFixedCharges: number;
  finalResteAVivre: number;
  surplusAvailable: number;
  assetsTotal: number;
  netWorthEnd: number;
  personalInflation: number;
  basketComparableCount: number;
}

// ============================================================================
// Module: Fiscalité & Aide à la Déclaration
// ============================================================================
export type TaxDeductionMode = 'STANDARD_10' | 'ACTUAL_FEES';

export type TaxEntryCategory = 'INCOME' | 'CAPITAL' | 'LOCAL' | 'OTHER';

export interface TaxProfileDTO {
  id: number;
  fiscalParts: number;
  deductionMode: TaxDeductionMode;
  actualFeesAmount: number;
  withheldTaxPaid: number;
  updatedAt: string;
}

export interface TaxEntryDTO {
  id: string;
  year: number;
  category: TaxEntryCategory;
  label: string;
  taxableBase: number;
  computedTax: number;
  notes: string | null;
}

export interface TaxBracketBreakdown {
  min: number;
  max: number | null;
  rate: number; // 0, 11, 30, 41, 45
  taxableSlicePerPart: number;
  taxPerPart: number;
  totalTaxForBracket: number;
}

export interface IncomeTax2026Result {
  netTaxableIncome: number;
  fiscalParts: number;
  quotientFamilial: number;
  grossTax: number;
  decote: number;
  netTax: number;
  tmi: number; // 0 | 11 | 30 | 41 | 45
  effectiveRate: number; // %
  brackets: TaxBracketBreakdown[];
}

export interface CapitalTax2026Result {
  capitalGains: number;
  tmi: number;
  pfuIrPart: number; // 12.8%
  socialContributions: number; // 18.6%
  pfuTotal: number; // 31.4%
  progressiveIrPart: number; // tmi%
  progressiveTotal: number; // tmi% + 18.6%
  isOption2OPAdvantageous: boolean;
  recommendedMode: 'PFU' | 'OPTION_2OP';
  savingsWith2OP: number;
  effectiveOptimalTax: number;
  recommendationText: string;
}

export interface DeclarationGuideLine {
  id: string;
  boxCode: string;
  label: string;
  amount: number | null;
  valueText?: string;
  section: 'REVENUS' | 'DEDUCTIONS' | 'CAPITAL' | 'SOLDE' | 'LOCAL';
  hint: string;
  highlight?: boolean;
}

export interface GlobalTaxSummary {
  year: number;
  grossIncomeBase: number;
  deductionAmount: number;
  netTaxableIncome: number;
  incomeTax: IncomeTax2026Result;
  capitalBase: number;
  capitalTax: CapitalTax2026Result;
  localTaxTotal: number;
  otherTaxTotal: number;
  totalEstimatedTax: number;
  withheldTaxPaid: number;
  balanceDue: number; // positive = reste à payer, negative = remboursement estimé
  globalTaxPressureRate: number; // %
  declarationLines: DeclarationGuideLine[];
}

// ============================================================================
// Module: Créateur d'Indices Personnalisés
// ============================================================================
export type CustomIndexType = 'COMPOSITE' | 'MANUAL';

export type IndexComponentSourceType =
  | 'TRACKED_PRODUCT'
  | 'EXPENSE_CATEGORY'
  | 'WEALTH_ASSET'
  | 'MANUAL_SERIES';

export interface IndexComponentDTO {
  id: string;
  indexId: string;
  sourceType: IndexComponentSourceType;
  sourceId: string | null;
  label: string;
  weightPercent: number;
  baseReferenceValue: number;
}

export interface IndexDataPointDTO {
  id: string;
  indexId: string;
  value: number;
  recordedAt: string;
}

export interface CustomIndexDTO {
  id: string;
  name: string;
  description: string | null;
  baseValue: number;
  type: CustomIndexType;
  createdAt: string;
  components: IndexComponentDTO[];
  dataPoints: IndexDataPointDTO[];
}

export interface CompositeIndexCalculation {
  value: number;
  baseValue: number;
  deltaFromBase: number;
  deltaPercent: number;
  totalWeight: number;
  isWeightValid: boolean;
  componentBreakdown: Array<{
    componentId: string;
    label: string;
    weightPercent: number;
    baseReferenceValue: number;
    currentValue: number;
    componentVariationPercent: number;
    weightedPoints: number;
  }>;
}

export interface IndexVariationsResult {
  currentValue: number;
  oneMonthPercent: number | null;
  sixMonthsPercent: number | null;
  oneYearPercent: number | null;
  sinceCreationPercent: number;
  sortedDataPoints: IndexDataPointDTO[];
}

export interface CategoryDTO {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  monthlyLimit: number;
  alertThreshold: number; // default 80 (%)
  isArchived: boolean;
  sortOrder: number;
}

export interface TransactionDTO {
  id: string;
  amount: number;
  type: TransactionType;
  date: string; // ISO string
  note: string | null;
  categoryId: string;
  recurringPaymentId: string | null;
  billingMonth: string | null;
}

export interface RecurringPaymentDTO {
  id: string;
  title: string;
  amount: number;
  type?: TransactionType; // defaults to 'EXPENSE'
  isTaxable?: boolean; // defaults to true
  dayOfMonth: number;
  categoryId: string;
  isActive: boolean;
  note: string | null;
  lastPaidMonth: string | null;
}

export interface CategoryBudgetStatus {
  category: CategoryDTO;
  spent: number;
  monthlyLimit: number;
  remaining: number;
  usagePercent: number;
  status: AlertStatus;
  transactionCount: number;
}

export interface TransactionImpactPreview {
  categoryId: string;
  categoryName: string;
  monthlyLimit: number;
  currentSpent: number;
  projectedSpent: number;
  remainingAfter: number;
  currentPercent: number;
  projectedPercent: number;
  currentStatus: AlertStatus;
  projectedStatus: AlertStatus;
  statusWorsened: boolean;
  willExceedLimit: boolean;
  exceededBy: number;
  projectedResteAVivre: number;
}

export interface UpcomingRecurringItem {
  payment: RecurringPaymentDTO;
  category?: CategoryDTO;
  dueDate: string; // ISO date string YYYY-MM-DD
  billingMonth: string; // YYYY-MM
  daysUntilDue: number; // negative if overdue in current month, 0 if today
  isOverdue: boolean;
  isPaid: boolean;
}

export interface BudgetSummary {
  monthKey: string; // YYYY-MM
  currentBalance: number;
  remainingFixedCharges: number;
  remainingFixedCount: number;
  paidFixedCharges: number;
  remainingFixedIncome: number;
  remainingFixedIncomeCount: number;
  paidFixedIncome: number;
  expectedMonthlyFixedIncome: number;
  mandatoryReserveRate: number;
  mandatoryReserveAmount: number;
  reserveUsedThisMonth: number;
  reserveRemainingThisMonth: number;
  resteAVivre: number;
  projectedEndOfMonthBalance: number;
  monthIncome: number;
  monthExpenses: number;
  netMonthFlow: number;
  totalMonthlyBudget: number;
  budgetedExpenses: number;
  monthProgressPercent: number;
  spendingPacePercent: number;
  paceDeltaPercent: number;
  paceStatus: PaceStatus;
  daysInMonth: number;
  currentDayOfMonth: number;
  daysRemainingInMonth: number;
  dailySafeSpend: number;
}

export type OptimizationTipType =
  | 'surge'
  | 'daily_budget'
  | 'rebalance'
  | 'pace'
  | 'savings'
  | 'cash_erosion';

export type OptimizationSeverity = 'critical' | 'warning' | 'info' | 'positive';

export interface RebalanceSuggestion {
  fromCategoryId: string;
  fromCategoryName: string;
  toCategoryId: string;
  toCategoryName: string;
  amount: number;
}

export interface OptimizationTip {
  id: string;
  type: OptimizationTipType;
  severity: OptimizationSeverity;
  title: string;
  description: string;
  metric: string;
  categoryId?: string;
  rebalance?: RebalanceSuggestion;
}

export interface MonthlyEvolutionPoint {
  monthKey: string;
  label: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface CategoryDistributionPoint {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  percentage: number;
  monthlyLimit: number;
  status: AlertStatus;
}

// ============================================================================
// Module: Planification (Canevas Éditorial)
// ============================================================================
export type PlanningNodeType = 'IDEA' | 'RESOURCE' | 'GOAL';
export type PlanningResourceKind = 'YOUTUBE' | 'ARTICLE';

export interface PlanningNodeDTO {
  id: string;
  type: PlanningNodeType;
  title: string;
  content: string | null;
  url: string | null;
  resourceKind: PlanningResourceKind | null;
  positionX: number;
  positionY: number;
  createdAt: string;
}

export interface PlanningEdgeDTO {
  id: string;
  sourceId: string;
  targetId: string;
  label: string | null;
}

// ============================================================================
// Module: Projets & Financements
// ============================================================================
export type FinancialProjectCategory = 'REAL_ESTATE' | 'VEHICLE' | 'OTHER';

export interface FinancialProjectInput {
  currentPrice: number;
  extraFeesPercent: number;
  annualPriceGrowthPercent: number;
  targetMonths: number;
  savedAmount: number;
  useLoan: boolean;
  downPaymentPercent: number;
  loanInterestRate: number;
  loanDurationYears: number;
}

export interface FinancialProjectDTO extends FinancialProjectInput {
  id: string;
  name: string;
  category: FinancialProjectCategory;
  createdAt: string;
}

export interface FinancialProjectMetrics {
  projectedPrice: number;
  priceGrowthDelta: number;
  extraFeesAmount: number;
  totalProjectCost: number;
  requiredSavingsTarget: number;
  remainingSavingsNeeded: number;
  progressPercent: number;
  requiredMonthlySavings: number;
  loanPrincipal: number;
  monthlyLoanPayment: number;
  totalLoanInterestCost: number;
  debtToIncomeRatio: number;
  isHighDebtRisk: boolean;
}

// ============================================================================
// Module: Marchés & Devises en Temps Réel
// ============================================================================
export type MarketSymbol = 'EURUSD' | 'GOLD' | 'SILVER';
export type MarketRange = '1d' | '5d' | '1mo' | '1y' | '5y' | 'max';

export interface MarketQuoteDTO {
  symbol: MarketSymbol;
  label: string;
  unitCurrency: 'USD' | 'EUR';
  decimals: 4 | 2;
  price: number;
  changePercent: number;
  previousClose: number;
}

export interface MarketsSnapshotResponse {
  quotes: Record<MarketSymbol, MarketQuoteDTO>;
  updatedAt: string;
  source: 'LIVE' | 'MIXED' | 'FALLBACK';
  warning?: string | null;
}

export interface MarketHistoryPoint {
  timestamp: number;
  date: string;
  close: number;
}

export interface MarketHistoryResponse {
  symbol: MarketSymbol;
  label: string;
  range: MarketRange;
  unitCurrency: 'USD' | 'EUR';
  decimals: 4 | 2;
  currentPrice: number;
  changePercent: number;
  high: number;
  low: number;
  points: MarketHistoryPoint[];
  updatedAt: string;
  source: 'LIVE' | 'FALLBACK';
  warning?: string | null;
}
