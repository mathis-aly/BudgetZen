'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Car, Compass } from 'lucide-react';
import {
  FinancialProjectCategory,
  FinancialProjectDTO,
  FinancialProjectInput,
  computeProjectMetrics,
  evaluateProjectEffort,
  formatCurrency,
  formatPercent,
} from '@/core';
import { Badge, Button, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';

const CATEGORY_PRESETS: Record<
  FinancialProjectCategory,
  Pick<
    FinancialProjectInput,
    | 'extraFeesPercent'
    | 'annualPriceGrowthPercent'
    | 'targetMonths'
    | 'useLoan'
    | 'downPaymentPercent'
    | 'loanInterestRate'
    | 'loanDurationYears'
  > & { label: string; placeholder: string; icon: React.ComponentType<{ className?: string }> }
> = {
  REAL_ESTATE: {
    label: 'Immobilier',
    placeholder: 'Ex. Appartement T2 Toulouse',
    icon: Building2,
    extraFeesPercent: 8,
    annualPriceGrowthPercent: 2,
    targetMonths: 36,
    useLoan: true,
    downPaymentPercent: 20,
    loanInterestRate: 3.5,
    loanDurationYears: 20,
  },
  VEHICLE: {
    label: 'Véhicule',
    placeholder: 'Ex. Break familial hybride',
    icon: Car,
    extraFeesPercent: 2,
    annualPriceGrowthPercent: -10,
    targetMonths: 18,
    useLoan: false,
    downPaymentPercent: 100,
    loanInterestRate: 4.5,
    loanDurationYears: 5,
  },
  OTHER: {
    label: 'Projet personnel',
    placeholder: 'Ex. Rénovation, équipement ou voyage',
    icon: Compass,
    extraFeesPercent: 0,
    annualPriceGrowthPercent: 0,
    targetMonths: 12,
    useLoan: false,
    downPaymentPercent: 100,
    loanInterestRate: 4.0,
    loanDurationYears: 4,
  },
};

export function ProjectSimulatorModal({
  open,
  onClose,
  editingProject,
  monthlyIncome,
  resteAVivre,
  currency = 'EUR',
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editingProject: FinancialProjectDTO | null;
  monthlyIncome: number;
  resteAVivre: number;
  currency?: string;
  onSaved: (message: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] =
    useState<FinancialProjectCategory>('REAL_ESTATE');
  const [currentPrice, setCurrentPrice] = useState('220000');
  const [savedAmount, setSavedAmount] = useState('15000');
  const [targetMonths, setTargetMonths] = useState(36);
  const [annualPriceGrowthPercent, setAnnualPriceGrowthPercent] = useState(2);
  const [extraFeesPercent, setExtraFeesPercent] = useState(8);
  const [useLoan, setUseLoan] = useState(true);
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [loanInterestRate, setLoanInterestRate] = useState(3.5);
  const [loanDurationYears, setLoanDurationYears] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);

    if (editingProject) {
      setName(editingProject.name);
      setCategory(editingProject.category);
      setCurrentPrice(String(editingProject.currentPrice));
      setSavedAmount(String(editingProject.savedAmount));
      setTargetMonths(editingProject.targetMonths);
      setAnnualPriceGrowthPercent(editingProject.annualPriceGrowthPercent);
      setExtraFeesPercent(editingProject.extraFeesPercent);
      setUseLoan(editingProject.useLoan);
      setDownPaymentPercent(editingProject.downPaymentPercent);
      setLoanInterestRate(editingProject.loanInterestRate);
      setLoanDurationYears(editingProject.loanDurationYears);
    } else {
      const p = CATEGORY_PRESETS.REAL_ESTATE;
      setName('');
      setCategory('REAL_ESTATE');
      setCurrentPrice('220000');
      setSavedAmount('15000');
      setTargetMonths(p.targetMonths);
      setAnnualPriceGrowthPercent(p.annualPriceGrowthPercent);
      setExtraFeesPercent(p.extraFeesPercent);
      setUseLoan(p.useLoan);
      setDownPaymentPercent(p.downPaymentPercent);
      setLoanInterestRate(p.loanInterestRate);
      setLoanDurationYears(p.loanDurationYears);
    }
  }, [open, editingProject]);

  const handleCategoryChange = (nextCategory: FinancialProjectCategory) => {
    setCategory(nextCategory);
    if (!editingProject) {
      const p = CATEGORY_PRESETS[nextCategory];
      setExtraFeesPercent(p.extraFeesPercent);
      setAnnualPriceGrowthPercent(p.annualPriceGrowthPercent);
      setTargetMonths(p.targetMonths);
      setUseLoan(p.useLoan);
      setDownPaymentPercent(p.downPaymentPercent);
      setLoanInterestRate(p.loanInterestRate);
      setLoanDurationYears(p.loanDurationYears);
      if (nextCategory === 'VEHICLE') setCurrentPrice('24000');
      if (nextCategory === 'REAL_ESTATE') setCurrentPrice('220000');
      if (nextCategory === 'OTHER') setCurrentPrice('6000');
      if (nextCategory !== 'REAL_ESTATE') setSavedAmount('2000');
    }
  };

  const handleToggleLoan = (nextLoan: boolean) => {
    setUseLoan(nextLoan);
    if (nextLoan && downPaymentPercent >= 100) {
      setDownPaymentPercent(category === 'REAL_ESTATE' ? 20 : 25);
    }
  };

  const numericPrice = Math.max(0, Number(currentPrice) || 0);
  const numericSaved = Math.max(0, Number(savedAmount) || 0);

  const simulatedMetrics = useMemo(
    () =>
      computeProjectMetrics(
        {
          currentPrice: numericPrice,
          extraFeesPercent,
          annualPriceGrowthPercent,
          targetMonths,
          savedAmount: numericSaved,
          useLoan,
          downPaymentPercent: useLoan ? downPaymentPercent : 100,
          loanInterestRate,
          loanDurationYears,
        },
        monthlyIncome
      ),
    [
      numericPrice,
      extraFeesPercent,
      annualPriceGrowthPercent,
      targetMonths,
      numericSaved,
      useLoan,
      downPaymentPercent,
      loanInterestRate,
      loanDurationYears,
      monthlyIncome,
    ]
  );

  const effortAssessment = useMemo(
    () =>
      evaluateProjectEffort(
        simulatedMetrics.requiredMonthlySavings,
        resteAVivre
      ),
    [simulatedMetrics.requiredMonthlySavings, resteAVivre]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Veuillez saisir un nom de projet.');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError('Le prix actuel du bien doit être supérieur à 0 €.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        category,
        currentPrice: numericPrice,
        extraFeesPercent,
        annualPriceGrowthPercent,
        targetMonths,
        savedAmount: numericSaved,
        useLoan,
        downPaymentPercent: useLoan ? downPaymentPercent : 100,
        loanInterestRate,
        loanDurationYears,
      };

      const url = editingProject
        ? `/api/projects/${encodeURIComponent(editingProject.id)}`
        : '/api/projects';
      const method = editingProject ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.error || "Impossible d'enregistrer ce projet."
        );
      }

      onClose();
      await onSaved(
        editingProject
          ? `Projet « ${name.trim()} » mis à jour`
          : `Projet « ${name.trim()} » créé`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={
        editingProject
          ? 'Modifier & simuler le projet'
          : 'Nouveau projet d’achat / financement'
      }
      subtitle="Simulation en temps réel de l'horizon, de l'apport et de l'amortissement"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Category Switcher */}
        <div className="space-y-1.5">
          <span className="editorial-kicker block">Catégorie de projet</span>
          <div className="grid grid-cols-3 gap-2">
            {(
              Object.keys(CATEGORY_PRESETS) as FinancialProjectCategory[]
            ).map((catKey) => {
              const preset = CATEGORY_PRESETS[catKey];
              const Icon = preset.icon;
              const active = category === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => handleCategoryChange(catKey)}
                  className={cn(
                    'px-2.5 py-2 rounded-sm border font-mono text-xs flex items-center justify-center gap-1.5 transition-colors',
                    active
                      ? 'bg-[#141413] text-[#F7F6F2] border-[#141413] dark:bg-[#F2F0E8] dark:text-[#111110] dark:border-[#F2F0E8] font-semibold'
                      : 'bg-[#F7F6F2] dark:bg-[#111110] border-[#E2E0D8] dark:border-[#2A2A27] text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8]'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Core Identity & Amounts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1 space-y-1">
            <label htmlFor="project-name" className="editorial-kicker block">
              Nom du bien / projet
            </label>
            <input
              id="project-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={CATEGORY_PRESETS[category].placeholder}
              className="w-full px-3 py-2 rounded-sm bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] text-sm text-[#141413] dark:text-[#F2F0E8] focus:outline-none focus:border-[#141413] dark:focus:border-[#F2F0E8]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="project-price" className="editorial-kicker block">
              Prix actuel ({currency})
            </label>
            <input
              id="project-price"
              type="number"
              min={1}
              step="any"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
              className="w-full px-3 py-2 rounded-sm bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] font-mono text-sm tabular-nums text-[#141413] dark:text-[#F2F0E8] focus:outline-none focus:border-[#141413] dark:focus:border-[#F2F0E8]"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="project-saved" className="editorial-kicker block">
              Épargne dédiée ({currency})
            </label>
            <input
              id="project-saved"
              type="number"
              min={0}
              step="any"
              value={savedAmount}
              onChange={(e) => setSavedAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-sm bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] font-mono text-sm tabular-nums text-[#141413] dark:text-[#F2F0E8] focus:outline-none focus:border-[#141413] dark:focus:border-[#F2F0E8]"
            />
          </div>
        </div>

        {/* Real-time Interactive Market & Horizon Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#E2E0D8] dark:border-[#2A2A27]">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="project-months" className="editorial-kicker">
                Horizon
              </label>
              <span className="font-mono text-xs font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8]">
                {targetMonths} mois
              </span>
            </div>
            <input
              id="project-months"
              type="range"
              min={1}
              max={180}
              step={1}
              value={targetMonths}
              onChange={(e) => setTargetMonths(Number(e.target.value))}
              className="w-full accent-[#141413] dark:accent-[#F2F0E8]"
            />
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] tabular-nums">
              Soit {(targetMonths / 12).toFixed(1).replace('.', ',')} an(s)
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="project-growth" className="editorial-kicker">
                Évolution prix / an
              </label>
              <span
                className={cn(
                  'font-mono text-xs font-semibold tabular-nums',
                  annualPriceGrowthPercent > 0
                    ? 'text-[#B45309] dark:text-[#F59E0B]'
                    : annualPriceGrowthPercent < 0
                      ? 'text-[#15803D] dark:text-[#22C55E]'
                      : 'text-[#141413] dark:text-[#F2F0E8]'
                )}
              >
                {annualPriceGrowthPercent > 0 ? '+' : ''}
                {formatPercent(annualPriceGrowthPercent, 1)}
              </span>
            </div>
            <input
              id="project-growth"
              type="range"
              min={-25}
              max={15}
              step={0.5}
              value={annualPriceGrowthPercent}
              onChange={(e) =>
                setAnnualPriceGrowthPercent(Number(e.target.value))
              }
              className="w-full accent-[#141413] dark:accent-[#F2F0E8]"
            />
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890]">
              + Immo / − Décote auto
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="project-fees" className="editorial-kicker">
                Frais annexes
              </label>
              <span className="font-mono text-xs font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8]">
                {formatPercent(extraFeesPercent, 1)}
              </span>
            </div>
            <input
              id="project-fees"
              type="range"
              min={0}
              max={15}
              step={0.5}
              value={extraFeesPercent}
              onChange={(e) => setExtraFeesPercent(Number(e.target.value))}
              className="w-full accent-[#141413] dark:accent-[#F2F0E8]"
            />
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890]">
              Ex. 8 % notaire / carte grise
            </p>
          </div>
        </div>

        {/* Financing Mode Toggle + Credit Sliders */}
        <div className="p-3.5 rounded-sm border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="editorial-kicker block">Mode de financement</span>
              <p className="text-xs text-[#5C5B57] dark:text-[#9A9890] mt-0.5">
                Simulez un paiement comptant ou l’amortissement d’un crédit.
              </p>
            </div>
            <div className="inline-flex rounded-sm border border-[#E2E0D8] dark:border-[#2A2A27] overflow-hidden">
              <button
                type="button"
                onClick={() => handleToggleLoan(false)}
                className={cn(
                  'px-3 py-1.5 font-mono text-xs transition-colors',
                  !useLoan
                    ? 'bg-[#141413] text-[#F7F6F2] dark:bg-[#F2F0E8] dark:text-[#111110] font-semibold'
                    : 'bg-[#FFFFFF] dark:bg-[#181816] text-[#5C5B57] dark:text-[#9A9890]'
                )}
              >
                Comptant (100 %)
              </button>
              <button
                type="button"
                onClick={() => handleToggleLoan(true)}
                className={cn(
                  'px-3 py-1.5 font-mono text-xs border-l border-[#E2E0D8] dark:border-[#2A2A27] transition-colors',
                  useLoan
                    ? 'bg-[#141413] text-[#F7F6F2] dark:bg-[#F2F0E8] dark:text-[#111110] font-semibold'
                    : 'bg-[#FFFFFF] dark:bg-[#181816] text-[#5C5B57] dark:text-[#9A9890]'
                )}
              >
                À crédit
              </button>
            </div>
          </div>

          {useLoan && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#E2E0D8] dark:border-[#2A2A27]">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="project-down" className="editorial-kicker">
                    Apport personnel
                  </label>
                  <span className="font-mono text-xs font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8]">
                    {formatPercent(downPaymentPercent, 0)}
                  </span>
                </div>
                <input
                  id="project-down"
                  type="range"
                  min={0}
                  max={90}
                  step={1}
                  value={downPaymentPercent}
                  onChange={(e) =>
                    setDownPaymentPercent(Number(e.target.value))
                  }
                  className="w-full accent-[#141413] dark:accent-[#F2F0E8]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="project-rate" className="editorial-kicker">
                    Taux annuel
                  </label>
                  <span className="font-mono text-xs font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8]">
                    {formatPercent(loanInterestRate, 2)}
                  </span>
                </div>
                <input
                  id="project-rate"
                  type="range"
                  min={0}
                  max={10}
                  step={0.1}
                  value={loanInterestRate}
                  onChange={(e) => setLoanInterestRate(Number(e.target.value))}
                  className="w-full accent-[#141413] dark:accent-[#F2F0E8]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="project-duration"
                    className="editorial-kicker"
                  >
                    Durée du prêt
                  </label>
                  <span className="font-mono text-xs font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8]">
                    {loanDurationYears} ans
                  </span>
                </div>
                <input
                  id="project-duration"
                  type="range"
                  min={2}
                  max={30}
                  step={1}
                  value={loanDurationYears}
                  onChange={(e) => setLoanDurationYears(Number(e.target.value))}
                  className="w-full accent-[#141413] dark:accent-[#F2F0E8]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Editorial Simulation Readout */}
        <div className="rounded-sm border border-[#141413]/25 dark:border-[#F2F0E8]/25 bg-[#F7F6F2] dark:bg-[#111110] overflow-hidden">
          <div className="px-3.5 py-2 border-b border-[#E2E0D8] dark:border-[#2A2A27] flex items-center justify-between gap-2">
            <span className="editorial-kicker">
              Simulation temps réel · Revenu de réf.{' '}
              {formatCurrency(monthlyIncome, currency)}/m
            </span>
            <Badge tone={effortAssessment.tone}>
              {effortAssessment.label}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E2E0D8] dark:divide-[#2A2A27]">
            <div className="p-3">
              <span className="editorial-kicker block">Prix projeté</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1 block">
                {formatCurrency(simulatedMetrics.projectedPrice, currency)}
              </span>
            </div>
            <div className="p-3">
              <span className="editorial-kicker block">Coût total</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1 block">
                {formatCurrency(simulatedMetrics.totalProjectCost, currency)}
              </span>
            </div>
            <div className="p-3">
              <span className="editorial-kicker block">
                {useLoan ? 'Apport requis' : 'Cible totale'}
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1 block">
                {formatCurrency(
                  simulatedMetrics.requiredSavingsTarget,
                  currency
                )}
              </span>
            </div>
            <div className="p-3">
              <span className="editorial-kicker block">Effort / mois</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-[#B45309] dark:text-[#F59E0B] mt-1 block">
                {formatCurrency(
                  simulatedMetrics.requiredMonthlySavings,
                  currency
                )}
              </span>
            </div>
          </div>

          {useLoan && (
            <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-[#E2E0D8] dark:border-[#2A2A27] divide-y sm:divide-y-0 sm:divide-x divide-[#E2E0D8] dark:divide-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413]">
              <div className="p-3">
                <span className="editorial-kicker block">Emprunt</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1 block">
                  {formatCurrency(simulatedMetrics.loanPrincipal, currency)}
                </span>
              </div>
              <div className="p-3">
                <span className="editorial-kicker block">Mensualité</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1 block">
                  {formatCurrency(
                    simulatedMetrics.monthlyLoanPayment,
                    currency
                  )}
                </span>
              </div>
              <div className="p-3">
                <span className="editorial-kicker block">Coût intérêts</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-[#5C5B57] dark:text-[#9A9890] mt-1 block">
                  {formatCurrency(
                    simulatedMetrics.totalLoanInterestCost,
                    currency
                  )}
                </span>
              </div>
              <div className="p-3">
                <span className="editorial-kicker block">Endettement</span>
                <span
                  className={cn(
                    'font-mono text-sm font-semibold tabular-nums mt-1 inline-flex items-center gap-1',
                    simulatedMetrics.isHighDebtRisk
                      ? 'text-[#B91C1C] dark:text-[#EF4444]'
                      : 'text-[#15803D] dark:text-[#22C55E]'
                  )}
                >
                  {simulatedMetrics.isHighDebtRisk && (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {formatPercent(simulatedMetrics.debtToIncomeRatio, 1)}
                </span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="font-mono text-xs text-[#B91C1C] dark:text-[#EF4444]">
            {error}
          </p>
        )}

        <div className="pt-2 border-t border-[#E2E0D8] dark:border-[#2A2A27] flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting
              ? 'Enregistrement…'
              : editingProject
                ? 'Mettre à jour le projet'
                : 'Enregistrer le projet'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
