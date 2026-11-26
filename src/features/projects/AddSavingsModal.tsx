'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  FinancialProjectDTO,
  computeProjectMetrics,
  formatCurrency,
  formatPercent,
  roundCurrency,
} from '@/core';
import { Button, Modal, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/cn';

export function AddSavingsModal({
  open,
  onClose,
  project,
  monthlyIncome,
  currency = 'EUR',
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  project: FinancialProjectDTO | null;
  monthlyIncome: number;
  currency?: string;
  onSaved: (message: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'add' | 'set'>('add');
  const [amountInput, setAmountInput] = useState('250');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metrics = useMemo(
    () => (project ? computeProjectMetrics(project, monthlyIncome) : null),
    [project, monthlyIncome]
  );

  useEffect(() => {
    if (!open || !project) return;
    setMode('add');
    setError(null);
    setSubmitting(false);
    const defaultSuggestion =
      metrics && metrics.requiredMonthlySavings > 0
        ? Math.round(metrics.requiredMonthlySavings)
        : 250;
    setAmountInput(String(defaultSuggestion));
  }, [open, project, metrics]);

  const numericValue = Number(amountInput);
  const validNumeric = Number.isFinite(numericValue) && numericValue >= 0;

  const projectedSaved = useMemo(() => {
    if (!project) return 0;
    if (!validNumeric) return project.savedAmount;
    return mode === 'add'
      ? roundCurrency(project.savedAmount + numericValue)
      : roundCurrency(numericValue);
  }, [mode, numericValue, project, validNumeric]);

  const projectedProgress = useMemo(() => {
    if (!metrics || metrics.requiredSavingsTarget <= 0) return 100;
    return (
      Math.round((projectedSaved / metrics.requiredSavingsTarget) * 1000) / 10
    );
  }, [metrics, projectedSaved]);

  if (!project || !metrics) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validNumeric || (mode === 'add' && numericValue <= 0)) {
      setError('Veuillez saisir un montant valide.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload =
        mode === 'add'
          ? { addSavings: roundCurrency(numericValue) }
          : { savedAmount: roundCurrency(numericValue) };

      const res = await fetch(
        `/api/projects/${encodeURIComponent(project.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || "Impossible de mettre à jour l'épargne."
        );
      }

      onClose();
      await onSaved(
        mode === 'add'
          ? `+${formatCurrency(numericValue, currency)} alloués à « ${project.name} »`
          : `Épargne de « ${project.name} » mise à jour (${formatCurrency(projectedSaved, currency)})`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la mise à jour.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Épargne · ${project.name}`}
      subtitle={`Cible : ${formatCurrency(metrics.requiredSavingsTarget, currency)} (${project.useLoan ? 'apport' : 'achat comptant'})`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="inline-flex rounded-sm border border-[#E2E0D8] dark:border-[#2A2A27] overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setMode('add');
              setAmountInput('250');
            }}
            className={cn(
              'px-3 py-1.5 font-mono text-xs transition-colors',
              mode === 'add'
                ? 'bg-[#141413] text-[#F7F6F2] dark:bg-[#F2F0E8] dark:text-[#111110] font-semibold'
                : 'bg-[#FFFFFF] dark:bg-[#181816] text-[#5C5B57] dark:text-[#9A9890]'
            )}
          >
            + Ajouter un versement
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('set');
              setAmountInput(String(project.savedAmount));
            }}
            className={cn(
              'px-3 py-1.5 font-mono text-xs border-l border-[#E2E0D8] dark:border-[#2A2A27] transition-colors',
              mode === 'set'
                ? 'bg-[#141413] text-[#F7F6F2] dark:bg-[#F2F0E8] dark:text-[#111110] font-semibold'
                : 'bg-[#FFFFFF] dark:bg-[#181816] text-[#5C5B57] dark:text-[#9A9890]'
            )}
          >
            Définir le total
          </button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="project-add-savings" className="editorial-kicker block">
            {mode === 'add'
              ? `Montant à ajouter (${currency})`
              : `Nouveau montant total mis de côté (${currency})`}
          </label>
          <input
            id="project-add-savings"
            type="number"
            autoFocus
            min={0}
            step="any"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="w-full px-3 py-2 rounded-sm bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] font-mono text-base font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] focus:outline-none focus:border-[#141413] dark:focus:border-[#F2F0E8]"
          />

          {mode === 'add' && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[100, 250, 500, 1000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountInput(String(preset))}
                  className="px-2 py-1 rounded-sm border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413] font-mono text-[11px] tabular-nums text-[#141413] dark:text-[#F2F0E8] hover:border-[#141413] dark:hover:border-[#F2F0E8] transition-colors"
                >
                  +{preset} €
                </button>
              ))}
              {metrics.requiredMonthlySavings > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setAmountInput(String(metrics.requiredMonthlySavings))
                  }
                  className="px-2 py-1 rounded-sm border border-[#B45309]/40 bg-[#B45309]/[0.06] font-mono text-[11px] tabular-nums text-[#B45309] dark:text-[#F59E0B] hover:border-[#B45309] transition-colors"
                >
                  +Mensualité (
                  {formatCurrency(metrics.requiredMonthlySavings, currency)})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Live Before/After Progress Preview */}
        <div className="p-3.5 rounded-sm border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413] space-y-2">
          <div className="flex items-center justify-between gap-2 font-mono text-xs tabular-nums">
            <span className="text-[#5C5B57] dark:text-[#9A9890]">
              Nouveau cumul projeté
            </span>
            <span className="font-semibold text-[#141413] dark:text-[#F2F0E8]">
              {formatCurrency(projectedSaved, currency)} /{' '}
              {formatCurrency(metrics.requiredSavingsTarget, currency)} (
              {formatPercent(projectedProgress, 1)})
            </span>
          </div>
          <ProgressBar
            value={projectedProgress}
            status={projectedProgress >= 100 ? 'green' : 'orange'}
            markerPercent={100}
          />
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
            {submitting ? 'Mise à jour…' : 'Valider l’épargne'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
