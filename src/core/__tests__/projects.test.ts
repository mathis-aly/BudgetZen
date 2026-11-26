import { describe, expect, it } from 'vitest';
import { computeProjectMetrics, evaluateProjectEffort } from '../projects';

describe('Financial projects pure engine', () => {
  it('computes cash purchase with depreciation and extra fees cleanly', () => {
    const metrics = computeProjectMetrics(
      {
        currentPrice: 20000,
        extraFeesPercent: 5,
        annualPriceGrowthPercent: -10,
        targetMonths: 24,
        savedAmount: 5000,
        useLoan: false,
        downPaymentPercent: 100,
        loanInterestRate: 0,
        loanDurationYears: 5,
      },
      3000
    );

    // 20000 * 0.9^2 = 16200; +5% = 17010
    expect(metrics.projectedPrice).toBe(16200);
    expect(metrics.priceGrowthDelta).toBe(-3800);
    expect(metrics.totalProjectCost).toBe(17010);
    expect(metrics.extraFeesAmount).toBe(810);
    expect(metrics.requiredSavingsTarget).toBe(17010);
    expect(metrics.remainingSavingsNeeded).toBe(12010);
    // (5000 / 17010) * 100 = 29.4%
    expect(metrics.progressPercent).toBe(29.4);
    // 12010 / 24 = 500.42
    expect(metrics.requiredMonthlySavings).toBe(500.42);
    expect(metrics.loanPrincipal).toBe(0);
    expect(metrics.monthlyLoanPayment).toBe(0);
    expect(metrics.totalLoanInterestCost).toBe(0);
    expect(metrics.debtToIncomeRatio).toBe(0);
    expect(metrics.isHighDebtRisk).toBe(false);
  });

  it('computes real-estate loan amortization, interest cost, and >35% debt risk alert', () => {
    const metrics = computeProjectMetrics(
      {
        currentPrice: 250000,
        extraFeesPercent: 8,
        annualPriceGrowthPercent: 2,
        targetMonths: 24,
        savedAmount: 20000,
        useLoan: true,
        downPaymentPercent: 20,
        loanInterestRate: 3.6,
        loanDurationYears: 20,
      },
      2800
    );

    // 250000 * 1.02^2 = 260100; * 1.08 = 280908
    expect(metrics.projectedPrice).toBe(260100);
    expect(metrics.totalProjectCost).toBe(280908);
    expect(metrics.requiredSavingsTarget).toBe(56181.6);
    expect(metrics.loanPrincipal).toBe(224726.4);
    expect(metrics.monthlyLoanPayment).toBeCloseTo(1314.9, 1);
    expect(metrics.totalLoanInterestCost).toBeGreaterThan(90000);
    expect(metrics.debtToIncomeRatio).toBeGreaterThan(35);
    expect(metrics.isHighDebtRisk).toBe(true);
  });

  it('handles 0% interest loans and fully funded savings cleanly', () => {
    const metrics = computeProjectMetrics(
      {
        currentPrice: 12000,
        extraFeesPercent: 0,
        annualPriceGrowthPercent: 0,
        targetMonths: 12,
        savedAmount: 3000,
        useLoan: true,
        downPaymentPercent: 20,
        loanInterestRate: 0,
        loanDurationYears: 2,
      },
      4000
    );

    // Total = 12000; 20% down = 2400; saved = 3000 (>= 2400) -> effort 0
    expect(metrics.requiredMonthlySavings).toBe(0);
    expect(metrics.loanPrincipal).toBe(9600);
    expect(metrics.monthlyLoanPayment).toBe(400);
    expect(metrics.totalLoanInterestCost).toBe(0);
    expect(metrics.debtToIncomeRatio).toBe(10);
    expect(metrics.isHighDebtRisk).toBe(false);
  });

  it('evaluates required monthly savings against Reste à vivre', () => {
    expect(evaluateProjectEffort(0, 800).tone).toBe('green');
    expect(evaluateProjectEffort(300, 1000).tone).toBe('green');
    expect(evaluateProjectEffort(800, 1000).tone).toBe('orange');
    expect(evaluateProjectEffort(1200, 1000).tone).toBe('red');
    expect(evaluateProjectEffort(200, -50).tone).toBe('red');
  });
});
