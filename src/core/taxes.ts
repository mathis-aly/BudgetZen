import {
  CapitalTax2026Result,
  DeclarationGuideLine,
  GlobalTaxSummary,
  IncomeTax2026Result,
  TaxBracketBreakdown,
  TaxDeductionMode,
  TaxEntryDTO,
  TaxProfileDTO,
} from './types';
import { roundCurrency } from './format';

/**
 * French 2026 progressive income tax brackets (per fiscal part).
 */
export const TAX_BRACKETS_2026: Array<{
  min: number;
  max: number | null;
  rate: number;
}> = [
  { min: 0, max: 11600, rate: 0 },
  { min: 11600, max: 29579, rate: 11 },
  { min: 29579, max: 84577, rate: 30 },
  { min: 84577, max: 181917, rate: 41 },
  { min: 181917, max: null, rate: 45 },
];

// 2026 French décote constants (45.25% rate)
const DECOTE_SINGLE_THRESHOLD = 897;
const DECOTE_COUPLE_THRESHOLD = 1483;
const DECOTE_RATE = 0.4525;

// 2026 10% standard salary deduction bounds
const STANDARD_DEDUCTION_RATE = 0.1;
const STANDARD_DEDUCTION_MIN = 504;
const STANDARD_DEDUCTION_MAX = 14426;

// 2026 Flat Tax (PFU) rates
export const PFU_IR_RATE_2026 = 12.8;
export const PFU_SOCIAL_RATE_2026 = 18.6;
export const PFU_TOTAL_RATE_2026 = 31.4;

/**
 * Computes the deductible allowance for salaries/income under 10% standard deduction
 * or user-declared actual expenses (frais réels).
 */
export function computeIncomeDeduction(
  grossIncome: number,
  deductionMode: TaxDeductionMode,
  actualFeesAmount: number = 0
): number {
  const safeGross = Math.max(0, Number.isFinite(grossIncome) ? grossIncome : 0);
  if (safeGross === 0) return 0;

  if (deductionMode === 'ACTUAL_FEES') {
    return roundCurrency(Math.min(safeGross, Math.max(0, actualFeesAmount)));
  }

  const tenPercent = roundCurrency(safeGross * STANDARD_DEDUCTION_RATE);
  if (safeGross < STANDARD_DEDUCTION_MIN) {
    return safeGross;
  }
  return roundCurrency(
    Math.min(STANDARD_DEDUCTION_MAX, Math.max(STANDARD_DEDUCTION_MIN, tenPercent))
  );
}

/**
 * Computes French 2026 progressive income tax including:
 * - Quotient familial (netTaxableIncome / fiscalParts)
 * - 5 progressive brackets (0%, 11%, 30%, 41%, 45%)
 * - Décote for single (< 2 parts) or couple (>= 2 parts)
 * - TMI (Taux Marginal d'Imposition) & effective average tax rate
 */
export function calculateIncomeTax2026(
  netTaxableIncome: number,
  fiscalParts: number,
  options?: { isCouple?: boolean }
): IncomeTax2026Result {
  const safeIncome = Math.max(0, Number.isFinite(netTaxableIncome) ? netTaxableIncome : 0);
  const safeParts = Math.max(1, Number.isFinite(fiscalParts) ? fiscalParts : 1);
  const quotientFamilial = roundCurrency(safeIncome / safeParts);

  let taxPerPart = 0;
  let tmi = 0;
  const brackets: TaxBracketBreakdown[] = [];

  for (const bracket of TAX_BRACKETS_2026) {
    const upperBound = bracket.max ?? Infinity;
    let slice = 0;
    if (quotientFamilial > bracket.min) {
      slice = Math.min(quotientFamilial, upperBound) - bracket.min;
      if (slice > 0) {
        tmi = bracket.rate;
      }
    }

    const sliceTaxPerPart = slice * (bracket.rate / 100);
    taxPerPart += sliceTaxPerPart;

    brackets.push({
      min: bracket.min,
      max: bracket.max,
      rate: bracket.rate,
      taxableSlicePerPart: roundCurrency(slice),
      taxPerPart: roundCurrency(sliceTaxPerPart),
      totalTaxForBracket: roundCurrency(sliceTaxPerPart * safeParts),
    });
  }

  const grossTax = roundCurrency(taxPerPart * safeParts);

  // Apply French décote (single vs couple)
  const isCouple = options?.isCouple ?? safeParts >= 2;
  const decoteThreshold = isCouple ? DECOTE_COUPLE_THRESHOLD : DECOTE_SINGLE_THRESHOLD;
  let decote = 0;
  if (grossTax > 0) {
    const rawDecote = decoteThreshold - grossTax * DECOTE_RATE;
    if (rawDecote > 0) {
      decote = roundCurrency(Math.min(grossTax, rawDecote));
    }
  }

  const netTax = roundCurrency(Math.max(0, grossTax - decote));
  const effectiveRate =
    safeIncome > 0 ? roundCurrency((netTax / safeIncome) * 100) : 0;

  return {
    netTaxableIncome: roundCurrency(safeIncome),
    fiscalParts: safeParts,
    quotientFamilial,
    grossTax,
    decote,
    netTax,
    tmi,
    effectiveRate,
    brackets,
  };
}

