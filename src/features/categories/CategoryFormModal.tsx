'use client';

import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { CategoryDTO, TransactionType } from '@/core';
import {
  Button,
  CATEGORY_COLORS,
  CATEGORY_ICON_NAMES,
  CATEGORY_ICONS,
  Modal,
} from '@/components/ui';
import { cn } from '@/lib/cn';

export function CategoryFormModal({
  open,
  onClose,
  editingCategory,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editingCategory: CategoryDTO | null;
  onSaved: (message: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState('ShoppingCart');
  const [monthlyLimitStr, setMonthlyLimitStr] = useState('200');
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingCategory) {
      setName(editingCategory.name);
      setType(editingCategory.type);
      setColor(editingCategory.color);
      setIcon(editingCategory.icon);
      setMonthlyLimitStr(String(editingCategory.monthlyLimit));
      setAlertThreshold(editingCategory.alertThreshold);
    } else {
      setName('');
      setType('EXPENSE');
      setColor(CATEGORY_COLORS[0]);
      setIcon('Tag');
      setMonthlyLimitStr('200');
      setAlertThreshold(80);
    }
  }, [open, editingCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Veuillez saisir un nom pour cette catégorie.');
      return;
    }

    const monthlyLimit =
      type === 'EXPENSE'
        ? Math.max(0, Number(monthlyLimitStr.replace(',', '.')) || 0)
        : 0;

    setSaving(true);
    setError(null);
    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory.id}`
        : '/api/categories';
      const method = editingCategory ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          color,
          icon,
          monthlyLimit,
          alertThreshold,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Erreur lors de la sauvegarde.');
      }

      await onSaved(
        editingCategory
          ? `Catégorie « ${name.trim()} » mise à jour`
          : `Catégorie « ${name.trim()} » créée`
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
      title={editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      subtitle="Personnalisez le plafond mensuel, le seuil d'alerte, la couleur et l'icône"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!editingCategory && (
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-zinc-100 dark:bg-white/[0.08]">
            {(['EXPENSE', 'INCOME'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'py-2 rounded-xl text-xs font-semibold transition-all',
                  type === t
                    ? 'bg-white dark:bg-[#2C2C2E] text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400'
                )}
              >
                {t === 'EXPENSE' ? 'Catégorie de dépense' : 'Catégorie de revenu'}
              </button>
            ))}
          </div>
        )}

        <div>
          <label
            htmlFor="cat-name"
            className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
          >
            Nom
          </label>
          <input
            id="cat-name"
            type="text"
            placeholder="Ex : Vacances, Animaux, Épargne…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
          />
        </div>

        {type === 'EXPENSE' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="cat-limit"
                className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
              >
                Plafond mensuel (€)
              </label>
              <input
                id="cat-limit"
                type="text"
                inputMode="decimal"
                placeholder="0 = sans plafond"
                value={monthlyLimitStr}
                onChange={(e) =>
                  setMonthlyLimitStr(e.target.value.replace(/[^0-9.,]/g, ''))
                }
                className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm font-semibold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="cat-threshold"
                  className="text-xs font-semibold text-zinc-500 dark:text-zinc-400"
                >
                  Seuil d’alerte orange
                </label>
                <span className="text-xs font-bold tabular-nums text-[#FF9500]">
                  {alertThreshold}%
                </span>
              </div>
              <div className="h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] flex items-center">
                <input
                  id="cat-threshold"
                  type="range"
                  min={50}
                  max={95}
                  step={5}
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(Number(e.target.value))}
                  className="w-full accent-[#FF9500]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Color Swatches */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">
            Couleur
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Couleur ${c}`}
                className={cn(
                  'h-8 w-8 rounded-full transition-transform flex items-center justify-center',
                  color === c ? 'scale-110 ring-2 ring-offset-2 ring-zinc-900 dark:ring-white dark:ring-offset-[#1C1C1E]' : 'hover:scale-105'
                )}
                style={{ backgroundColor: c }}
              >
                {color === c && <Check className="h-4 w-4 text-white" />}
              </button>
            ))}
          </div>
        </div>

        {/* Icon Picker */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">
            Icône
          </label>
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-36 overflow-y-auto p-1">
            {CATEGORY_ICON_NAMES.map((iconName) => {
              const IconComp = CATEGORY_ICONS[iconName];
              const selected = icon === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  className={cn(
                    'h-10 rounded-xl flex items-center justify-center border transition-all',
                    selected
                      ? 'border-[#007AFF] bg-[#007AFF]/12 text-[#007AFF]'
                      : 'border-black/[0.06] dark:border-white/[0.08] bg-zinc-50 dark:bg-[#2C2C2E] text-zinc-600 dark:text-zinc-300'
                  )}
                  style={
                    selected
                      ? { borderColor: color, backgroundColor: `${color}1A`, color }
                      : undefined
                  }
                >
                  <IconComp className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-xs font-semibold text-[#FF3B30]">{error}</p>}

        <div className="flex gap-2.5 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button type="submit" loading={saving} className="flex-1">
            <Check className="h-4 w-4" />
            {editingCategory ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
