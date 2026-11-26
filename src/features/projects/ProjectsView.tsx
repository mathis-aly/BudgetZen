'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Car,
  Compass,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  FinancialProjectCategory,
  FinancialProjectDTO,
  computeProjectMetrics,
  evaluateProjectEffort,
  formatCurrency,
  formatPercent,
} from '@/core';
import { Badge, Button, Card, ProgressBar, SectionHeader } from '@/components/ui';
import { cn } from '@/lib/cn';
import { AddSavingsModal } from './AddSavingsModal';
import { ProjectSimulatorModal } from './ProjectSimulatorModal';

const CATEGORY_META: Record<
  FinancialProjectCategory,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: 'blue' | 'orange' | 'neutral';
  }
> = {
  REAL_ESTATE: { label: 'Immobilier', icon: Building2, tone: 'blue' },
  VEHICLE: { label: 'Véhicule', icon: Car, tone: 'orange' },
  OTHER: { label: 'Projet personnel', icon: Compass, tone: 'neutral' },
};

export function ProjectsView({
  projects,
  monthlyIncome,
  resteAVivre,
  currency = 'EUR',
  onChanged,
  onBackToDashboard,
}: {
  projects: FinancialProjectDTO[];
  monthlyIncome: number;
  resteAVivre: number;
  currency?: string;
  onChanged: (message: string) => Promise<void>;
  onBackToDashboard: () => void;
}) {
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [editingProject, setEditingProject] =
    useState<FinancialProjectDTO | null>(null);
  const [savingsProject, setSavingsProject] =
    useState<FinancialProjectDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const enriched = useMemo(
    () =>
      projects.map((project) => {
        const metrics = computeProjectMetrics(project, monthlyIncome);
        const effort = evaluateProjectEffort(
          metrics.requiredMonthlySavings,
          resteAVivre
        );
        return { project, metrics, effort };
      }),
    [projects, monthlyIncome, resteAVivre]
  );

  const totals = useMemo(() => {
    const totalSaved = enriched.reduce(
      (sum, item) => sum + item.project.savedAmount,
      0
    );
    const totalMonthlyEffort = enriched.reduce(
      (sum, item) => sum + item.metrics.requiredMonthlySavings,
      0
    );
    const totalLoanPayments = enriched.reduce(
      (sum, item) => sum + item.metrics.monthlyLoanPayment,
      0
    );
    return {
      totalSaved,
      totalMonthlyEffort,
      totalLoanPayments,
    };
  }, [enriched]);

  const totalEffortCheck = useMemo(
    () => evaluateProjectEffort(totals.totalMonthlyEffort, resteAVivre),
    [totals.totalMonthlyEffort, resteAVivre]
  );

  const handleDelete = async (project: FinancialProjectDTO) => {
    setDeletingId(project.id);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error();
      await onChanged(`Projet « ${project.name} » supprimé`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Projets & Financements"
        subtitle="Planification d'achats majeurs, horizon d'épargne et simulation d'emprunt"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onBackToDashboard}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Tableau de bord</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingProject(null);
                setSimModalOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Nouveau projet</span>
            </Button>
          </div>
        }
      />

      {/* 4-Column Swiss Financial Press Summary Strip */}
      <Card padded={false} className="overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E0D8] dark:divide-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413]">
          <div className="p-4">
            <p className="editorial-kicker">Projets actifs</p>
            <p className="font-mono text-xl font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1">
              {projects.length}
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5 tabular-nums">
              {enriched.filter((i) => i.project.useLoan).length} financé(s) à
              crédit
            </p>
          </div>

          <div className="p-4">
            <p className="editorial-kicker">Épargne dédiée cumulée</p>
            <p className="font-mono text-xl font-semibold tabular-nums text-[#15803D] dark:text-[#22C55E] mt-1">
              {formatCurrency(totals.totalSaved, currency)}
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5">
              Affectée manuellement
            </p>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="editorial-kicker">Effort mensuel requis</p>
              <Badge tone={totalEffortCheck.tone}>
                {totalEffortCheck.label}
              </Badge>
            </div>
            <p className="font-mono text-xl font-semibold tabular-nums text-[#B45309] dark:text-[#F59E0B] mt-1">
              {formatCurrency(totals.totalMonthlyEffort, currency)}
              <span className="text-xs font-normal text-[#5C5B57] dark:text-[#9A9890]">
                /m
              </span>
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5 tabular-nums">
              Vs Reste à vivre {formatCurrency(resteAVivre, currency)}
            </p>
          </div>

          <div className="p-4">
            <p className="editorial-kicker">Mensualités simulées</p>
            <p className="font-mono text-xl font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1">
              {formatCurrency(totals.totalLoanPayments, currency)}
              <span className="text-xs font-normal text-[#5C5B57] dark:text-[#9A9890]">
                /m
              </span>
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5 tabular-nums">
              Sur revenu {formatCurrency(monthlyIncome, currency)}
            </p>
          </div>
        </div>
      </Card>

      {/* Project List / Cards */}
      {enriched.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <p className="editorial-kicker">Aucun projet enregistré</p>
          <h3 className="font-serif text-2xl text-[#141413] dark:text-[#F2F0E8]">
            Simulez votre prochain achat immobilier, véhicule ou objectif
          </h3>
          <p className="text-xs text-[#5C5B57] dark:text-[#9A9890] max-w-md mx-auto leading-relaxed">
            Calculez le prix futur ajusté de l’appréciation ou de la décote,
            l’effort d’épargne mensuel nécessaire et les mensualités de crédit
            avec alerte d’endettement à 35 %.
          </p>
          <div className="pt-2">
            <Button
              size="sm"
              onClick={() => {
                setEditingProject(null);
                setSimModalOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Créer un premier projet</span>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {enriched.map(({ project, metrics, effort }) => {
            const catMeta = CATEGORY_META[project.category];
            const CatIcon = catMeta.icon;
            const progressStatus =
              metrics.progressPercent >= 100
                ? 'green'
                : metrics.progressPercent >= 40
                  ? 'orange'
                  : 'red';
            const horizonYears =
              project.targetMonths >= 12
                ? ` (${(project.targetMonths / 12).toFixed(1).replace('.', ',')} ans)`
                : '';

            return (
              <Card
                key={project.id}
                padded={false}
                className="overflow-hidden"
              >
                {/* Card Masthead */}
                <div className="px-5 py-4 border-b border-[#E2E0D8] dark:border-[#2A2A27] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={catMeta.tone}>
                        <CatIcon className="h-3 w-3" />
                        {catMeta.label}
                      </Badge>
                      <Badge tone="neutral">
                        Dans {project.targetMonths} mois{horizonYears}
                      </Badge>
                      <Badge tone={project.useLoan ? 'orange' : 'green'}>
                        {project.useLoan
                          ? `Crédit · Apport ${formatPercent(project.downPaymentPercent, 0)}`
                          : 'Comptant'}
                      </Badge>
                    </div>
                    <h3 className="font-serif text-2xl text-[#141413] dark:text-[#F2F0E8] truncate">
                      {project.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSavingsProject(project)}
                    >
                      <PiggyBank className="h-3.5 w-3.5" />
                      <span>+ Ajouter de l’épargne</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Simuler / modifier le projet"
                      onClick={() => {
                        setEditingProject(project);
                        setSimModalOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Supprimer ce projet"
                      disabled={deletingId === project.id}
                      onClick={() => void handleDelete(project)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#B91C1C] dark:text-[#EF4444]" />
                    </Button>
                  </div>
                </div>

                {/* Projected Price, Total Cost & Effort Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E2E0D8] dark:divide-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413]">
                  <div className="p-4">
                    <p className="editorial-kicker">
                      Prix projeté à {project.targetMonths} mois
                    </p>
                    <p className="font-mono text-lg font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1">
                      {formatCurrency(metrics.projectedPrice, currency)}
                    </p>
                    <p className="font-mono text-[11px] tabular-nums text-[#5C5B57] dark:text-[#9A9890] mt-0.5">
                      Base {formatCurrency(project.currentPrice, currency)} (
                      {metrics.priceGrowthDelta >= 0 ? '+' : ''}
                      {formatCurrency(metrics.priceGrowthDelta, currency)} à{' '}
                      {project.annualPriceGrowthPercent > 0 ? '+' : ''}
                      {formatPercent(project.annualPriceGrowthPercent, 1)}/an)
                    </p>
                  </div>

                  <div className="p-4">
                    <p className="editorial-kicker">
                      Coût total &amp; Frais (+
                      {formatPercent(project.extraFeesPercent, 1)})
                    </p>
                    <p className="font-mono text-lg font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1">
                      {formatCurrency(metrics.totalProjectCost, currency)}
                    </p>
                    <p className="font-mono text-[11px] tabular-nums text-[#5C5B57] dark:text-[#9A9890] mt-0.5">
                      Dont {formatCurrency(metrics.extraFeesAmount, currency)}{' '}
                      de frais annexes
                    </p>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="editorial-kicker">Effort mensuel requis</p>
                      <Badge tone={effort.tone}>{effort.label}</Badge>
                    </div>
                    <p className="font-mono text-lg font-semibold tabular-nums text-[#B45309] dark:text-[#F59E0B] mt-1">
                      {formatCurrency(metrics.requiredMonthlySavings, currency)}
                      <span className="text-xs font-normal text-[#5C5B57] dark:text-[#9A9890]">
                        /mois
                      </span>
                    </p>
                    <p className="font-mono text-[11px] tabular-nums text-[#5C5B57] dark:text-[#9A9890] mt-0.5">
                      {metrics.requiredMonthlySavings === 0
                        ? 'Cible déjà financée'
                        : `${formatPercent(effort.sharePercent, 0)} de votre Reste à vivre (${formatCurrency(resteAVivre, currency)})`}
                    </p>
                  </div>
                </div>

                {/* Surgical Savings Progress Bar */}
                <div className="px-5 py-4 border-t border-[#E2E0D8] dark:border-[#2A2A27] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs tabular-nums">
                    <span className="text-[#5C5B57] dark:text-[#9A9890]">
                      Avancement épargne{' '}
                      <strong className="text-[#141413] dark:text-[#F2F0E8]">
                        {formatCurrency(project.savedAmount, currency)}
                      </strong>{' '}
                      /{' '}
                      {formatCurrency(metrics.requiredSavingsTarget, currency)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#5C5B57] dark:text-[#9A9890]">
                        Reste{' '}
                        {formatCurrency(
                          metrics.remainingSavingsNeeded,
                          currency
                        )}
                      </span>
                      <Badge tone={progressStatus}>
                        {formatPercent(metrics.progressPercent, 1)}
                      </Badge>
                    </div>
                  </div>
                  <ProgressBar
                    value={metrics.progressPercent}
                    status={progressStatus}
                    markerPercent={100}
                  />
                </div>

                {/* Optional Loan Amortization Breakdown */}
                {project.useLoan && (
                  <div className="px-5 py-3.5 border-t border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="editorial-kicker">
                        Simulation crédit · {project.loanDurationYears} ans à{' '}
                        {formatPercent(project.loanInterestRate, 2)}
                      </span>
                      {metrics.isHighDebtRisk && (
                        <Badge tone="red">
                          <AlertTriangle className="h-3 w-3" />
                          ALERTE ENDETTEMENT &gt; 35 % (
                          {formatPercent(metrics.debtToIncomeRatio, 1)})
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#5C5B57] dark:text-[#9A9890] block">
                          Montant emprunté
                        </span>
                        <span className="text-sm font-semibold text-[#141413] dark:text-[#F2F0E8]">
                          {formatCurrency(metrics.loanPrincipal, currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#5C5B57] dark:text-[#9A9890] block">
                          Mensualité estimée
                        </span>
                        <span className="text-sm font-semibold text-[#141413] dark:text-[#F2F0E8]">
                          {formatCurrency(
                            metrics.monthlyLoanPayment,
                            currency
                          )}
                          /m
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#5C5B57] dark:text-[#9A9890] block">
                          Coût total intérêts
                        </span>
                        <span className="text-sm font-semibold text-[#5C5B57] dark:text-[#9A9890]">
                          {formatCurrency(
                            metrics.totalLoanInterestCost,
                            currency
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#5C5B57] dark:text-[#9A9890] block">
                          Taux d’endettement
                        </span>
                        <span
                          className={cn(
                            'text-sm font-semibold',
                            metrics.isHighDebtRisk
                              ? 'text-[#B91C1C] dark:text-[#EF4444]'
                              : 'text-[#15803D] dark:text-[#22C55E]'
                          )}
                        >
                          {formatPercent(metrics.debtToIncomeRatio, 1)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ProjectSimulatorModal
        open={simModalOpen}
        onClose={() => {
          setSimModalOpen(false);
          setEditingProject(null);
        }}
        editingProject={editingProject}
        monthlyIncome={monthlyIncome}
        resteAVivre={resteAVivre}
        currency={currency}
        onSaved={onChanged}
      />

      <AddSavingsModal
        open={Boolean(savingsProject)}
        onClose={() => setSavingsProject(null)}
        project={savingsProject}
        monthlyIncome={monthlyIncome}
        currency={currency}
        onSaved={onChanged}
      />
    </div>
  );
}