/**
 * Computes 2026 Capital Gains & Dividends taxation:
 * - PFU (Flat Tax) at 31.4% (12.8% IR + 18.6% prélèvements sociaux)
 * - Progressive scale comparison (Option case 2OP) using user's TMI
 */
export function calculateCapitalTax2026(
  capitalGains: number,
  tmi: number
): CapitalTax2026Result {
  const safeGains = Math.max(0, Number.isFinite(capitalGains) ? capitalGains : 0);
  const safeTmi = Math.max(0, Number.isFinite(tmi) ? tmi : 0);

  const pfuIrPart = roundCurrency(safeGains * (PFU_IR_RATE_2026 / 100));
  const socialContributions = roundCurrency(
    safeGains * (PFU_SOCIAL_RATE_2026 / 100)
  );
  const pfuTotal = roundCurrency(safeGains * (PFU_TOTAL_RATE_2026 / 100));

  const progressiveIrPart = roundCurrency(safeGains * (safeTmi / 100));
  const progressiveTotal = roundCurrency(progressiveIrPart + socialContributions);

  const isOption2OPAdvantageous = safeGains > 0 && progressiveTotal < pfuTotal;
  const savingsWith2OP = isOption2OPAdvantageous
    ? roundCurrency(pfuTotal - progressiveTotal)
    : 0;
  const recommendedMode = isOption2OPAdvantageous ? 'OPTION_2OP' : 'PFU';
  const effectiveOptimalTax = isOption2OPAdvantageous ? progressiveTotal : pfuTotal;

  const recommendationText =
    safeGains === 0
      ? 'Aucun revenu de capitaux mobiliers saisi pour cette année.'
      : isOption2OPAdvantageous
        ? `Votre TMI (${safeTmi} %) est inférieur à 12,8 % : cocher la case 2OP vous fait économiser ${savingsWith2OP.toFixed(
            2
          ).replace('.', ',')} € par rapport au PFU.`
        : `Votre TMI (${safeTmi} %) dépasse 12,8 % : le PFU (Flat Tax à 31,4 %) est plus avantageux que le barème progressif (ne pas cocher la case 2OP).`;

  return {
    capitalGains: roundCurrency(safeGains),
    tmi: safeTmi,
    pfuIrPart,
    socialContributions,
    pfuTotal,
    progressiveIrPart,
    progressiveTotal,
    isOption2OPAdvantageous,
    recommendedMode,
    savingsWith2OP,
    effectiveOptimalTax,
    recommendationText,
  };
}

/**
 * Computes the complete fiscal dashboard summary & line-by-line declaration guide.
 */
