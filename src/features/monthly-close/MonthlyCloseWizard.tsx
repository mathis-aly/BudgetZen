'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  Check,
  CheckCircle2,
  FileText,
  Landmark,
  PiggyBank,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  AccountSettingsDTO,
  MonthlyReportDTO,
  PriceEntryDTO,
  RecurringPaymentDTO,
  ReserveExpenseDTO,
  SurplusAllocationOption,
  TrackedProductDTO,
  TransactionDTO,
  UserSettingsDTO,
  WealthAssetDTO,
  calculateProductInflation,
  computeMonthlySummary,
  formatCurrency,
  formatDateShort,
  formatMonthLabel,
  formatMonthlyReportsCSV,
  formatPercent,
  roundCurrency,
} from '@/core';
import {
  Badge,
  Button,
  Card,
  ExportCsvButton,
  SectionHeader,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { closeMonthAction } from './actions';

const STEPS = [
  { id: 1, title: 'Réserve & Surplus', short: 'Réserve', icon: ShieldCheck },
  { id: 2, title: 'Patrimoine', short: 'Patrimoine', icon: Landmark },
  { id: 3, title: 'Panier Témoin', short: 'Panier', icon: ShoppingBasket },
  { id: 4, title: 'Bilan & Validation', short: 'Bilan', icon: CalendarCheck2 },
] as const;

const SURPLUS_OPTIONS: Array<{
  id: SurplusAllocationOption;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'KEEP_CHECKING',
    label: 'Conserver sur le compte courant',
    description: 'Renforce votre matelas liquide pour le mois prochain.',
    icon: Wallet,
  },
  {
    id: 'TRANSFER_SAVINGS',
    label: 'Transférer vers l’épargne de précaution',
    description: 'Ex. Livret A ou LDDS pour sécuriser vos liquidités.',
    icon: PiggyBank,
  },
  {
    id: 'INVEST_LONG_TERM',
    label: 'Investir sur vos supports long terme',
    description: 'Ex. PEA ETF Monde, CTO ou immobilier pour contrer l’inflation.',
    icon: TrendingUp,
  },
];

