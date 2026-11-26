import type {
  AlertStatus,
  FinancialProjectInput,
  FinancialProjectMetrics,
} from './types';
import { roundCurrency } from './format';

/**
 * Computes pure forward pricing, required savings effort, and optional
 * amortizing loan metrics for a major planned purchase (real estate, vehicle, or other).
 */
export function computeProjectMetrics(
  project: FinancialProjectInput,
  monthlyIncome: number
): FinancialProjectMetrics {
  const currentPrice = Math.max(0, Number(project.currentPrice) || 0);
  const extraFeesPercent = Math.max(0, Number(project.extraFeesPercent) || 0);
  const annualPriceGrowthPercent = Math.max(
    -95,
    Number(project.annualPriceGrowthPercent) || 0
  );
  const targetMonths = Math.max(
    1,
    Math.round(Number(project.targetMonths) || 1)
  );
  const savedAmount = Math.max(0, Number(project.savedAmount) || 0);
  const downPaymentPercent = Math.min(
    100,
    Math.max(0, Number(project.downPaymentPercent) || 0)
  );
  const loanInterestRate = Math.max(0, Number(project.loanInterestRate) || 0);
  const loanDurationYears = Math.max(
    1,
    Math.round(Number(project.loanDurationYears) || 1)
  );
  const safeMonthlyIncome = Math.max(0, Number(monthlyIncome) || 0);

  const projectedPrice = roundCurrency(
    currentPrice * Math.pow(1 + annualPriceGrowthPercent / 100, targetMonths / 12)
  );
  const priceGrowthDelta = roundCurrency(projectedPrice - currentPrice);
  const totalProjectCost = roundCurrency(
    projectedPrice * (1 + extraFeesPercent / 100)
  );
  const extraFeesAmount = roundCurrency(totalProjectCost - projectedPrice);

  const requiredSavingsTarget = project.useLoan
    ? roundCurrency(totalProjectCost * (downPaymentPercent / 100))
    : totalProjectCost;

  const remainingSavingsNeeded = roundCurrency(
    Math.max(0, requiredSavingsTarget - savedAmount)
  );
  const progressPercent =
    requiredSavingsTarget <= 0
      ? 100
      : Math.round((savedAmount / requiredSavingsTarget) * 1000) / 10;

  const requiredMonthlySavings = roundCurrency(
    Math.max(0, (requiredSavingsTarget - savedAmount) / targetMonths)
  );

  if (!project.useLoan) {
    return {
      projectedPrice,
      priceGrowthDelta,
      extraFeesAmount,
      totalProjectCost,
      requiredSavingsTarget,
      remainingSavingsNeeded,
      progressPercent,
      requiredMonthlySavings,
      loanPrincipal: 0,
      monthlyLoanPayment: 0,
      totalLoanInterestCost: 0,
      debtToIncomeRatio: 0,
      isHighDebtRisk: false,
    };
  }

  const loanPrincipal = roundCurrency(
    Math.max(0, totalProjectCost - requiredSavingsTarget)
  );
  const n = loanDurationYears * 12;
  const r = loanInterestRate / 100 / 12;

  let monthlyLoanPayment = 0;
  if (loanPrincipal > 0) {
    if (r === 0) {
      monthlyLoanPayment = roundCurrency(loanPrincipal / n);
    } else {
      monthlyLoanPayment = roundCurrency(
        loanPrincipal * (r / (1 - Math.pow(1 + r, -n)))
      );
    }
  }

  const totalLoanInterestCost = roundCurrency(
    Math.max(0, monthlyLoanPayment * n - loanPrincipal)
  );
  const debtToIncomeRatio =
    safeMonthlyIncome > 0
      ? Math.round((monthlyLoanPayment / safeMonthlyIncome) * 1000) / 10
      : monthlyLoanPayment > 0
        ? 100
        : 0;

  return {
    projectedPrice,
    priceGrowthDelta,
    extraFeesAmount,
    totalProjectCost,
    requiredSavingsTarget,
    remainingSavingsNeeded,
    progressPercent,
    requiredMonthlySavings,
    loanPrincipal,
    monthlyLoanPayment,
    totalLoanInterestCost,
    debtToIncomeRatio,
    isHighDebtRisk: debtToIncomeRatio > 35,
  };
}

/**
 * Evaluates whether the required monthly savings fit within the user's current Reste à vivre.
 */
export function evaluateProjectEffort(
  requiredMonthlySavings: number,
  resteAVivre: number
): {
  tone: 'green' | 'orange' | 'red';
  status: AlertStatus;
  label: string;
  sharePercent: number;
} {
  if (requiredMonthlySavings <= 0) {
    return {
      tone: 'green',
      status: 'green',
      label: 'Objectif atteint',
      sharePercent: 0,
    };
  }

  if (resteAVivre <= 0) {
    return {
      tone: 'red',
      status: 'red',
      label: 'Capacité nulle',
      sharePercent: 100,
    };
  }

  const sharePercent =
    Math.round((requiredMonthlySavings / resteAVivre) * 1000) / 10;

  if (sharePercent <= 60) {
    return {
      tone: 'green',
      status: 'green',
      label: 'Réaliste',
      sharePercent,
    };
  }

  if (sharePercent <= 100) {
    return {
      tone: 'orange',
      status: 'orange',
      label: 'Soutenu',
      sharePercent,
    };
  }

  return {
    tone: 'red',
    status: 'red',
    label: 'Dépasse le reste à vivre',
    sharePercent,
  };
}