export function computeGlobalTaxSummary(params: {
  profile: TaxProfileDTO;
  entries: TaxEntryDTO[];
  year?: number;
}): GlobalTaxSummary {
  const year = params.year ?? new Date().getFullYear();
  const yearEntries = params.entries.filter((e) => e.year === year);

  const grossIncomeBase = roundCurrency(
    yearEntries
      .filter((e) => e.category === 'INCOME')
      .reduce((sum, e) => sum + Math.max(0, e.taxableBase), 0)
  );

  const deductionAmount = computeIncomeDeduction(
    grossIncomeBase,
    params.profile.deductionMode,
    params.profile.actualFeesAmount
  );

  const netTaxableIncome = roundCurrency(Math.max(0, grossIncomeBase - deductionAmount));
  const incomeTax = calculateIncomeTax2026(netTaxableIncome, params.profile.fiscalParts);

  const capitalBase = roundCurrency(
    yearEntries
      .filter((e) => e.category === 'CAPITAL')
      .reduce((sum, e) => sum + Math.max(0, e.taxableBase), 0)
  );
  const capitalTax = calculateCapitalTax2026(capitalBase, incomeTax.tmi);

  const localTaxTotal = roundCurrency(
    yearEntries
      .filter((e) => e.category === 'LOCAL')
      .reduce((sum, e) => sum + Math.max(0, e.computedTax), 0)
  );

  const otherTaxTotal = roundCurrency(
    yearEntries
      .filter((e) => e.category === 'OTHER')
      .reduce((sum, e) => sum + Math.max(0, e.computedTax), 0)
  );

  const totalEstimatedTax = roundCurrency(
    incomeTax.netTax + capitalTax.effectiveOptimalTax + localTaxTotal + otherTaxTotal
  );

  const totalBase = roundCurrency(grossIncomeBase + capitalBase);
  const globalTaxPressureRate =
    totalBase > 0 ? roundCurrency((totalEstimatedTax / totalBase) * 100) : 0;

  const withheldTaxPaid = roundCurrency(Math.max(0, params.profile.withheldTaxPaid));
  const balanceDue = roundCurrency(totalEstimatedTax - withheldTaxPaid);

  const declarationLines: DeclarationGuideLine[] = [
    {
      id: 'line-parts',
      boxCode: 'Foyer',
      label: 'Nombre de parts fiscales',
      amount: null,
      valueText: `${params.profile.fiscalParts} part${params.profile.fiscalParts > 1 ? 's' : ''}`,
      section: 'REVENUS',
      hint: `Quotient familial calculé : ${incomeTax.quotientFamilial.toFixed(0)} € / part (TMI ${incomeTax.tmi} %).`,
    },
    {
      id: 'line-1aj',
      boxCode: '1AJ',
      label: 'Traitements, salaires et revenus déclarés',
      amount: grossIncomeBase,
      section: 'REVENUS',
      hint: 'Cumul des revenus nets imposables annuels avant abattement.',
    },
    {
      id: 'line-deduction',
      boxCode: params.profile.deductionMode === 'ACTUAL_FEES' ? '1AK' : 'Auto 10%',
      label:
        params.profile.deductionMode === 'ACTUAL_FEES'
          ? 'Frais réels déductibles'
          : 'Abattement forfaitaire 10 % (automatique)',
      amount: deductionAmount,
      section: 'DEDUCTIONS',
      hint:
        params.profile.deductionMode === 'ACTUAL_FEES'
          ? 'À reporter en case 1AK avec justificatifs conservés 3 ans.'
          : 'Appliqué automatiquement par l’administration si 1AK reste vide.',
    },
    {
      id: 'line-rni',
      boxCode: 'RNI',
      label: 'Revenu net imposable retenu',
      amount: netTaxableIncome,
      section: 'DEDUCTIONS',
      hint:
        incomeTax.decote > 0
          ? `Décote appliquée : −${incomeTax.decote.toFixed(2).replace('.', ',')} €.`
          : 'Base soumise au barème progressif 2026.',
      highlight: true,
    },
    {
      id: 'line-capital',
      boxCode: '2DC / 2TR / 3VG',
      label: 'Revenus de capitaux mobiliers & plus-values',
      amount: capitalBase,
      section: 'CAPITAL',
      hint: 'À reporter depuis vos IFU bancaires / courtiers.',
    },
    {
      id: 'line-2op',
      boxCode: '2OP',
      label: 'Option d’imposition au barème progressif',
      amount: null,
      valueText: capitalTax.isOption2OPAdvantageous ? 'À COCHER' : 'Ne pas cocher (PFU)',
      section: 'CAPITAL',
      hint: capitalTax.recommendationText,
      highlight: capitalTax.isOption2OPAdvantageous,
    },
    {
      id: 'line-8hv',
      boxCode: '8HV',
      label: 'Prélèvement à la source déjà payé',
      amount: withheldTaxPaid,
      section: 'SOLDE',
      hint: 'Pré-rempli sur votre déclaration ; vérifiez la cohérence avec vos fiches de paie.',
    },
    {
      id: 'line-local',
      boxCode: 'Avis local',
      label: 'Impôts locaux (Taxe foncière / habitation)',
      amount: localTaxTotal,
      section: 'LOCAL',
      hint: 'Avis distinct à l’automne, inclus ici dans votre pression fiscale globale.',
    },
  ];

  return {
    year,
    grossIncomeBase,
    deductionAmount,
    netTaxableIncome,
    incomeTax,
    capitalBase,
    capitalTax,
    localTaxTotal,
    otherTaxTotal,
    totalEstimatedTax,
    withheldTaxPaid,
    balanceDue,
    globalTaxPressureRate,
    declarationLines,
  };
}
