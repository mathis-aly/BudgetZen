'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Check, Store } from 'lucide-react';
import {
  TrackedProductDTO,
  formatCurrency,
  formatPercent,
  toISODateOnly,
} from '@/core';
import { Button, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';

export function PriceEntryModal({
  product,
  latestPrice,
  recentStores,
  currency = 'EUR',
  onClose,
  onSaved,
}: {
  product: TrackedProductDTO | null;
  latestPrice: number;
  recentStores: string[];
  currency?: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [priceStr, setPriceStr] = useState('');
  const [store, setStore] = useState('');
  const [dateStr, setDateStr] = useState(() => toISODateOnly(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    setPriceStr(latestPrice > 0 ? String(latestPrice) : '');
    const lastStore =
      product.entries.length > 0
        ? product.entries[product.entries.length - 1].store ?? ''
        : '';
    setStore(lastStore);
    setDateStr(toISODateOnly(new Date()));
    setError(null);
  }, [product, latestPrice]);

  if (!product) return null;

  const parsedPrice = Number(priceStr.replace(',', '.').trim());
  const isValid = Number.isFinite(parsedPrice) && parsedPrice > 0;
  const delta = isValid && latestPrice > 0 ? parsedPrice - latestPrice : 0;
  const deltaPct =
    isValid && latestPrice > 0 ? ((parsedPrice - latestPrice) / latestPrice) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError('Saisissez un prix supérieur à 0 €.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/price-tracker/${product.id}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: parsedPrice,
          store: store.trim() || null,
          recordedAt: new Date(`${dateStr}T12:00:00`).toISOString(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Impossible d'enregistrer ce relevé.");
      }

      await onSaved(
        `Relevé de ${formatCurrency(parsedPrice, currency)} ajouté pour « ${product.name} »`
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
      open={Boolean(product)}
      onClose={onClose}
      title="Relever un prix"
      subtitle={`${product.name} · ${product.unit}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] p-4 text-center space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Prix constaté ({currency})
          </p>
          <div className="flex items-baseline justify-center gap-1.5">
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              placeholder="0,00"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-40 text-center text-3xl font-bold tabular-nums bg-transparent text-zinc-900 dark:text-white focus:outline-none"
            />
            <span className="text-xl font-semibold text-zinc-400">€</span>
          </div>

          {latestPrice > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              Dernier relevé : {formatCurrency(latestPrice, currency)}
              {isValid && Math.abs(delta) > 0.001 && (
                <span
                  className={cn(
                    'ml-2 font-semibold',
                    delta > 0
                      ? 'text-[#FF3B30] dark:text-[#FF453A]'
                      : 'text-[#34C759] dark:text-[#30D158]'
                  )}
                >
                  ({delta > 0 ? '+' : ''}
                  {formatPercent(deltaPct, 1)})
                </span>
              )}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="price-store"
              className="flex items-center gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              <Store className="h-3.5 w-3.5" />
              Enseigne (optionnel)
            </label>
            <input
              id="price-store"
              type="text"
              placeholder="Ex : Carrefour, Monoprix…"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
            />
          </div>

          <div>
            <label
              htmlFor="price-date"
              className="flex items-center gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              Date du relevé
            </label>
            <input
              id="price-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
            />
          </div>
        </div>

        {recentStores.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recentStores.slice(0, 5).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStore(s)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
                  store === s
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/[0.14]'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-xs font-semibold text-[#FF3B30]">{error}</p>}

        <div className="flex gap-2.5 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button type="submit" loading={saving} className="flex-1">
            <Check className="h-4 w-4" />
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
