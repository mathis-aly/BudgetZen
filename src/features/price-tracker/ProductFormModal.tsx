'use client';

import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { TrackedProductDTO } from '@/core';
import { Button, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';

const UNIT_PRESETS = ['1 kg', '500 g', '1 L', '75 cl', 'boîte de 12', 'unité'];

export function ProductFormModal({
  open,
  onClose,
  editingProduct,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editingProduct: TrackedProductDTO | null;
  onSaved: (message: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('1 kg');
  const [targetAlertPercent, setTargetAlertPercent] = useState(5.0);
  const [initialPriceStr, setInitialPriceStr] = useState('');
  const [initialStore, setInitialStore] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingProduct) {
      setName(editingProduct.name);
      setUnit(editingProduct.unit);
      setTargetAlertPercent(editingProduct.targetAlertPercent);
      setInitialPriceStr('');
      setInitialStore('');
    } else {
      setName('');
      setUnit('1 kg');
      setTargetAlertPercent(5.0);
      setInitialPriceStr('');
      setInitialStore('');
    }
  }, [open, editingProduct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Indiquez le nom du produit à suivre.');
      return;
    }

    const parsedInitialPrice =
      !editingProduct && initialPriceStr.trim()
        ? Number(initialPriceStr.replace(',', '.').trim())
        : null;

    if (
      parsedInitialPrice !== null &&
      (!Number.isFinite(parsedInitialPrice) || parsedInitialPrice <= 0)
    ) {
      setError('Le prix initial doit être supérieur à 0 €.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const url = editingProduct
        ? `/api/price-tracker/${editingProduct.id}`
        : '/api/price-tracker';
      const method = editingProduct ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          unit: unit.trim() || 'unité',
          targetAlertPercent,
          ...(!editingProduct && parsedInitialPrice !== null
            ? {
                initialPrice: parsedInitialPrice,
                initialStore: initialStore.trim() || null,
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Erreur lors de la sauvegarde.');
      }

      await onSaved(
        editingProduct
          ? `Produit « ${name.trim()} » modifié`
          : `Produit « ${name.trim()} » ajouté au panier témoin`
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
      title={editingProduct ? 'Modifier le produit suivi' : 'Ajouter un produit témoin'}
      subtitle="Suivez manuellement l'évolution tarifaire d'un produit du quotidien"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="prod-name"
            className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
          >
            Nom du produit
          </label>
          <input
            id="prod-name"
            type="text"
            placeholder="Ex : Beurre doux 250g, Huile d'olive, Café…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="prod-unit"
            className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400"
          >
            Unité / Conditionnement
          </label>
          <input
            id="prod-unit"
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full h-10 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
          />
          <div className="flex flex-wrap gap-1.5">
            {UNIT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setUnit(preset)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
                  unit === preset
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-300'
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="prod-alert"
              className="text-xs font-semibold text-zinc-500 dark:text-zinc-400"
            >
              Seuil d’alerte hausse
            </label>
            <span className="text-xs font-bold tabular-nums text-[#FF3B30] dark:text-[#FF453A]">
              +{targetAlertPercent.toFixed(1).replace('.', ',')} %
            </span>
          </div>
          <div className="h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] flex items-center">
            <input
              id="prod-alert"
              type="range"
              min={1}
              max={25}
              step={0.5}
              value={targetAlertPercent}
              onChange={(e) => setTargetAlertPercent(Number(e.target.value))}
              className="w-full accent-[#FF3B30]"
            />
          </div>
        </div>

        {!editingProduct && (
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-black/[0.05] dark:border-white/[0.08]">
            <div>
              <label
                htmlFor="prod-init-price"
                className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
              >
                1er prix constaté (€)
              </label>
              <input
                id="prod-init-price"
                type="text"
                inputMode="decimal"
                placeholder="Optionnel"
                value={initialPriceStr}
                onChange={(e) =>
                  setInitialPriceStr(e.target.value.replace(/[^0-9.,]/g, ''))
                }
                className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm font-semibold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
              />
            </div>
            <div>
              <label
                htmlFor="prod-init-store"
                className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
              >
                Enseigne
              </label>
              <input
                id="prod-init-store"
                type="text"
                placeholder="Optionnel"
                value={initialStore}
                onChange={(e) => setInitialStore(e.target.value)}
                className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
              />
            </div>
          </div>
        )}

        {error && <p className="text-xs font-semibold text-[#FF3B30]">{error}</p>}

        <div className="flex gap-2.5 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button type="submit" loading={saving} className="flex-1">
            <Check className="h-4 w-4" />
            {editingProduct ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
