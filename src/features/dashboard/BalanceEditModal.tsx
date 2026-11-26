'use client';

import React, { useEffect, useState } from 'react';
import { Check, Landmark } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { formatCurrency } from '@/core';

export function BalanceEditModal({
  open,
  onClose,
  currentBalance,
  accountName,
  currency = 'EUR',
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  currentBalance: number;
  accountName: string;
  currency?: string;
  onSaved: (message: string) => Promise<void>;
}) {
  const [name, setName] = useState(accountName);
  const [balanceStr, setBalanceStr] = useState(String(currentBalance));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(accountName);
    setBalanceStr(String(currentBalance));
    setError(null);
  }, [open, accountName, currentBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(balanceStr.replace(',', '.').trim());
    if (!Number.isFinite(parsed)) {
      setError('Veuillez saisir un montant valide.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName: name.trim() || 'Compte Courant',
          currentBalance: parsed,
        }),
      });
      if (!res.ok) throw new Error('Erreur lors de la mise à jour.');

      await onSaved(`Solde ajusté à ${formatCurrency(parsed, currency)}`);
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
      title="Ajuster le solde actuel"
      subtitle="Recalibrez votre solde bancaire réel à tout moment"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="account-name"
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
          >
            <Landmark className="h-3.5 w-3.5" />
            Nom du compte
          </label>
          <input
            id="account-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
          />
        </div>

        <div>
          <label
            htmlFor="current-balance-input"
            className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
          >
            Solde bancaire actuel ({currency})
          </label>
          <input
            id="current-balance-input"
            type="text"
            inputMode="decimal"
            value={balanceStr}
            onChange={(e) => setBalanceStr(e.target.value.replace(/[^0-9.,-]/g, ''))}
            className="w-full h-12 px-4 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-xl font-bold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
          />
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
            Votre « Reste à vivre » sera recalculé automatiquement en déduisant vos charges fixes restantes.
          </p>
        </div>

        {error && <p className="text-xs font-semibold text-[#FF3B30]">{error}</p>}

        <div className="flex gap-2.5 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button type="submit" loading={saving} className="flex-1">
            <Check className="h-4 w-4" />
            Valider
          </Button>
        </div>
      </form>
    </Modal>
  );
}
