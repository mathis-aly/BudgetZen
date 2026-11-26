import {
  CashErosionResult,
  WealthAssetDTO,
  WealthProjectionResult,
  WealthProjectionYearPoint,
} from './types';
import { roundCurrency } from './format';

/**
 * Projects cumulative wealth growth over `years` (1..30) with monthly compounding
 * and adjusts every year for annual inflation:
 *   Valeur réelle = Valeur nominale / (1 + inflationRate / 100)^t
 */
export function projectWealthGrowth(
  assets: Pick<
    WealthAssetDTO,
    'currentValue' | 'monthlyContribution' | 'expectedAnnualYield'
  >[],
  years: number,
  inflationRate: number,
  startYear: number = new Date().getFullYear()
): WealthProjectionResult {
  const safeYears = Math.max(1, Math.min(50, Math.round(years)));
  const safeInflation = Math.max(0, Number.isFinite(inflationRate) ? inflationRate : 0);
  const inflationFactorBase = 1 + safeInflation / 100;

  const initialCapital = roundCurrency(
    assets.reduce((sum, a) => sum + Math.max(0, a.currentValue), 0)
  );
  const totalMonthlyContribution = roundCurrency(
    assets.reduce((sum, a) => sum + Math.max(0, a.monthlyContribution), 0)
  );

  // Weighted average annual yield across current capital (or contributions if capital is 0)
  let weightedAnnualYield = 0;
  if (initialCapital > 0) {
    weightedAnnualYield = roundCurrency(
      assets.reduce(
        (sum, a) => sum + Math.max(0, a.currentValue) * a.expectedAnnualYield,
        0
      ) / initialCapital
    );
  } else if (totalMonthlyContribution > 0) {
    weightedAnnualYield = roundCurrency(
      assets.reduce(
        (sum, a) => sum + Math.max(0, a.monthlyContribution) * a.expectedAnnualYield,
        0
      ) / totalMonthlyContribution
    );
  }

  // Track each asset's running compounded balance independently
  const runningBalances = assets.map((a) => Math.max(0, a.currentValue));
  let cumulativeContributed = initialCapital;

  const timeline: WealthProjectionYearPoint[] = [
    {
      year: 0,
      calendarYear: startYear,
      nominalValue: initialCapital,
      realValue: initialCapital,
      totalContributed: initialCapital,
      compoundInterest: 0,
      inflationLoss: 0,
    },
  ];

  for (let year = 1; year <= safeYears; year++) {
    for (let month = 0; month < 12; month++) {
      for (let i = 0; i < assets.length; i++) {
        const monthlyRate = assets[i].expectedAnnualYield / 100 / 12;
        const contribution = Math.max(0, assets[i].monthlyContribution);
        runningBalances[i] = runningBalances[i] * (1 + monthlyRate) + contribution;
      }
    }

    cumulativeContributed += totalMonthlyContribution * 12;

    const nominalValue = roundCurrency(
      runningBalances.reduce((sum, val) => sum + val, 0)
    );
    const totalContributed = roundCurrency(cumulativeContributed);
    const compoundInterest = roundCurrency(Math.max(0, nominalValue - totalContributed));
    const realValue = roundCurrency(
      nominalValue / Math.pow(inflationFactorBase, year)
    );
    const inflationLoss = roundCurrency(Math.max(0, nominalValue - realValue));

    timeline.push({
      year,
      calendarYear: startYear + year,
      nominalValue,
      realValue,
      totalContributed,
      compoundInterest,
      inflationLoss,
    });
  }

  const last = timeline[timeline.length - 1];

  return {
    years: safeYears,
    inflationRate: safeInflation,
    initialCapital,
    totalMonthlyContribution,
    weightedAnnualYield,
    finalNominalValue: last.nominalValue,
    finalRealValue: last.realValue,
    totalContributed: last.totalContributed,
    totalInterestGenerated: last.compoundInterest,
    totalInflationLoss: last.inflationLoss,
    timeline,
  };
}

/**
 * Calculates annual purchasing power erosion on dormant checking account liquidity.
 */
export function calculateCashErosion(
  idleCashAmount: number,
  inflationRate: number
): CashErosionResult {
  const safeCash = Math.max(0, Number.isFinite(idleCashAmount) ? idleCashAmount : 0);
  const safeRate = Math.max(0, Number.isFinite(inflationRate) ? inflationRate : 0);

  if (safeCash === 0 || safeRate === 0) {
    return {
      idleCashAmount: roundCurrency(safeCash),
      inflationRate: safeRate,
      annualLoss: 0,
      monthlyLoss: 0,
      realValueAfterOneYear: roundCurrency(safeCash),
      fiveYearLoss: 0,
    };
  }

  const factor = 1 + safeRate / 100;
  const realValueAfterOneYear = roundCurrency(safeCash / factor);
  const annualLoss = roundCurrency(safeCash - realValueAfterOneYear);
  const monthlyLoss = roundCurrency(annualLoss / 12);
  const fiveYearRealValue = roundCurrency(safeCash / Math.pow(factor, 5));
  const fiveYearLoss = roundCurrency(safeCash - fiveYearRealValue);

  return {
    idleCashAmount: roundCurrency(safeCash),
    inflationRate: safeRate,
    annualLoss,
    monthlyLoss,
    realValueAfterOneYear,
    fiveYearLoss,
  };
}
