'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  FileSpreadsheet,
  Flame,
  Info,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
} from 'lucide-react';
import {
  BudgetSummary,
  CategoryDTO,
  MonthlyReportDTO,
  PersonalInflationReport,
  TransactionDTO,
  UserSettingsDTO,
  calculateCashErosion,
  formatCurrency,
  formatMonthlyReportsCSV,
  formatPercent,
  formatTransactionsCSV,
  roundCurrency,
} from '@/core';
import {
  Badge,
  Button,
  Card,
  CategoryIcon,
  ExportCsvButton,
  ImportCsvModal,
  SectionHeader,
} from '@/components/ui';
import { cn } from '@/lib/cn';

export function SettingsView({
  userSettings,
  summary,
  personalInflation,
  transactions,
  categories,
  monthlyReports,
  currency = 'EUR',
  onSaved,
  onNotify,
}: {
  userSettings: UserSettingsDTO;
  summary: BudgetSummary;
  personalInflation: PersonalInflationReport;
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  monthlyReports: MonthlyReportDTO[];
  currency?: string;
  onSaved: (message: string) => Promise<void>;
  onNotify?: (message: string) => void;
}) {
  const [reserveRate, setReserveRate] = useState(userSettings.mandatoryReserveRate);
  const [inflationRate, setInflationRate] = useState(userSettings.manualInflationRate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    setReserveRate(userSettings.mandatoryReserveRate);
    setInflationRate(userSettings.manualInflationRate);
  }, [userSettings.mandatoryReserveRate, userSettings.manualInflationRate]);

  const hasChanges =
    Math.abs(reserveRate - userSettings.mandatoryReserveRate) > 0.01 ||
    Math.abs(inflationRate - userSettings.manualInflationRate) > 0.01;

  // Live impact preview before saving
  const previewReserveAmount = roundCurrency(
    summary.monthIncome * (reserveRate / 100)
  );
  const previewReserveRemaining = roundCurrency(
    Math.max(0, previewReserveAmount - summary.reserveUsedThisMonth)
  );
  const previewResteAVivre = roundCurrency(
    summary.currentBalance - summary.remainingFixedCharges - previewReserveRemaining
  );

  const previewErosion = useMemo(
    () => calculateCashErosion(summary.currentBalance, inflationRate),
    [summary.currentBalance, inflationRate]
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/user-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mandatoryReserveRate: reserveRate,
          manualInflationRate: inflationRate,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Erreur lors de la sauvegarde.');
      }

      await onSaved('Paramètres manuels enregistrés');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Paramètres manuels"
        subtitle="Pilotez votre bouclier de sécurité et votre hypothèse d'inflation sans aucune API externe"
      />

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 1. Mandatory Reserve Rate */}
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#34C759]/14 text-[#1E8E3E] dark:bg-[#30D158]/20 dark:text-[#30D158] flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white">
                    Taux de réserve obligatoire
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Bouclier Imprévus bloqué chaque mois
                  </p>
                </div>
              </div>
              <span className="text-xl font-bold tabular-nums text-[#34C759] dark:text-[#30D158]">
                {formatPercent(reserveRate, 1)}
              </span>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={40}
                step={0.5}
                value={reserveRate}
                onChange={(e) => setReserveRate(Number(e.target.value))}
                aria-label="Taux de réserve obligatoire en pourcentage"
                className="w-full accent-[#34C759]"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {[0, 5, 10, 15, 20].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReserveRate(preset)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[11px] font-semibold tabular-nums transition-colors',
                        Math.abs(reserveRate - preset) < 0.01
                          ? 'bg-[#34C759] text-white'
                          : 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-300'
                      )}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={80}
                    step={0.5}
                    value={reserveRate}
                    onChange={(e) =>
                      setReserveRate(
                        Math.min(80, Math.max(0, Number(e.target.value) || 0))
                      )
                    }
                    className="w-16 h-8 px-2 text-right rounded-xl bg-zinc-100 dark:bg-[#2C2C2E] text-xs font-bold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#34C759]/40"
                  />
                  <span className="text-xs font-semibold text-zinc-400">%</span>
                </div>
              </div>
            </div>

            {/* Immediate impact explanation */}
            <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.04] p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-zinc-700 dark:text-zinc-200">
                <Info className="h-3.5 w-3.5 text-[#007AFF]" />
                Impact immédiat sur ce mois-ci
              </div>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Déduit automatiquement{' '}
                <strong className="tabular-nums text-zinc-900 dark:text-white">
                  {formatCurrency(previewReserveAmount, currency)}
                </strong>{' '}
                ({formatPercent(reserveRate, 1)} de vos{' '}
                {formatCurrency(summary.monthIncome, currency)} de revenus mensuels) de
                votre Reste à vivre disponible, qui passe à{' '}
                <strong className="tabular-nums text-zinc-900 dark:text-white">
                  {formatCurrency(previewResteAVivre, currency)}
                </strong>
                . Vous pouvez puiser dans ce bouclier pour un imprévu sans alerter vos
                catégories courantes.
              </p>
            </div>
          </Card>

          {/* 2. Manual Annual Inflation Rate */}
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#FF9500]/14 text-[#C26900] dark:bg-[#FF9F0A]/20 dark:text-[#FF9F0A] flex items-center justify-center shrink-0">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white">
                    Taux d’inflation annuel manuel
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Utilisé pour le pouvoir d’achat réel et l’érosion cash
                  </p>
                </div>
              </div>
              <span className="text-xl font-bold tabular-nums text-[#FF9500] dark:text-[#FF9F0A]">
                {formatPercent(inflationRate, 1)}
              </span>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={10}
                step={0.1}
                value={inflationRate}
                onChange={(e) => setInflationRate(Number(e.target.value))}
                aria-label="Taux d'inflation annuel manuel en pourcentage"
                className="w-full accent-[#FF9500]"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {[1.5, 2.0, 2.5, 3.5, 5.0].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setInflationRate(preset)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[11px] font-semibold tabular-nums transition-colors',
                        Math.abs(inflationRate - preset) < 0.01
                          ? 'bg-[#FF9500] text-white'
                          : 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-300'
                      )}
                    >
                      {String(preset).replace('.', ',')}%
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.1}
                    value={inflationRate}
                    onChange={(e) =>
                      setInflationRate(
                        Math.min(30, Math.max(0, Number(e.target.value) || 0))
                      )
                    }
                    className="w-16 h-8 px-2 text-right rounded-xl bg-zinc-100 dark:bg-[#2C2C2E] text-xs font-bold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF9500]/40"
                  />
                  <span className="text-xs font-semibold text-zinc-400">%</span>
                </div>
              </div>
            </div>

            {/* Immediate impact explanation */}
            <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.04] p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-zinc-700 dark:text-zinc-200">
                <Info className="h-3.5 w-3.5 text-[#FF9500]" />
                Impact immédiat sur vos projections & liquidités
              </div>
              <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                À {formatPercent(inflationRate, 1)} / an, vos{' '}
                <strong className="tabular-nums text-zinc-900 dark:text-white">
                  {formatCurrency(summary.currentBalance, currency)}
                </strong>{' '}
                dormant sur le compte courant subissent une perte estimée de{' '}
                <strong className="tabular-nums text-[#C26900] dark:text-[#FF9F0A]">
                  {formatCurrency(previewErosion.annualLoss, currency)} / an
                </strong>{' '}
                ({formatCurrency(previewErosion.fiveYearLoss, currency)} sur 5 ans). Ce
                taux actualise aussi la courbe réelle dans l’onglet Patrimoine.
              </p>
            </div>
          </Card>
        </div>

        {error && <p className="text-xs font-semibold text-[#FF3B30]">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          {hasChanges && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Modifications non enregistrées
            </span>
          )}
          <Button
            type="submit"
            size="lg"
            loading={saving}
            disabled={!hasChanges}
            className="min-w-[200px]"
          >
            <Check className="h-4 w-4" />
            Enregistrer les paramètres
          </Button>
        </div>
      </form>

      {/* 3. PERSONAL INFLATION REPORT (src/core/inflation.ts) */}
      <section className="space-y-3">
        <SectionHeader
          title="Votre inflation personnelle mesurée"
          subtitle={
            personalInflation.hasComparisonData
              ? `Comparaison du coût moyen mensuel par catégorie : ${personalInflation.previousYear} vs ${personalInflation.currentYear}`
              : "Nécessite des dépenses enregistrées sur l'année précédente et l'année en cours"
          }
          action={
            personalInflation.hasComparisonData &&
            personalInflation.personalInflationRate > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setInflationRate(
                    Math.max(
                      0,
                      Math.min(
                        30,
                        Math.round(personalInflation.personalInflationRate * 10) / 10
                      )
                    )
                  )
                }
              >
                <Sparkles className="h-3.5 w-3.5 text-[#007AFF]" />
                Appliquer ({formatPercent(personalInflation.personalInflationRate, 1)})
              </Button>
            ) : undefined
          }
        />

        {!personalInflation.hasComparisonData ? (
          <Card className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Pas encore assez d’historique sur {personalInflation.previousYear} pour
            comparer votre coût de la vie annuel.
          </Card>
        ) : (
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/[0.05] dark:border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-[#007AFF]/12 text-[#007AFF] dark:bg-[#0A84FF]/20 dark:text-[#409CFF] flex items-center justify-center">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Inflation personnelle réelle ({personalInflation.previousYear} →{' '}
                    {personalInflation.currentYear})
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    {personalInflation.personalInflationRate > 0 ? '+' : ''}
                    {formatPercent(personalInflation.personalInflationRate, 1)}
                  </p>
                </div>
              </div>

              <div className="text-right text-xs tabular-nums">
                <p className="text-zinc-500 dark:text-zinc-400">
                  Panier mensuel moyen :{' '}
                  <strong className="text-zinc-900 dark:text-white">
                    {formatCurrency(personalInflation.totalPreviousMonthlyAvg, currency)}
                  </strong>{' '}
                  →{' '}
                  <strong className="text-zinc-900 dark:text-white">
                    {formatCurrency(personalInflation.totalCurrentMonthlyAvg, currency)}
                  </strong>
                </p>
                <p
                  className={cn(
                    'font-semibold mt-0.5',
                    personalInflation.monthlyCostDelta > 0
                      ? 'text-[#FF9500] dark:text-[#FF9F0A]'
                      : 'text-[#34C759] dark:text-[#30D158]'
                  )}
                >
                  {formatCurrency(personalInflation.monthlyCostDelta, currency, {
                    showSign: true,
                  })}{' '}
                  / mois
                </p>
              </div>
            </div>

            <div className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              {personalInflation.categories.map((cat) => (
                <div
                  key={cat.categoryId}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        {cat.name}
                      </p>
                      <p className="text-[11px] text-zinc-400 tabular-nums">
                        {formatCurrency(cat.previousMonthlyAvg, currency)}/m →{' '}
                        {formatCurrency(cat.currentMonthlyAvg, currency)}/m
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums hidden sm:inline">
                      {formatCurrency(cat.monthlyDelta, currency, { showSign: true })}
                    </span>
                    <Badge
                      tone={
                        cat.inflationRate >= 5
                          ? 'red'
                          : cat.inflationRate > 0
                            ? 'orange'
                            : 'green'
                      }
                    >
                      {cat.inflationRate > 0 ? '+' : ''}
                      {formatPercent(cat.inflationRate, 1)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* 4. BACKUP & PORTABILITY SECTION (FULL CSV EXPORTS) */}
      <section className="space-y-3">
        <SectionHeader
          title="Sauvegarde & Portabilité"
          subtitle="Exportez l'intégralité de vos données au format CSV (UTF-8 BOM, séparateur « ; ») compatible Excel et Apple Numbers"
        />

        <Card className="p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#007AFF]/12 text-[#007AFF] dark:bg-[#0A84FF]/20 dark:text-[#409CFF] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white">
                Exports complets hors-ligne
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                Téléchargez vos fichiers localement pour archiver votre comptabilité ou
                l’analyser dans un tableur, avec accents préservés, décimales à virgule et
                dates au format JJ/MM/AAAA.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.04] p-4 flex flex-col justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  Toutes les transactions
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                  {transactions.length} opération{transactions.length > 1 ? 's' : ''}{' '}
                  enregistrée{transactions.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <ExportCsvButton
                  label="Exporter en CSV"
                  filenamePrefix="transactions"
                  variant="primary"
                  size="md"
                  disabled={transactions.length === 0}
                  getCsvContent={() => formatTransactionsCSV(transactions, categories)}
                  onExported={(file) =>
                    onNotify?.(`Sauvegarde complète téléchargée (${file})`)
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setImportModalOpen(true)}
                  className="flex-1"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Importer un CSV
                </Button>
              </div>
            </div>

            <div className="rounded-md bg-[#FCFBF9] dark:bg-[#141413] border border-[#E2E0D8] dark:border-[#2A2A27] p-4 flex flex-col justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#141413] dark:text-[#F2F0E8]">
                  Tous les rapports mensuels
                </p>
                <p className="text-xs text-[#5C5B57] dark:text-[#9A9890] mt-0.5 tabular-nums">
                  {monthlyReports.length} bilan{monthlyReports.length > 1 ? 's' : ''}{' '}
                  clôturé{monthlyReports.length > 1 ? 's' : ''}
                </p>
              </div>
              <ExportCsvButton
                label="Exporter tous les rapports"
                filenamePrefix="rapports_mensuels"
                variant="secondary"
                size="md"
                disabled={monthlyReports.length === 0}
                getCsvContent={() => formatMonthlyReportsCSV(monthlyReports)}
                onExported={(file) =>
                  onNotify?.(`Rapports mensuels téléchargés (${file})`)
                }
                className="w-full"
              />
            </div>
          </div>
        </Card>
      </section>

      <ImportCsvModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        categories={categories}
        transactions={transactions}
        currency={currency}
        onImported={onSaved}
      />
    </div>
  );
}
