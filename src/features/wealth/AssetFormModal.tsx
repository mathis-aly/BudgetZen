'use client';

import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { WealthAssetCategory, WealthAssetDTO } from '@/core';
import { Button, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';

const CATEGORY_OPTIONS: Array<{
  value: WealthAssetCategory;
  label: string;
  defaultYield: string;
}> = [
  { value: 'SAVINGS', label: 'Épargne', defaultYield: '3.0' },
  { value: 'STOCKS', label: 'Actions / ETF', defaultYield: '7.0' },
  { value: 'REAL_ESTATE', label: 'Immobilier', defaultYield: '5.0' },
  { value: 'OTHER', label: 'Autre', defaultYield: '4.0' },
];

export function AssetFormModal({
  open,
  onClose,
  editingAsset,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editingAsset: WealthAssetDTO | null;
  onSaved: (message: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WealthAssetCategory>('STOCKS');
  const [currentValueStr, setCurrentValueStr] = useState('');
  const [monthlyContributionStr, setMonthlyContributionStr] = useState('0');
  const [expectedAnnualYieldStr, setExpectedAnnualYieldStr] = useState('7.0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingAsset) {
      setName(editingAsset.name);
      setCategory(editingAsset.category);
      setCurrentValueStr(String(editingAsset.currentValue));
      setMonthlyContributionStr(String(editingAsset.monthlyContribution));
      setExpectedAnnualYieldStr(String(editingAsset.expectedAnnualYield));
    } else {
      setName('');
      setCategory('STOCKS');
      setCurrentValueStr('');
      setMonthlyContributionStr('150');
      setExpectedAnnualYieldStr('7.0');
    }
  }, [open, editingAsset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Indiquez le nom du support.');
      return;
    }

    const currentValue = Math.max(
      0,
      Number(currentValueStr.replace(',', '.').trim()) || 0
    );
    const monthlyContribution = Math.max(
      0,
      Number(monthlyContributionStr.replace(',', '.').trim()) || 0
    );
    const expectedAnnualYield =
      Number(expectedAnnualYieldStr.replace(',', '.').trim()) || 0;

    setSaving(true);
    setError(null);
    try {
      const url = editingAsset ? `/api/wealth/${editingAsset.id}` : '/api/wealth';
      const method = editingAsset ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          currentValue,
          monthlyContribution,
          expectedAnnualYield,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Erreur lors de la sauvegarde.');
      }

      await onSaved(
        editingAsset
          ? `Support « ${name.trim()} » mis à jour`
          : `Support « ${name.trim()} » ajouté`
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
      title={editingAsset ? 'Modifier le support' : 'Nouvelle enveloppe patrimoniale'}
      subtitle="Saisie 100 % manuelle · aucune connexion bancaire externe"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="asset-name"
            className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
          >
            Nom du support
          </label>
          <input
            id="asset-name"
            type="text"
            placeholder="Ex : PEA ETF Monde, Livret A, CTO Actions…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
            Type d’actif
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setCategory(opt.value);
                  if (!editingAsset) setExpectedAnnualYieldStr(opt.defaultYield);
                }}
                className={cn(
                  'py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all',
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label
              htmlFor="asset-value"
              className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              Capital actuel (€)
            </label>
            <input
              id="asset-value"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={currentValueStr}
              onChange={(e) =>
                setCurrentValueStr(e.target.value.replace(/[^0-9.,]/g, ''))
              }
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm font-semibold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
            />
          </div>

          <div>
            <label
              htmlFor="asset-monthly"
              className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              Versement / mois (€)
            </label>
            <input
              id="asset-monthly"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={monthlyContributionStr}
              onChange={(e) =>
                setMonthlyContributionStr(e.target.value.replace(/[^0-9.,]/g, ''))
              }
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm font-semibold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
            />
          </div>

          <div>
            <label
              htmlFor="asset-yield"
              className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              Rendement / an (%)
            </label>
            <input
              id="asset-yield"
              type="text"
              inputMode="decimal"
              placeholder="5.0"
              value={expectedAnnualYieldStr}
              onChange={(e) =>
                setExpectedAnnualYieldStr(e.target.value.replace(/[^0-9.,-]/g, ''))
              }
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm font-semibold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
            />
          </div>
        </div>

        {error && <p className="text-xs font-semibold text-[#FF3B30]">{error}</p>}

        <div className="flex gap-2.5 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button type="submit" loading={saving} className="flex-1">
            <Check className="h-4 w-4" />
            {editingAsset ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