export function MonthlyCloseWizard({
  selectedMonthKey,
  accountSettings,
  userSettings,
  transactions,
  recurringPayments,
  reserveExpenses,
  wealthAssets,
  trackedProducts,
  monthlyReports,
  onClosed,
  onNotify,
}: {
  selectedMonthKey: string;
  accountSettings: AccountSettingsDTO;
  userSettings: UserSettingsDTO;
  transactions: TransactionDTO[];
  recurringPayments: RecurringPaymentDTO[];
  reserveExpenses: ReserveExpenseDTO[];
  wealthAssets: WealthAssetDTO[];
  trackedProducts: TrackedProductDTO[];
  monthlyReports: MonthlyReportDTO[];
  onClosed: (message: string) => Promise<void>;
  onNotify?: (message: string) => void;
}) {
  const currency = accountSettings.currency || 'EUR';

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [surplusChoice, setSurplusChoice] =
    useState<SurplusAllocationOption>('INVEST_LONG_TERM');
  const [assetDrafts, setAssetDrafts] = useState<Record<string, string>>({});
  const [priceDrafts, setPriceDrafts] = useState<
    Record<string, { priceStr: string; include: boolean }>
  >({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingReport = useMemo(
    () => monthlyReports.find((r) => r.month === selectedMonthKey) ?? null,
    [monthlyReports, selectedMonthKey]
  );

  // Initialize / sync drafts when month or source data changes
  useEffect(() => {
    const initialAssets: Record<string, string> = {};
    for (const asset of wealthAssets) {
      initialAssets[asset.id] = String(asset.currentValue);
    }
    setAssetDrafts(initialAssets);

    const initialPrices: Record<string, { priceStr: string; include: boolean }> = {};
    for (const prod of trackedProducts) {
      const stats = calculateProductInflation(prod.entries);
      initialPrices[prod.id] = {
        priceStr: stats.latestPrice > 0 ? String(stats.latestPrice) : '',
        include: false,
      };
    }
    setPriceDrafts(initialPrices);
    setNotes(existingReport?.notes ?? '');
    setError(null);
  }, [selectedMonthKey, wealthAssets, trackedProducts, existingReport]);

  // Projected assets list combining user's Step 2 inputs
  const projectedAssets = useMemo(() => {
    return wealthAssets.map((asset) => {
      const raw = assetDrafts[asset.id];
      const parsed = raw !== undefined ? Number(raw.replace(',', '.').trim()) : asset.currentValue;
      const validVal = Number.isFinite(parsed) && parsed >= 0 ? roundCurrency(parsed) : asset.currentValue;
      return {
        ...asset,
        newValue: validVal,
        delta: roundCurrency(validVal - asset.currentValue),
        deltaPercent:
          asset.currentValue > 0
            ? roundCurrency(((validVal - asset.currentValue) / asset.currentValue) * 100)
            : 0,
        changed: Math.abs(validVal - asset.currentValue) > 0.001,
      };
    });
  }, [wealthAssets, assetDrafts]);

  // Projected price entries combining existing entries + Step 3 included new prices
  const pendingPriceEntries = useMemo(() => {
    const list: Array<{ productId: string; price: number; store: string | null }> = [];
    for (const prod of trackedProducts) {
      const draft = priceDrafts[prod.id];
      if (!draft || !draft.include) continue;
      const parsed = Number(draft.priceStr.replace(',', '.').trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        const lastStore =
          prod.entries.length > 0
            ? prod.entries[prod.entries.length - 1].store
            : null;
        list.push({
          productId: prod.id,
          price: roundCurrency(parsed),
          store: lastStore,
        });
      }
    }
    return list;
  }, [trackedProducts, priceDrafts]);

  const allProjectedPriceEntries: PriceEntryDTO[] = useMemo(() => {
    const existing: PriceEntryDTO[] = trackedProducts.flatMap((p) => p.entries);
    const nowIso = new Date().toISOString();
    const added: PriceEntryDTO[] = pendingPriceEntries.map((p, idx) => ({
      id: `draft-${idx}`,
      productId: p.productId,
      price: p.price,
      store: p.store,
      recordedAt: nowIso,
    }));
    return [...existing, ...added];
  }, [trackedProducts, pendingPriceEntries]);

  // Live summary powered purely by src/core/closing.ts
  const summary = useMemo(
    () =>
      computeMonthlySummary(
        transactions,
        projectedAssets.map((a) => ({ id: a.id, currentValue: a.newValue })),
        allProjectedPriceEntries,
        {
          mandatoryReserveRate: userSettings.mandatoryReserveRate,
          manualInflationRate: userSettings.manualInflationRate,
          initialBalance: accountSettings.initialBalance,
        },
        {
          monthKey: selectedMonthKey,
          recurringPayments,
          reserveExpenses,
        }
      ),
    [
      transactions,
      projectedAssets,
      allProjectedPriceEntries,
      userSettings,
      accountSettings.initialBalance,
      selectedMonthKey,
      recurringPayments,
      reserveExpenses,
    ]
  );

  const previousAssetsTotal = useMemo(
    () => roundCurrency(wealthAssets.reduce((sum, a) => sum + a.currentValue, 0)),
    [wealthAssets]
  );
  const assetsTotalDelta = roundCurrency(summary.assetsTotal - previousAssetsTotal);
  const assetsTotalDeltaPct =
    previousAssetsTotal > 0
      ? roundCurrency((assetsTotalDelta / previousAssetsTotal) * 100)
      : 0;

  const modifiedAssets = useMemo(
    () => projectedAssets.filter((a) => a.changed),
    [projectedAssets]
  );

  const handleFinalize = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const allocationLabel =
        SURPLUS_OPTIONS.find((o) => o.id === surplusChoice)?.label ?? '';
      const compiledNotes =
        notes.trim() ||
        (summary.surplusAvailable > 0
          ? `Surplus (${formatCurrency(summary.surplusAvailable, currency)}) : ${allocationLabel}.`
          : null);

      const res = await closeMonthAction({
        month: selectedMonthKey,
        totalIncome: summary.totalIncome,
        totalExpenses: summary.totalExpenses,
        reserveAmount: summary.reserveAmount,
        netWorthEnd: summary.netWorthEnd,
        personalInflation: summary.personalInflation,
        notes: compiledNotes,
        assetUpdates: modifiedAssets.map((a) => ({
          assetId: a.id,
          newValue: a.newValue,
        })),
        priceEntries: pendingPriceEntries,
      });

      if (!res.ok) {
        throw new Error(res.error || 'Échec lors de la clôture du mois.');
      }

      await onClosed(
        `Mois de ${formatMonthLabel(selectedMonthKey)} clôturé (${
          res.updatedAssetsCount ?? 0
        } actif(s), ${res.createdPricesCount ?? 0} relevé(s) enregistrés)`
      );
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Clôture mensuelle · ${formatMonthLabel(selectedMonthKey)}`}
        subtitle="Faites votre bilan en 4 étapes rapides (< 5 min) et figez vos indicateurs clés"
        action={
          existingReport ? (
            <Badge tone="green">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Clôturé le {formatDateShort(existingReport.closedAt)}
            </Badge>
          ) : (
            <Badge tone="blue">Étape {step} / 4</Badge>
          )
        }
      />

      {/* WIZARD CARD */}
      <Card className="p-5 sm:p-6 space-y-6">
        {/* Progress Bar & Step Indicators */}
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isCurrent = step === s.id;
              const isDone = step > s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={cn(
                    'flex items-center justify-center sm:justify-start gap-2 px-2.5 py-2 rounded-2xl text-xs font-semibold transition-all border',
                    isCurrent
                      ? 'bg-[#007AFF]/10 dark:bg-[#0A84FF]/20 border-[#007AFF]/40 text-[#007AFF] dark:text-[#409CFF]'
                      : isDone
                        ? 'bg-[#34C759]/10 dark:bg-[#30D158]/15 border-[#34C759]/25 text-[#1E8E3E] dark:text-[#30D158]'
                        : 'bg-zinc-50 dark:bg-white/[0.04] border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  )}
                >
                  <span
                    className={cn(
                      'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                      isCurrent
                        ? 'bg-[#007AFF] text-white'
                        : isDone
                          ? 'bg-[#34C759] text-white'
                          : 'bg-zinc-200 dark:bg-white/[0.12] text-zinc-600 dark:text-zinc-300'
                    )}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : s.id}
                  </span>
                  <Icon className="h-3.5 w-3.5 hidden lg:block shrink-0" />
                  <span className="hidden sm:inline truncate">{s.short}</span>
                </button>
              );
            })}
          </div>

          <div className="h-1.5 w-full rounded-full bg-zinc-200/80 dark:bg-white/[0.1] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#007AFF] dark:bg-[#0A84FF] transition-all duration-300 ease-out"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* ============================================================== */}
        {/* STEP 1: RÉSERVE & SURPLUS                                      */}
        {/* ============================================================== */}
        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white">
                1. Réserve obligatoire & affectation du surplus
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Vérifiez votre reste à vivre final et décidez de la destination de votre
                excédent.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.04] p-3.5">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Revenus</p>
                <p className="text-lg font-bold tabular-nums text-[#34C759] dark:text-[#30D158] mt-0.5">
                  {formatCurrency(summary.totalIncome, currency, { showSign: true })}
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.04] p-3.5">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Dépenses</p>
                <p className="text-lg font-bold tabular-nums text-zinc-900 dark:text-white mt-0.5">
                  {formatCurrency(-summary.totalExpenses, currency)}
                </p>
              </div>
              <div className="rounded-2xl bg-[#34C759]/[0.08] dark:bg-[#30D158]/[0.12] p-3.5">
                <p className="text-[11px] text-[#1E8E3E] dark:text-[#30D158] font-medium">
                  Réserve ({formatPercent(summary.mandatoryReserveRate, 1)})
                </p>
                <p className="text-lg font-bold tabular-nums text-[#1E8E3E] dark:text-[#30D158] mt-0.5">
                  {formatCurrency(summary.reserveRemaining, currency)}
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {summary.reserveUsed > 0
                    ? `${formatCurrency(summary.reserveUsed, currency)} utilisés`
                    : 'Bouclier intact'}
                </p>
              </div>
              <div className="rounded-2xl bg-[#007AFF]/[0.08] dark:bg-[#0A84FF]/[0.14] p-3.5">
                <p className="text-[11px] text-[#0066D6] dark:text-[#409CFF] font-medium">
                  Reste à vivre final
                </p>
                <p
                  className={cn(
                    'text-lg font-bold tabular-nums mt-0.5',
                    summary.finalResteAVivre < 0
                      ? 'text-[#FF3B30]'
                      : 'text-[#0066D6] dark:text-[#409CFF]'
                  )}
                >
                  {formatCurrency(summary.finalResteAVivre, currency)}
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Taux d’épargne {formatPercent(summary.savingsRatePercent, 0)}
                </p>
              </div>
            </div>

            {/* Surplus Allocation Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  Que souhaitez-vous faire de votre surplus ({formatCurrency(summary.surplusAvailable, currency)}) ?
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {SURPLUS_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = surplusChoice === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSurplusChoice(opt.id)}
                      className={cn(
                        'p-3.5 rounded-2xl border text-left transition-all space-y-1.5',
                        selected
                          ? 'border-[#007AFF] bg-[#007AFF]/[0.07] dark:border-[#0A84FF] dark:bg-[#0A84FF]/[0.16]'
                          : 'border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#2C2C2E]/50 hover:border-black/15'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Icon
                          className={cn(
                            'h-4 w-4',
                            selected ? 'text-[#007AFF] dark:text-[#409CFF]' : 'text-zinc-400'
                          )}
                        />
                        {selected && (
                          <span className="h-4 w-4 rounded-full bg-[#007AFF] text-white flex items-center justify-center">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white">
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                        {opt.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 2: PATRIMOINE (ASSET END-OF-MONTH VALUES)                 */}
        {/* ============================================================== */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white">
                2. Actualisation du patrimoine
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Saisissez la valeur de fin de mois de chaque enveloppe : un snapshot
                historique sera créé automatiquement pour chaque support modifié.
              </p>
            </div>

            {projectedAssets.length === 0 ? (
              <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.04] p-6 text-center text-xs text-zinc-500">
                Aucun support patrimonial enregistré. Vous pouvez passer directement à
                l’étape suivante.
              </div>
            ) : (
              <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.07]">
                {/* Desktop table header */}
                <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2.5 bg-zinc-50 dark:bg-white/[0.04] text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  <div className="col-span-4">Enveloppe</div>
                  <div className="col-span-2 text-right">Ancienne valeur</div>
                  <div className="col-span-3 text-right">Valeur fin de mois (€)</div>
                  <div className="col-span-3 text-right">Écart en temps réel</div>
                </div>

                {projectedAssets.map((asset) => {
                  const isPos = asset.delta > 0;
                  const isNeg = asset.delta < 0;
                  return (
                    <div
                      key={asset.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3 items-center px-4 py-3.5 bg-white dark:bg-transparent"
                    >
                      <div className="sm:col-span-4 min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                          {asset.name}
                        </p>
                        <p className="text-[11px] text-zinc-400 tabular-nums">
                          Versement prévu : +{formatCurrency(asset.monthlyContribution, currency)}/m
                        </p>
                      </div>

                      <div className="sm:col-span-2 flex sm:block items-center justify-between sm:text-right">
                        <span className="text-[11px] text-zinc-400 sm:hidden">
                          Ancienne valeur
                        </span>
                        <span className="text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                          {formatCurrency(asset.currentValue, currency)}
                        </span>
                      </div>

                      <div className="sm:col-span-3 flex sm:justify-end">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={assetDrafts[asset.id] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.,]/g, '');
                            setAssetDrafts((prev) => ({ ...prev, [asset.id]: val }));
                          }}
                          aria-label={`Valeur de fin de mois pour ${asset.name}`}
                          className="w-full sm:w-36 h-10 px-3 text-right rounded-xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm font-bold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50"
                        />
                      </div>

                      <div className="sm:col-span-3 flex items-center justify-between sm:justify-end gap-1.5">
                        <span className="text-[11px] text-zinc-400 sm:hidden">Écart</span>
                        {asset.changed ? (
                          <Badge tone={isPos ? 'green' : isNeg ? 'red' : 'neutral'}>
                            {formatCurrency(asset.delta, currency, { showSign: true })} ·{' '}
                            {isPos ? '+' : ''}
                            {formatPercent(asset.deltaPercent, 1)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-zinc-400">Inchangé</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Footer Total Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-zinc-50 dark:bg-white/[0.04]">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    Total patrimoine placé ({modifiedAssets.length} modifié
                    {modifiedAssets.length > 1 ? 's' : ''})
                  </span>
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-bold tabular-nums text-zinc-900 dark:text-white">
                      {formatCurrency(summary.assetsTotal, currency)}
                    </span>
                    {Math.abs(assetsTotalDelta) > 0.001 && (
                      <Badge tone={assetsTotalDelta > 0 ? 'green' : 'red'}>
                        {formatCurrency(assetsTotalDelta, currency, { showSign: true })} (
                        {assetsTotalDelta > 0 ? '+' : ''}
                        {formatPercent(assetsTotalDeltaPct, 1)})
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 3: PANIER TÉMOIN (OPTIONAL PRICE UPDATES)                 */}
        {/* ============================================================== */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white">
                3. Mise à jour rapide du Panier Témoin
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Ajustez le prix des produits que vous avez achetés ce mois-ci (optionnel) :
                chaque ligne cochée enregistrera un nouveau relevé tarifaire.
              </p>
            </div>

            {trackedProducts.length === 0 ? (
              <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.04] p-6 text-center text-xs text-zinc-500">
                Aucun produit dans votre panier témoin. Vous pouvez passer directement au
                bilan.
              </div>
            ) : (
              <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.07]">
                {trackedProducts.map((product) => {
                  const stats = calculateProductInflation(product.entries);
                  const draft = priceDrafts[product.id] ?? {
                    priceStr: stats.latestPrice > 0 ? String(stats.latestPrice) : '',
                    include: false,
                  };
                  const parsed = Number(draft.priceStr.replace(',', '.').trim());
                  const diff =
                    Number.isFinite(parsed) && parsed > 0 && stats.latestPrice > 0
                      ? roundCurrency(parsed - stats.latestPrice)
                      : 0;

                  return (
                    <div
                      key={product.id}
                      className={cn(
                        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 transition-colors',
                        draft.include && 'bg-[#007AFF]/[0.03] dark:bg-[#0A84FF]/[0.06]'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={draft.include}
                          onChange={(e) =>
                            setPriceDrafts((prev) => ({
                              ...prev,
                              [product.id]: {
                                ...draft,
                                include: e.target.checked,
                              },
                            }))
                          }
                          aria-label={`Enregistrer un relevé pour ${product.name}`}
                          className="h-4 w-4 rounded accent-[#007AFF] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                            {product.name}{' '}
                            <span className="text-xs font-normal text-zinc-400">
                              · {product.unit}
                            </span>
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                            Dernier tarif connu :{' '}
                            {stats.latestPrice > 0
                              ? formatCurrency(stats.latestPrice, currency)
                              : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pl-7 sm:pl-0">
                        {Math.abs(diff) > 0.001 && (
                          <Badge tone={diff > 0 ? 'red' : 'green'}>
                            {formatCurrency(diff, currency, { showSign: true })}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Prix €"
                            value={draft.priceStr}
                            onChange={(e) => {
                              const nextVal = e.target.value.replace(/[^0-9.,]/g, '');
                              const nextNum = Number(nextVal.replace(',', '.'));
                              const autoInclude =
                                Number.isFinite(nextNum) &&
                                nextNum > 0 &&
                                Math.abs(nextNum - stats.latestPrice) > 0.001;
                              setPriceDrafts((prev) => ({
                                ...prev,
                                [product.id]: {
                                  priceStr: nextVal,
                                  include: autoInclude ? true : draft.include,
                                },
                              }));
                            }}
                            aria-label={`Nouveau prix constaté pour ${product.name}`}
                            className="w-28 h-9 px-3 text-right rounded-xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm font-bold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50"
                          />
                          <span className="text-xs font-semibold text-zinc-400">€</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {pendingPriceEntries.length} relevé(s) sélectionné(s) pour enregistrement à la
              validation finale.
            </p>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 4: BILAN & VALIDATION                                     */}
        {/* ============================================================== */}
        {step === 4 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white">
                4. Bilan & Validation finale
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Vérifiez votre récapitulatif : la validation enregistre en une seule
                transaction votre patrimoine, vos prix et le rapport mensuel.
              </p>
            </div>

            {/* Swiss Editorial Summary Card (zero gradient, sharp hairline border) */}
            <div className="rounded-md p-5 bg-[#FCFBF9] dark:bg-[#141413] border border-[#E2E0D8] dark:border-[#2A2A27] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#007AFF] dark:text-[#409CFF]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Bilan · {formatMonthLabel(selectedMonthKey)}
                  </span>
                </div>
                <Badge tone="blue">
                  Épargne : {formatPercent(summary.savingsRatePercent, 0)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Patrimoine net fin de mois
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-zinc-950 dark:text-white mt-0.5">
                    {formatCurrency(summary.netWorthEnd, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Revenus / Dépenses
                  </p>
                  <p className="text-sm font-bold tabular-nums text-[#34C759] dark:text-[#30D158] mt-1">
                    {formatCurrency(summary.totalIncome, currency, { showSign: true })}
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">
                    {formatCurrency(-summary.totalExpenses, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Réserve & Inflation perso
                  </p>
                  <p className="text-sm font-bold tabular-nums text-zinc-900 dark:text-white mt-1">
                    {formatCurrency(summary.reserveAmount, currency)} sécurisés
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-[#FF9500] dark:text-[#FF9F0A]">
                    Inflation : {summary.personalInflation > 0 ? '+' : ''}
                    {formatPercent(summary.personalInflation, 1)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] text-[11px]">
                <Badge tone="neutral">
                  {modifiedAssets.length} actif(s) patrimonial actualisé(s)
                </Badge>
                <Badge tone="neutral">
                  {pendingPriceEntries.length} relevé(s) panier ajouté(s)
                </Badge>
                <Badge tone="green">
                  {SURPLUS_OPTIONS.find((o) => o.id === surplusChoice)?.label}
                </Badge>
              </div>
            </div>

            {/* Optional Closing Notes */}
            <div>
              <label
                htmlFor="close-notes"
                className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Notes de clôture (optionnel)
              </label>
              <textarea
                id="close-notes"
                rows={2}
                placeholder="Ex : Mois maîtrisé, surplus transféré sur le PEA…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 resize-none"
              />
            </div>

            {error && <p className="text-xs font-semibold text-[#FF3B30]">{error}</p>}
          </div>
        )}

        {/* Stepper Navigation Footer */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-black/[0.05] dark:border-white/[0.08]">
          <Button
            type="button"
            variant="secondary"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4)}
          >
            <ArrowLeft className="h-4 w-4" />
            Précédent
          </Button>

          {step < 4 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4)}
            >
              Suivant
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="success"
              size="lg"
              loading={submitting}
              onClick={handleFinalize}
            >
              <CheckCircle2 className="h-4 w-4" />
              Valider et clôturer le mois
            </Button>
          )}
        </div>
      </Card>

      {/* ================================================================== */}
      {/* HISTORICAL COMPARATIVE MONTHLY REPORTS                             */}
      {/* ================================================================== */}
      <section className="space-y-3">
        <SectionHeader
          title={`Historique des bilans clôturés (${monthlyReports.length})`}
          subtitle="Comparez l'évolution de votre patrimoine net et de votre taux d'épargne mois après mois"
          action={
            <ExportCsvButton
              label="Exporter l'historique (CSV)"
              filenamePrefix="rapports_mensuels"
              disabled={monthlyReports.length === 0}
              getCsvContent={() => formatMonthlyReportsCSV(monthlyReports)}
              onExported={(file) =>
                onNotify?.(`Historique mensuel exporté (${file})`)
              }
            />
          }
        />

        {monthlyReports.length === 0 ? (
          <Card className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Aucun mois clôturé pour le moment. Finalisez l’assistant ci-dessus pour créer
            votre premier bilan mensuel.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {monthlyReports.map((report, index) => {
              const previousReport = monthlyReports[index + 1] ?? null;
              const netWorthDiff = previousReport
                ? roundCurrency(report.netWorthEnd - previousReport.netWorthEnd)
                : null;
              const netFlow = roundCurrency(report.totalIncome - report.totalExpenses);
              const savingsRate =
                report.totalIncome > 0
                  ? roundCurrency((netFlow / report.totalIncome) * 100)
                  : 0;

              return (
                <Card key={report.id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-semibold text-zinc-900 dark:text-white">
                        {formatMonthLabel(report.month)}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Clôturé le {formatDateShort(report.closedAt)}
                      </p>
                    </div>
                    <Badge tone={savingsRate >= 15 ? 'green' : savingsRate > 0 ? 'blue' : 'red'}>
                      Épargne {formatPercent(savingsRate, 0)}
                    </Badge>
                  </div>

                  <div className="flex items-baseline justify-between gap-2 pt-1">
                    <div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Patrimoine net
                      </p>
                      <p className="text-xl font-bold tabular-nums text-zinc-900 dark:text-white">
                        {formatCurrency(report.netWorthEnd, currency)}
                      </p>
                    </div>
                    {netWorthDiff !== null && (
                      <Badge tone={netWorthDiff >= 0 ? 'green' : 'red'}>
                        {formatCurrency(netWorthDiff, currency, { showSign: true })} vs mois préc.
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.07] text-xs tabular-nums">
                    <div>
                      <p className="text-[10px] text-zinc-400">Revenus</p>
                      <p className="font-semibold text-[#34C759] dark:text-[#30D158]">
                        {formatCurrency(report.totalIncome, currency, { compact: true })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400">Dépenses</p>
                      <p className="font-semibold text-zinc-900 dark:text-white">
                        {formatCurrency(report.totalExpenses, currency, { compact: true })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400">Inflation</p>
                      <p className="font-semibold text-[#FF9500] dark:text-[#FF9F0A]">
                        {report.personalInflation > 0 ? '+' : ''}
                        {formatPercent(report.personalInflation, 1)}
                      </p>
                    </div>
                  </div>

                  {report.notes && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 italic pt-1 border-t border-black/[0.04] dark:border-white/[0.06]">
                      « {report.notes} »
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
