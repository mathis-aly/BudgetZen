'use client';

import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { TaxEntryCategory, TaxEntryDTO, formatCurrency } from '@/core';
import { Button, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';

const CATEGORY_OPTIONS: Array<{
  value: TaxEntryCategory;
  label: string;
  usesBase: boolean;
}> = [
  { value: 'INCOME', label: 'Revenus', usesBase: true },
  { value: 'CAPITAL', label: 'Capital / Épargne', usesBase: true },
  { value: 'LOCAL', label: 'Impôts locaux', usesBase: false },
  { value: 'OTHER', label: 'Autre impôt', usesBase: false },
];

export function TaxEntryModal({
  open,
  onClose,
  year,
  editingEntry,
  suggestedAnnualIncome = 0,
  currency = 'EUR',
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  year: number;
  editingEntry: TaxEntryDTO | null;
  suggestedAnnualIncome?: number;
  currency?: string;
  onSaved: (message: string) => Promise<void>;
}) {
  const [category, setCategory] = useState<TaxEntryCategory>('INCOME');
  const [label, setLabel] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usesBase = category === 'INCOME' || category === 'CAPITAL';

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingEntry) {
      setCategory(editingEntry.category);
      setLabel(editingEntry.label);
      const isBaseCat =
        editingEntry.category === 'INCOME' || editingEntry.category === 'CAPITAL';
      setAmountStr(
        String(isBaseCat ? editingEntry.taxableBase : editingEntry.computedTax)
      );
      setNotes(editingEntry.notes ?? '');
    } else {
      setCategory('INCOME');
      setLabel('');
      setAmountStr('');
      setNotes('');
    }
  }, [open, editingEntry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('Indiquez un libellé pour ce poste fiscal.');
      return;
    }

    const parsed = Math.max(0, Number(amountStr.replace(',', '.').trim()) || 0);
    if (parsed <= 0) {
      setError('Indiquez un montant supérieur à 0 €.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const url = editingEntry
        ? `/api/taxes/entries/${editingEntry.id}`
        : '/api/taxes/entries';
      const method = editingEntry ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          category,
          label: label.trim(),
          taxableBase: usesBase ? parsed : 0,
          computedTax: usesBase
            ? category === 'CAPITAL'
              ? Math.round(parsed * 0.314 * 100) / 100
              : 0
            : parsed,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Erreur lors de la sauvegarde.');
      }

      await onSaved(
        editingEntry
          ? `Poste « ${label.trim()} » mis à jour`
          : `Poste fiscal « ${label.trim()} » ajouté`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingEntry ? 'Modifier le poste fiscal' : `Ajouter un poste (${year})`}
      subtitle="Saisie manuelle · les impôts sur les revenus et le capital sont calculés automatiquement"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
            Catégorie fiscale
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCategory(opt.value)}
                className={cn(
                  'py-2 px-2 rounded-xl text-xs font-semibold border transition-all',
                  category === opt.value
                    ? 'border-[#007AFF] bg-[#007AFF]/10 text-[#007AFF] dark:border-[#0A84FF] dark:bg-[#0A84FF]/20 dark:text-[#409CFF]'
                    : 'border-black/[0.06] dark:border-white/[0.08] bg-zinc-50 dark:bg-[#2C2C2E] text-zinc-600 dark:text-zinc-300'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="tax-label"
            className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
          >
            Libellé
          </label>
          <input
            id="tax-label"
            type="text"
            placeholder={
              category === 'INCOME'
                ? 'Ex : Salaires nets imposables annuels'
                : category === 'CAPITAL'
                  ? 'Ex : Dividendes CTO, intérêts livrets imposables'
                  : 'Ex : Taxe foncière, CFE…'
            }
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
          />
        </div>

        <div>
          <label
            htmlFor="tax-amount"
            className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
          >
            {usesBase ? 'Base imposable annuelle (€)' : 'Montant de l’impôt (€)'}
          </label>
          <input
            id="tax-amount"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.,]/g, ''))}
            className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-base font-bold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
          />
          {!editingEntry &&
            category === 'INCOME' &&
            suggestedAnnualIncome > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAmountStr(String(suggestedAnnualIncome));
                  if (!label.trim()) {
                    setLabel('Revenus fixes annuels imposables');
                  }
                }}
                className="mt-1.5 inline-flex items-center px-2 py-1 rounded-sm border border-[#15803D]/35 bg-[#15803D]/[0.06] text-[#15803D] dark:border-[#22C55E]/35 dark:text-[#22C55E] font-mono text-[11px] tabular-nums hover:border-[#15803D] transition-colors"
              >
                Pré-remplir via échéancier ({formatCurrency(suggestedAnnualIncome, currency)})
              </button>
            )}
        </div>

        <div>
          <label
            htmlFor="tax-notes"
            className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
          >
            Notes (optionnel)
          </label>
          <input
            id="tax-notes"
            type="text"
            placeholder="Ex : Référence IFU, échéance…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
          />
        </div>

        {error && <p className="text-xs font-semibold text-[#FF3B30]">{error}</p>}

        <div className="flex gap-2.5 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button type="submit" loading={saving} className="flex-1">
            <Check className="h-4 w-4" />
            {editingEntry ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
