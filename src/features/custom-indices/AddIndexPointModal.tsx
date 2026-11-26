'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import { CustomIndexDTO, toISODateOnly } from '@/core';
import { Button, Modal } from '@/components/ui';

export function AddIndexPointModal({
  index,
  suggestedValue,
  onClose,
  onSaved,
}: {
  index: CustomIndexDTO | null;
  suggestedValue: number;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [valueStr, setValueStr] = useState('');
  const [dateStr, setDateStr] = useState(() => toISODateOnly(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!index) return;
    setValueStr(String(suggestedValue));
    setDateStr(toISODateOnly(new Date()));
    setError(null);
  }, [index, suggestedValue]);

  if (!index) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(valueStr.replace(',', '.').trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Saisissez une valeur numérique positive.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/custom-indices/${index.id}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: parsed,
          recordedAt: new Date(`${dateStr}T12:00:00`).toISOString(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Impossible d'enregistrer ce relevé.");
      }

      await onSaved(
        `Point ${parsed.toFixed(1).replace('.', ',')} pts ajouté à « ${index.name} »`
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
      open={Boolean(index)}
      onClose={onClose}
      title="Saisir une valeur d'indice"
      subtitle={`${index.name} · Base ${index.baseValue} pts`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] p-4 text-center space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Valeur de l’indice (points)
          </p>
          <div className="flex items-baseline justify-center gap-1.5">
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-40 text-center text-3xl font-bold tabular-nums bg-transparent text-zinc-900 dark:text-white focus:outline-none"
            />
            <span className="text-lg font-semibold text-zinc-400">pts</span>
          </div>
        </div>

        <div>
          <label
            htmlFor="idx-point-date"
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
          >
            <Calendar className="h-3.5 w-3.5" />
            Date du relevé
          </label>
          <input
            id="idx-point-date"
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none"
          />
        </div>

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
