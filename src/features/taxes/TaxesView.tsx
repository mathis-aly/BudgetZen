'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building,
  Check,
  CheckCircle2,
  ClipboardList,
  Landmark,
  Pencil,
  Plus,
  Scale,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  RecurringPaymentDTO,
  TaxDeductionMode,
  TaxEntryDTO,
  TaxProfileDTO,
  computeGlobalTaxSummary,
  formatCurrency,
  formatPercent,
  getMonthlyFixedIncome,
} from '@/core';
import { Badge, Button, Card, RollingNumber, SectionHeader } from '@/components/ui';
import { cn } from '@/lib/cn';
import { TaxEntryModal } from './TaxEntryModal';

export function TaxesView({
  taxProfile,
  taxEntries,
  recurringPayments = [],
  currency = 'EUR',
  onChanged,
}: {
  taxProfile: TaxProfileDTO;
  taxEntries: TaxEntryDTO[];
  recurringPayments?: RecurringPaymentDTO[];
  currency?: string;
  onChanged: (message: string) => Promise<void>;
}) {
  const currentYear = new Date().getFullYear();
  const [subTab, setSubTab] = useState<'overview' | 'guide'>('overview');

  // Editable tax profile state
  const [fiscalParts, setFiscalParts] = useState(taxProfile.fiscalParts);
  const [deductionMode, setDeductionMode] = useState<TaxDeductionMode>(
    taxProfile.deductionMode
  );
  const [actualFeesStr, setActualFeesStr] = useState(
    String(taxProfile.actualFeesAmount)
  );
  const [withheldStr, setWithheldStr] = useState(String(taxProfile.withheldTaxPaid));
  const [savingProfile, setSavingProfile] = useState(false);

  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TaxEntryDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setFiscalParts(taxProfile.fiscalParts);
    setDeductionMode(taxProfile.deductionMode);
    setActualFeesStr(String(taxProfile.actualFeesAmount));
    setWithheldStr(String(taxProfile.withheldTaxPaid));
  }, [taxProfile]);

  const liveProfile: TaxProfileDTO = useMemo(
    () => ({
      ...taxProfile,
      fiscalParts,
      deductionMode,
      actualFeesAmount: Math.max(0, Number(actualFeesStr.replace(',', '.')) || 0),
      withheldTaxPaid: Math.max(0, Number(withheldStr.replace(',', '.')) || 0),
    }),
    [taxProfile, fiscalParts, deductionMode, actualFeesStr, withheldStr]
  );

  const profileDirty =
    Math.abs(liveProfile.fiscalParts - taxProfile.fiscalParts) > 0.01 ||
    liveProfile.deductionMode !== taxProfile.deductionMode ||
    Math.abs(liveProfile.actualFeesAmount - taxProfile.actualFeesAmount) > 0.01 ||
    Math.abs(liveProfile.withheldTaxPaid - taxProfile.withheldTaxPaid) > 0.01;

  const monthlyTaxableFixed = useMemo(
    () => getMonthlyFixedIncome(recurringPayments, { taxableOnly: true }),
    [recurringPayments]
  );
  const estimatedAnnualTaxableIncome = useMemo(
    () => Math.round(monthlyTaxableFixed * 12 * 100) / 100,
    [monthlyTaxableFixed]
  );

  const taxSummary = useMemo(
    () =>
      computeGlobalTaxSummary({
        profile: liveProfile,
        entries: taxEntries,
        year: currentYear,
        estimatedAnnualTaxableIncome,
      }),
    [liveProfile, taxEntries, currentYear, estimatedAnnualTaxableIncome]
  );

  const yearEntries = useMemo(
    () => taxEntries.filter((e) => e.year === currentYear),
    [taxEntries, currentYear]
  );
  const incomeEntries = yearEntries.filter((e) => e.category === 'INCOME');
  const capitalEntries = yearEntries.filter((e) => e.category === 'CAPITAL');
  const localAndOtherEntries = yearEntries.filter(
    (e) => e.category === 'LOCAL' || e.category === 'OTHER'
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch('/api/taxes/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fiscalParts: liveProfile.fiscalParts,
          deductionMode: liveProfile.deductionMode,
          actualFeesAmount: liveProfile.actualFeesAmount,
          withheldTaxPaid: liveProfile.withheldTaxPaid,
        }),
      });
      if (!res.ok) throw new Error();
      await onChanged('Profil fiscal mis à jour');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteEntry = async (entry: TaxEntryDTO) => {
    setDeletingId(entry.id);
    try {
      const res = await fetch(`/api/taxes/entries/${entry.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      await onChanged(`Poste « ${entry.label} » supprimé`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Fiscalité & Déclaration ${currentYear}`}
        subtitle="Barème progressif français 2026, PFU 31,4 % vs option 2OP et simulateur de solde"
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditingEntry(null);
              setEntryModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Ajouter un poste
          </Button>
        }
      />

      {/* Sub-navigation Segmented Control */}
      <div className="inline-flex p-1 rounded-2xl bg-black/[0.05] dark:bg-white/[0.08]">
        <button
          type="button"
          onClick={() => setSubTab('overview')}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all',
            subTab === 'overview'
              ? 'bg-white dark:bg-[#2C2C2E] text-zinc-950 dark:text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400'
          )}
        >
          <Scale className="h-3.5 w-3.5" />
          Tableau de bord fiscal
        </button>
        <button
          type="button"
          onClick={() => setSubTab('guide')}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all',
            subTab === 'guide'
              ? 'bg-white dark:bg-[#2C2C2E] text-zinc-950 dark:text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400'
          )}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Aide à la déclaration
        </button>
      </div>

      {/* HERO SYNTHESIS CARD */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <p className="editorial-kicker">
              Total des impôts estimés · Exercice {currentYear}
            </p>

            <div className="flex items-baseline gap-3 mt-2 flex-wrap">
              <p className="font-serif text-4xl sm:text-5xl font-normal tracking-tight text-[#141413] dark:text-[#F2F0E8]">
                <RollingNumber value={taxSummary.totalEstimatedTax} currency={currency} />
              </p>
              <Badge tone="blue">
                Pression fiscale : {formatPercent(taxSummary.globalTaxPressureRate, 1)}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              <span>
                TMI :{' '}
                <strong className="text-zinc-900 dark:text-white">
                  {taxSummary.incomeTax.tmi} %
                </strong>
              </span>
              <span>·</span>
              <span>
                Taux moyen IR :{' '}
                <strong className="text-zinc-900 dark:text-white">
                  {formatPercent(taxSummary.incomeTax.effectiveRate, 1)}
                </strong>
              </span>
              {taxSummary.incomeTax.decote > 0 && (
                <>
                  <span>·</span>
                  <span className="text-[#34C759] dark:text-[#30D158] font-semibold">
                    Décote : −{formatCurrency(taxSummary.incomeTax.decote, currency)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Solde à régulariser Box */}
          <div
            className={cn(
              'rounded-2xl p-4 sm:min-w-[260px] border space-y-1',
              taxSummary.balanceDue > 0
                ? 'bg-[#FF9500]/[0.08] border-[#FF9500]/25 dark:bg-[#FF9F0A]/[0.12] dark:border-[#FF9F0A]/30'
                : 'bg-[#34C759]/[0.08] border-[#34C759]/25 dark:bg-[#30D158]/[0.12] dark:border-[#30D158]/30'
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {taxSummary.balanceDue >= 0
                ? 'Solde estimé à payer'
                : 'Remboursement estimé'}
            </p>
            <p
              className={cn(
                'text-2xl font-bold tabular-nums',
                taxSummary.balanceDue > 0
                  ? 'text-[#C26900] dark:text-[#FF9F0A]'
                  : 'text-[#1E8E3E] dark:text-[#30D158]'
              )}
            >
              {formatCurrency(Math.abs(taxSummary.balanceDue), currency)}
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
              Déjà payé (PAS) : {formatCurrency(taxSummary.withheldTaxPaid, currency)}
            </p>
          </div>
        </div>

        {/* Interactive Tax Profile Bar */}
        <form
          onSubmit={handleSaveProfile}
          className="mt-5 pt-4 border-t border-black/[0.05] dark:border-white/[0.08] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label
              htmlFor="tax-parts"
              className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1"
            >
              Parts fiscales
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="tax-parts"
                type="number"
                min={1}
                max={12}
                step={0.5}
                value={fiscalParts}
                onChange={(e) =>
                  setFiscalParts(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-20 h-10 px-3 rounded-xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm font-bold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
              />
              <div className="flex gap-1">
                {[1, 2, 2.5].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFiscalParts(p)}
                    className={cn(
                      'px-2 py-1 rounded-lg text-[11px] font-semibold tabular-nums',
                      Math.abs(fiscalParts - p) < 0.01
                        ? 'bg-[#007AFF] text-white'
                        : 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-300'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
              Mode de déduction
            </label>
            <div className="grid grid-cols-2 p-0.5 rounded-xl bg-zinc-100 dark:bg-[#2C2C2E] h-10">
              <button
                type="button"
                onClick={() => setDeductionMode('STANDARD_10')}
                className={cn(
                  'rounded-lg text-[11px] font-semibold transition-all',
                  deductionMode === 'STANDARD_10'
                    ? 'bg-white dark:bg-[#3A3A3C] text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400'
                )}
              >
                Abatt. 10 %
              </button>
              <button
                type="button"
                onClick={() => setDeductionMode('ACTUAL_FEES')}
                className={cn(
                  'rounded-lg text-[11px] font-semibold transition-all',
                  deductionMode === 'ACTUAL_FEES'
                    ? 'bg-white dark:bg-[#3A3A3C] text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400'
                )}
              >
                Frais réels
              </button>
            </div>
          </div>

          {deductionMode === 'ACTUAL_FEES' ? (
            <div>
              <label
                htmlFor="tax-fees"
                className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1"
              >
                Montant frais réels (€)
              </label>
              <input
                id="tax-fees"
                type="text"
                inputMode="decimal"
                value={actualFeesStr}
                onChange={(e) =>
                  setActualFeesStr(e.target.value.replace(/[^0-9.,]/g, ''))
                }
                className="w-full h-10 px-3 rounded-xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm font-bold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="tax-pas"
                className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1"
              >
                Prélèvement à la source payé (€)
              </label>
              <input
                id="tax-pas"
                type="text"
                inputMode="decimal"
                value={withheldStr}
                onChange={(e) =>
                  setWithheldStr(e.target.value.replace(/[^0-9.,]/g, ''))
                }
                className="w-full h-10 px-3 rounded-xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm font-bold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            {deductionMode === 'ACTUAL_FEES' && (
              <input
                type="text"
                inputMode="decimal"
                aria-label="Prélèvement à la source payé"
                placeholder="PAS €"
                value={withheldStr}
                onChange={(e) =>
                  setWithheldStr(e.target.value.replace(/[^0-9.,]/g, ''))
                }
                className="w-24 h-10 px-2.5 rounded-xl bg-zinc-100 dark:bg-[#2C2C2E] text-xs font-bold tabular-nums text-zinc-900 dark:text-white focus:outline-none"
              />
            )}
            <Button
              type="submit"
              size="sm"
              loading={savingProfile}
              disabled={!profileDirty}
              className="h-10 flex-1"
            >
              <Check className="h-3.5 w-3.5" />
              Sauvegarder profil
            </Button>
          </div>
        </form>
      </Card>

      {/* ================================================================== */}
      {/* TAB 1: TABLEAU DE BORD FISCAL (3 CATEGORIES)                       */}
      {/* ================================================================== */}
      {subTab === 'overview' && (
        <div className="space-y-5">
          {/* 3-Category Breakdown Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Category 1: Income Tax (Barème 2026) */}
            <Card className="p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-2xl bg-[#007AFF]/12 text-[#007AFF] flex items-center justify-center">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Impôt sur le revenu
                    </h3>
                    <p className="text-[11px] text-zinc-400">Barème progressif 2026</p>
                  </div>
                </div>
                <Badge tone="blue">TMI {taxSummary.incomeTax.tmi}%</Badge>
              </div>

              <div>
                <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                  {formatCurrency(taxSummary.incomeTax.netTax, currency)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums mt-0.5">
                  RNI : {formatCurrency(taxSummary.netTaxableIncome, currency)} (abatt.{' '}
                  {formatCurrency(taxSummary.deductionAmount, currency)})
                </p>
              </div>

              {/* Active Brackets */}
              <div className="space-y-1.5 pt-2 border-t border-black/[0.05] dark:border-white/[0.07]">
                {taxSummary.incomeTax.brackets
                  .filter((b) => b.taxableSlicePerPart > 0)
                  .map((b) => (
                    <div
                      key={b.rate}
                      className="flex items-center justify-between text-[11px] tabular-nums"
                    >
                      <span className="text-zinc-500 dark:text-zinc-400">
                        Tranche {b.rate}% ({formatCurrency(b.taxableSlicePerPart, currency, { compact: true })}/part)
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {formatCurrency(b.totalTaxForBracket, currency)}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Entries */}
              <div className="space-y-1.5 pt-2 border-t border-black/[0.05] dark:border-white/[0.07]">
                {incomeEntries.length === 0 && estimatedAnnualTaxableIncome > 0 && (
                  <p className="font-mono text-[11px] text-[#15803D] dark:text-[#22C55E] tabular-nums">
                    Pré-estimation échéancier :{' '}
                    {formatCurrency(monthlyTaxableFixed, currency)}/m × 12 ={' '}
                    {formatCurrency(estimatedAnnualTaxableIncome, currency)}
                  </p>
                )}
                {incomeEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-zinc-700 dark:text-zinc-300 truncate">
                      {entry.label}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-semibold tabular-nums text-zinc-900 dark:text-white">
                        {formatCurrency(entry.taxableBase, currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEntry(entry);
                          setEntryModalOpen(true);
                        }}
                        className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === entry.id}
                        onClick={() => handleDeleteEntry(entry)}
                        className="p-1 text-zinc-400 hover:text-[#FF3B30]"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Category 2: Capital / Épargne (PFU 31.4% vs 2OP) */}
            <Card className="p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-2xl bg-[#34C759]/14 text-[#1E8E3E] dark:text-[#30D158] flex items-center justify-center">
                    <Landmark className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Capital & Épargne
                    </h3>
                    <p className="text-[11px] text-zinc-400">PFU 31,4 % vs Case 2OP</p>
                  </div>
                </div>
                <Badge
                  tone={
                    taxSummary.capitalTax.isOption2OPAdvantageous ? 'green' : 'neutral'
                  }
                >
                  {taxSummary.capitalTax.isOption2OPAdvantageous
                    ? 'Option 2OP'
                    : 'PFU 31,4 %'}
                </Badge>
              </div>

              <div>
                <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                  {formatCurrency(taxSummary.capitalTax.effectiveOptimalTax, currency)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums mt-0.5">
                  Base déclarée : {formatCurrency(taxSummary.capitalBase, currency)}
                </p>
              </div>

              <div className="rounded-xl bg-zinc-50 dark:bg-white/[0.04] p-3 space-y-1 text-[11px]">
                <div className="flex justify-between tabular-nums">
                  <span className="text-zinc-500">PFU (12,8 % IR + 18,6 % PS)</span>
                  <strong className="text-zinc-900 dark:text-white">
                    {formatCurrency(taxSummary.capitalTax.pfuTotal, currency)}
                  </strong>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span className="text-zinc-500">
                    Barème 2OP (TMI {taxSummary.capitalTax.tmi} % + 18,6 %)
                  </span>
                  <strong className="text-zinc-900 dark:text-white">
                    {formatCurrency(taxSummary.capitalTax.progressiveTotal, currency)}
                  </strong>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 pt-1 leading-snug">
                  {taxSummary.capitalTax.recommendationText}
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-black/[0.05] dark:border-white/[0.07]">
                {capitalEntries.length === 0 ? (
                  <p className="text-xs text-zinc-400">Aucun gain de capital saisi.</p>
                ) : (
                  capitalEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-zinc-700 dark:text-zinc-300 truncate">
                        {entry.label}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="font-semibold tabular-nums text-zinc-900 dark:text-white">
                          {formatCurrency(entry.taxableBase, currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEntry(entry);
                            setEntryModalOpen(true);
                          }}
                          className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === entry.id}
                          onClick={() => handleDeleteEntry(entry)}
                          className="p-1 text-zinc-400 hover:text-[#FF3B30]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Category 3: Local Taxes & Others */}
            <Card className="p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-2xl bg-[#FF9500]/14 text-[#C26900] dark:text-[#FF9F0A] flex items-center justify-center">
                    <Building className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Impôts locaux & Autres
                    </h3>
                    <p className="text-[11px] text-zinc-400">Taxe foncière, habitation…</p>
                  </div>
                </div>
                <Badge tone="orange">{localAndOtherEntries.length} poste(s)</Badge>
              </div>

              <div>
                <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                  {formatCurrency(
                    taxSummary.localTaxTotal + taxSummary.otherTaxTotal,
                    currency
                  )}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Avis directs hors prélèvement à la source
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.07]">
                {localAndOtherEntries.length === 0 ? (
                  <p className="text-xs text-zinc-400">Aucun impôt local renseigné.</p>
                ) : (
                  localAndOtherEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="text-zinc-700 dark:text-zinc-200 font-medium truncate">
                          {entry.label}
                        </p>
                        {entry.notes && (
                          <p className="text-[10px] text-zinc-400 truncate">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="font-semibold tabular-nums text-zinc-900 dark:text-white">
                          {formatCurrency(entry.computedTax, currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEntry(entry);
                            setEntryModalOpen(true);
                          }}
                          className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === entry.id}
                          onClick={() => handleDeleteEntry(entry)}
                          className="p-1 text-zinc-400 hover:text-[#FF3B30]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* TAB 2: AIDE À LA DÉCLARATION (LINE-BY-LINE GUIDE)                  */}
      {/* ================================================================== */}
      {subTab === 'guide' && (
        <Card padded={false} className="overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.05] dark:border-white/[0.08] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-[#007AFF]" />
              <div>
                <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white">
                  Feuille de route · Déclaration {currentYear}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Montants et cases clés calculés selon votre foyer ({liveProfile.fiscalParts} part
                  {liveProfile.fiscalParts > 1 ? 's' : ''})
                </p>
              </div>
            </div>
            <Badge tone="green">
              <CheckCircle2 className="h-3 w-3" />
              Prêt à reporter
            </Badge>
          </div>

          <div className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
            {taxSummary.declarationLines.map((line) => (
              <div
                key={line.id}
                className={cn(
                  'px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5',
                  line.highlight && 'bg-[#007AFF]/[0.04] dark:bg-[#0A84FF]/[0.08]'
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-[#2C2C2E] text-[11px] font-bold tracking-tight text-zinc-800 dark:text-zinc-100 shrink-0 min-w-[78px] text-center">
                    {line.boxCode}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {line.label}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                      {line.hint}
                    </p>
                  </div>
                </div>

                <div className="sm:text-right shrink-0 pl-[90px] sm:pl-0">
                  {line.amount !== null ? (
                    <span className="text-base font-bold tabular-nums text-zinc-900 dark:text-white">
                      {formatCurrency(line.amount, currency)}
                    </span>
                  ) : (
                    <Badge tone={line.highlight ? 'green' : 'blue'}>
                      {line.valueText}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <TaxEntryModal
        open={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        year={currentYear}
        editingEntry={editingEntry}
        suggestedAnnualIncome={estimatedAnnualTaxableIncome}
        currency={currency}
        onSaved={onChanged}
      />
    </div>
  );
}
