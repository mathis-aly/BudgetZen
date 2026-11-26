'use client';

import React, { useEffect, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { WealthAssetDTO, formatCurrency } from '@/core';
import { Button, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';

export function UpdateValueModal({
  asset,
  currency = 'EUR',
  onClose,
  onSaved,
}: {
  asset: WealthAssetDTO | null;
  currency?: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [valueStr, setValueStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!asset) return;
    setValueStr(String(asset.currentValue));
    setError(null);
  }, [asset]);

  if (!asset) return null;

  const parsedValue = Number(valueStr.replace(',', '.').trim());
  const isValid = Number.isFinite(parsedValue) && parsedValue >= 0;
  const delta = isValid ? parsedValue - asset.currentValue : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError('Saisissez une valeur numérique positive.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/wealth/${asset.id}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parsedValue }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Impossible de mettre à jour la valeur.');
      }

      await onSaved(
        `« ${asset.name} » actualisé à ${formatCurrency(parsedValue, currency)}`
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
      open={Boolean(asset)}
      onClose={onClose}
      title="Actualiser la valeur"
      subtitle={`${asset.name} · enregistre un nouveau point d'historique`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] p-4 text-center space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Nouveau solde constaté ({currency})
          </p>
          <div className="flex items-baseline justify-center gap-1.5">
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-48 text-center text-3xl font-bold tabular-nums bg-transparent text-zinc-900 dark:text-white focus:outline-none"
            />
            <span className="text-xl font-semibold text-zinc-400">€</span>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            Valeur précédente : {formatCurrency(asset.currentValue, currency)}
            {isValid && Math.abs(delta) > 0.001 && (
              <span
                className={cn(
                  'ml-2 font-semibold',
                  delta > 0
                    ? 'text-[#34C759] dark:text-[#30D158]'
                    : 'text-[#FF3B30] dark:text-[#FF453A]'
                )}
              >
                ({formatCurrency(delta, currency, { showSign: true })})
              </span>
            )}
          </p>
        </div>

        {error && <p className="text-xs font-semibold text-[#FF3B30]">{error}</p>}

        <div className="flex gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button type="submit" loading={saving} className="flex-1">
            <RefreshCw className="h-4 w-4" />
            Enregistrer le relevé
          </Button>
        </div>
      </form>
    </Modal>
  );
}
