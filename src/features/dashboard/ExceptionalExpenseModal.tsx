'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Check, FileText, ShieldAlert } from 'lucide-react';
import { formatCurrency, toISODateOnly } from '@/core';
import { Button, Modal } from '@/components/ui';

export function ExceptionalExpenseModal({
  open,
  onClose,
  reserveRemaining,
  currency = 'EUR',
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  reserveRemaining: number;
  currency?: string;
  onSaved: (message: string) => Promise<void>;
}) {
  const [amountStr, setAmountStr] = useState('');
  const [dateStr, setDateStr] = useState(() => toISODateOnly(new Date()));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmountStr('');
    setDateStr(toISODateOnly(new Date()));
    setNote('');
    setError(null);
  }, [open]);

  const parsedAmount = Number(amountStr.replace(',', '.').trim()) || 0;
  const remainingAfter = Math.max(0, reserveRemaining - parsedAmount);
  const overflow = Math.max(0, parsedAmount - reserveRemaining);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Indiquez un montant supérieur à 0 €.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/reserve-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parsedAmount,
          date: new Date(`${dateStr}T12:00:00`).toISOString(),
          note: note.trim() || 'Dépense exceptionnelle',
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Impossible d'enregistrer cette dépense.");
      }

      await onSaved(
        `Imprévu de ${formatCurrency(parsedAmount, currency)} puisé dans le bouclier`
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
      title="Dépense exceptionnelle"
      subtitle="Puise dans votre Bouclier Imprévus sans déclencher d'alerte sur vos catégories"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl bg-[#34C759]/[0.08] dark:bg-[#30D158]/[0.12] border border-[#34C759]/25 p-3.5 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-[#1E8E3E] dark:text-[#30D158]">
            <ShieldAlert className="h-4 w-4" />
            Bouclier disponible ce mois :{' '}
            <span className="tabular-nums">
              {formatCurrency(reserveRemaining, currency)}
            </span>
          </div>
          {parsedAmount > 0 && (
            <p className="text-zinc-600 dark:text-zinc-300 tabular-nums">
              {overflow > 0 ? (
                <>
                  Bouclier épuisé ·{' '}
                  <strong className="text-[#FF9500]">
                    {formatCurrency(overflow, currency)}
                  </strong>{' '}
                  seront déduits de votre reste à vivre.
                </>
              ) : (
                <>
                  Après cet imprévu, il restera{' '}
                  <strong>{formatCurrency(remainingAfter, currency)}</strong> dans votre
                  bouclier. Vos plafonds mensuels restent intacts.
                </>
              )}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="res-amount"
            className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
          >
            Montant de l’imprévu ({currency})
          </label>
          <input
            id="res-amount"
            type="text"
            inputMode="decimal"
            autoFocus
            placeholder="0"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.,]/g, ''))}
            className="w-full h-12 px-4 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-xl font-bold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#34C759]/50"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="res-date"
              className="flex items-center gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              Date
            </label>
            <input
              id="res-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="res-note"
              className="flex items-center gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              Motif
            </label>
            <input
              id="res-note"
              type="text"
              placeholder="Ex : Réparation auto, serrurier…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none"
            />
          </div>
        </div>

        {error && <p className="text-xs font-semibold text-[#FF3B30]">{error}</p>}

        <div className="flex gap-2.5 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button type="submit" variant="success" loading={saving} className="flex-1">
            <Check className="h-4 w-4" />
            Puiser dans la réserve
          </Button>
        </div>
      </form>
    </Modal>
  );
}
