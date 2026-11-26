'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Layers, Plus, Scale, Trash2 } from 'lucide-react';
import {
  CategoryDTO,
  CustomIndexType,
  IndexComponentSourceType,
  TrackedProductDTO,
  TransactionDTO,
  WealthAssetDTO,
  calculateProductInflation,
  getMonthKey,
  roundCurrency,
} from '@/core';
import { Badge, Button, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';

interface DraftComponent {
  tempId: string;
  sourceType: IndexComponentSourceType;
  sourceId: string;
  label: string;
  weightPercent: number;
  baseReferenceValue: number;
}

export function NewIndexModal({
  open,
  onClose,
  trackedProducts,
  categories,
  transactions,
  wealthAssets,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  trackedProducts: TrackedProductDTO[];
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  wealthAssets: WealthAssetDTO[];
  onSaved: (message: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CustomIndexType>('COMPOSITE');
  const [baseValueStr, setBaseValueStr] = useState('100');
  const [components, setComponents] = useState<DraftComponent[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((c) => !c.isArchived && c.type === 'EXPENSE'),
    [categories]
  );

  const currentMonthKey = getMonthKey(new Date());

  const getDefaultSourceSelection = (
    sourceType: IndexComponentSourceType
  ): { sourceId: string; label: string; refValue: number } => {
    if (sourceType === 'TRACKED_PRODUCT' && trackedProducts.length > 0) {
      const p = trackedProducts[0];
      const stats = calculateProductInflation(p.entries);
      return {
        sourceId: p.id,
        label: p.name,
        refValue: stats.latestPrice > 0 ? stats.latestPrice : 1,
      };
    }
    if (sourceType === 'WEALTH_ASSET' && wealthAssets.length > 0) {
      const a = wealthAssets[0];
      return {
        sourceId: a.id,
        label: a.name,
        refValue: a.currentValue > 0 ? a.currentValue : 100,
      };
    }
    if (sourceType === 'EXPENSE_CATEGORY' && expenseCategories.length > 0) {
      const c = expenseCategories[0];
      const spent = transactions
        .filter(
          (tx) =>
            tx.type === 'EXPENSE' &&
            tx.categoryId === c.id &&
            getMonthKey(new Date(tx.date)) === currentMonthKey
        )
        .reduce((sum, tx) => sum + tx.amount, 0);
      return {
        sourceId: c.id,
        label: c.name,
        refValue: spent > 0 ? roundCurrency(spent) : Math.max(1, c.monthlyLimit || 100),
      };
    }
    return { sourceId: '', label: 'Série personnalisée', refValue: 100 };
  };

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setType('COMPOSITE');
    setBaseValueStr('100');
    setError(null);

    if (trackedProducts.length >= 2) {
      const p1 = trackedProducts[0];
      const p2 = trackedProducts[1];
      setComponents([
        {
          tempId: 'init-1',
          sourceType: 'TRACKED_PRODUCT',
          sourceId: p1.id,
          label: p1.name,
          weightPercent: 50,
          baseReferenceValue: calculateProductInflation(p1.entries).latestPrice || 1,
        },
        {
          tempId: 'init-2',
          sourceType: 'TRACKED_PRODUCT',
          sourceId: p2.id,
          label: p2.name,
          weightPercent: 50,
          baseReferenceValue: calculateProductInflation(p2.entries).latestPrice || 1,
        },
      ]);
    } else {
      const first = getDefaultSourceSelection('EXPENSE_CATEGORY');
      setComponents([
        {
          tempId: 'init-1',
          sourceType: 'EXPENSE_CATEGORY',
          sourceId: first.sourceId,
          label: first.label,
          weightPercent: 100,
          baseReferenceValue: first.refValue,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalWeight = useMemo(
    () => roundCurrency(components.reduce((sum, c) => sum + (Number(c.weightPercent) || 0), 0)),
    [components]
  );
  const weightIsValid = Math.abs(totalWeight - 100) < 0.05;

  const handleAddComponent = () => {
    const def = getDefaultSourceSelection(
      trackedProducts.length > 0 ? 'TRACKED_PRODUCT' : 'EXPENSE_CATEGORY'
    );
    const remaining = Math.max(0, roundCurrency(100 - totalWeight));
    setComponents((prev) => [
      ...prev,
      {
        tempId: `comp-${Date.now()}`,
        sourceType:
          trackedProducts.length > 0 ? 'TRACKED_PRODUCT' : 'EXPENSE_CATEGORY',
        sourceId: def.sourceId,
        label: def.label,
        weightPercent: remaining > 0 ? remaining : 10,
        baseReferenceValue: def.refValue,
      },
    ]);
  };

  const handleEqualizeWeights = () => {
    if (components.length === 0) return;
    const base = Math.floor((100 / components.length) * 10) / 10;
    const remainder = roundCurrency(100 - base * (components.length - 1));
    setComponents((prev) =>
      prev.map((c, idx) => ({
        ...c,
        weightPercent: idx === prev.length - 1 ? remainder : base,
      }))
    );
  };

  const handleSourceTypeChange = (
    tempId: string,
    nextSourceType: IndexComponentSourceType
  ) => {
    const def = getDefaultSourceSelection(nextSourceType);
    setComponents((prev) =>
      prev.map((c) =>
        c.tempId === tempId
          ? {
              ...c,
              sourceType: nextSourceType,
              sourceId: def.sourceId,
              label: def.label,
              baseReferenceValue: def.refValue,
            }
          : c
      )
    );
  };

  const handleSourceItemChange = (tempId: string, sourceId: string) => {
    setComponents((prev) =>
      prev.map((c) => {
        if (c.tempId !== tempId) return c;
        if (c.sourceType === 'TRACKED_PRODUCT') {
          const p = trackedProducts.find((x) => x.id === sourceId);
          if (p) {
            return {
              ...c,
              sourceId,
              label: p.name,
              baseReferenceValue: calculateProductInflation(p.entries).latestPrice || 1,
            };
          }
        }
        if (c.sourceType === 'WEALTH_ASSET') {
          const a = wealthAssets.find((x) => x.id === sourceId);
          if (a) {
            return {
              ...c,
              sourceId,
              label: a.name,
              baseReferenceValue: a.currentValue > 0 ? a.currentValue : 100,
            };
          }
        }
        if (c.sourceType === 'EXPENSE_CATEGORY') {
          const cat = expenseCategories.find((x) => x.id === sourceId);
          if (cat) {
            const spent = transactions
              .filter(
                (tx) =>
                  tx.type === 'EXPENSE' &&
                  tx.categoryId === cat.id &&
                  getMonthKey(new Date(tx.date)) === currentMonthKey
              )
              .reduce((sum, tx) => sum + tx.amount, 0);
            return {
              ...c,
              sourceId,
              label: cat.name,
              baseReferenceValue:
                spent > 0 ? roundCurrency(spent) : Math.max(1, cat.monthlyLimit || 100),
            };
          }
        }
        return { ...c, sourceId };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Indiquez un nom pour votre indice.");
      return;
    }
    if (type === 'COMPOSITE') {
      if (components.length === 0) {
        setError('Ajoutez au moins une composante.');
        return;
      }
      if (!weightIsValid) {
        setError(
          `La somme des pondérations doit être exactement égale à 100 % (actuel : ${totalWeight} %).`
        );
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/custom-indices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          baseValue: Math.max(1, Number(baseValueStr.replace(',', '.')) || 100),
          type,
          components:
            type === 'COMPOSITE'
              ? components.map((c) => ({
                  sourceType: c.sourceType,
                  sourceId: c.sourceId || null,
                  label: c.label,
                  weightPercent: c.weightPercent,
                  baseReferenceValue: c.baseReferenceValue,
                }))
              : [],
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Impossible de créer l'indice.");
      }

      await onSaved(`Indice « ${name.trim()} » créé`);
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
      title="Nouvel Indice Personnalisé"
      subtitle="Assemblez un indice composite pondéré (base 100) ou créez un indice libre"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-zinc-100 dark:bg-white/[0.08]">
          <button
            type="button"
            onClick={() => setType('COMPOSITE')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all',
              type === 'COMPOSITE'
                ? 'bg-white dark:bg-[#2C2C2E] text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400'
            )}
          >
            <Layers className="h-3.5 w-3.5 text-[#007AFF]" />
            Indice Composite Pondéré
          </button>
          <button
            type="button"
            onClick={() => setType('MANUAL')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all',
              type === 'MANUAL'
                ? 'bg-white dark:bg-[#2C2C2E] text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400'
            )}
          >
            <Scale className="h-3.5 w-3.5 text-[#34C759]" />
            Indice Libre (Manuel)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label
              htmlFor="idx-name"
              className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              Nom de l’indice
            </label>
            <input
              id="idx-name"
              type="text"
              placeholder="Ex : Indice Petit-Déjeuner, Indice Patrimoine Perso…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
            />
          </div>

          <div>
            <label
              htmlFor="idx-base"
              className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              Base initiale (pts)
            </label>
            <input
              id="idx-base"
              type="text"
              inputMode="decimal"
              value={baseValueStr}
              onChange={(e) => setBaseValueStr(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm font-bold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="idx-desc"
            className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
          >
            Description (optionnel)
          </label>
          <input
            id="idx-desc"
            type="text"
            placeholder="Ex : Suivi pondéré de mes dépenses essentielles"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-10 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
          />
        </div>

        {/* COMPOSITE COMPONENTS BUILDER */}
        {type === 'COMPOSITE' && (
          <div className="space-y-3 pt-2 border-t border-black/[0.05] dark:border-white/[0.08]">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  Composantes pondérées
                </span>
                <Badge tone={weightIsValid ? 'green' : 'red'}>
                  Total : {totalWeight} % {weightIsValid ? '✓' : '(doit faire 100 %)'}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                {!weightIsValid && components.length > 0 && (
                  <button
                    type="button"
                    onClick={handleEqualizeWeights}
                    className="text-[11px] font-semibold text-[#007AFF] dark:text-[#409CFF] hover:underline px-1.5"
                  >
                    Équilibrer à 100 %
                  </button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleAddComponent}
                  className="h-7 px-2.5 text-[11px]"
                >
                  <Plus className="h-3 w-3" />
                  Ajouter
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
              {components.map((comp) => (
                <div
                  key={comp.tempId}
                  className="rounded-2xl bg-zinc-50 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] p-3 space-y-2"
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <select
                      value={comp.sourceType}
                      onChange={(e) =>
                        handleSourceTypeChange(
                          comp.tempId,
                          e.target.value as IndexComponentSourceType
                        )
                      }
                      aria-label="Type de source"
                      className="col-span-5 h-9 px-2 rounded-xl bg-white dark:bg-[#2C2C2E] text-xs font-medium text-zinc-800 dark:text-zinc-100 border border-black/[0.06] dark:border-white/[0.08]"
                    >
                      <option value="TRACKED_PRODUCT">Produit suivi</option>
                      <option value="EXPENSE_CATEGORY">Catégorie dépense</option>
                      <option value="WEALTH_ASSET">Support patrimoine</option>
                      <option value="MANUAL_SERIES">Série libre</option>
                    </select>

                    {comp.sourceType === 'MANUAL_SERIES' ? (
                      <input
                        type="text"
                        value={comp.label}
                        onChange={(e) =>
                          setComponents((prev) =>
                            prev.map((c) =>
                              c.tempId === comp.tempId
                                ? { ...c, label: e.target.value }
                                : c
                            )
                          )
                        }
                        placeholder="Nom"
                        className="col-span-6 h-9 px-2.5 rounded-xl bg-white dark:bg-[#2C2C2E] text-xs text-zinc-900 dark:text-white border border-black/[0.06] dark:border-white/[0.08]"
                      />
                    ) : (
                      <select
                        value={comp.sourceId}
                        onChange={(e) =>
                          handleSourceItemChange(comp.tempId, e.target.value)
                        }
                        aria-label="Élément source"
                        className="col-span-6 h-9 px-2 rounded-xl bg-white dark:bg-[#2C2C2E] text-xs font-medium text-zinc-800 dark:text-zinc-100 border border-black/[0.06] dark:border-white/[0.08]"
                      >
                        {comp.sourceType === 'TRACKED_PRODUCT' &&
                          trackedProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        {comp.sourceType === 'EXPENSE_CATEGORY' &&
                          expenseCategories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        {comp.sourceType === 'WEALTH_ASSET' &&
                          wealthAssets.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setComponents((prev) =>
                          prev.filter((c) => c.tempId !== comp.tempId)
                        )
                      }
                      aria-label="Retirer"
                      className="col-span-1 h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-[#FF3B30]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-[#2C2C2E] px-2.5 py-1.5 rounded-xl border border-black/[0.05] dark:border-white/[0.08]">
                      <span className="text-[11px] text-zinc-400">Pondération</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={comp.weightPercent}
                          onChange={(e) =>
                            setComponents((prev) =>
                              prev.map((c) =>
                                c.tempId === comp.tempId
                                  ? {
                                      ...c,
                                      weightPercent: Math.max(
                                        0,
                                        Number(e.target.value) || 0
                                      ),
                                    }
                                  : c
                              )
                            )
                          }
                          className="w-14 text-right text-xs font-bold tabular-nums bg-transparent text-zinc-900 dark:text-white focus:outline-none"
                        />
                        <span className="text-[11px] text-zinc-400">%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-[#2C2C2E] px-2.5 py-1.5 rounded-xl border border-black/[0.05] dark:border-white/[0.08]">
                      <span className="text-[11px] text-zinc-400">Réf. initiale</span>
                      <input
                        type="number"
                        min={0.01}
                        step="any"
                        value={comp.baseReferenceValue}
                        onChange={(e) =>
                          setComponents((prev) =>
                            prev.map((c) =>
                              c.tempId === comp.tempId
                                ? {
                                    ...c,
                                    baseReferenceValue: Math.max(
                                      0.01,
                                      Number(e.target.value) || 1
                                    ),
                                  }
                                : c
                            )
                          )
                        }
                        className="w-20 text-right text-xs font-bold tabular-nums bg-transparent text-zinc-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs font-semibold text-[#FF3B30]">{error}</p>}

        <div className="flex gap-2.5 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button
            type="submit"
            loading={saving}
            disabled={type === 'COMPOSITE' && !weightIsValid}
            className="flex-1"
          >
            <Check className="h-4 w-4" />
            Créer l’indice
          </Button>
        </div>
      </form>
    </Modal>
  );
}
