'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import { CategoryDTO, RecurringPaymentDTO } from '@/core';
import { Button, CategoryIcon, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';

export function RecurringFormModal({
  open,
  onClose,
  categories,
  editingPayment,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryDTO[];
  editingPayment: RecurringPaymentDTO | null;
  onSaved: (message: string) => Promise<void>;
}) {
  const expenseCategories = useMemo(
    () => categories.filter((c) => !c.isArchived && c.type === 'EXPENSE'),
    [categories]
  );

  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState(5);
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingPayment) {
      setTitle(editingPayment.title);
      setAmountStr(String(editingPayment.amount));
      setDayOfMonth(editingPayment.dayOfMonth);
      setCategoryId(editingPayment.categoryId);
      setNote(editingPayment.note ?? '');
    } else {
      setTitle('');
      setAmountStr('');
      setDayOfMonth(5);
      setCategoryId(expenseCategories[0]?.id ?? '');
      setNote('');
    }
  }, [open, editingPayment, expenseCategories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(amountStr.replace(',', '.').trim());
    if (!title.trim()) {
      setError('Indiquez le nom de la charge fixe.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Indiquez un montant supérieur à 0 €.');
      return;
    }
    if (!categoryId) {
      setError('Choisissez une catégorie.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const url = editingPayment
        ? `/api/recurring/${editingPayment.id}`
        : '/api/recurring';
      const method = editingPayment ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          amount,
          dayOfMonth,
          categoryId,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Impossible de sauvegarder.');
      }

      await onSaved(
        editingPayment
          ? `Charge « ${title.trim()} » modifiée`
          : `Charge fixe « ${title.trim()} » ajoutée`
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
      title={editingPayment ? 'Modifier la charge fixe' : 'Nouvelle charge fixe'}
      subtitle="Provisionnée automatiquement dans le calcul de votre Reste à vivre"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="rec-title"
            className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
          >
            Intitulé
          </label>
          <input
            id="rec-title"
            type="text"
            placeholder="Ex : Loyer, Assurance auto, iCloud+…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="rec-amount"
              className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              Montant mensuel (€)
            </label>
            <input
              id="rec-amount"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm font-semibold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
            />
          </div>

          <div>
            <label
              htmlFor="rec-day"
              className="flex items-center gap-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              Jour de prélèvement
            </label>
            <input
              id="rec-day"
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) =>
                setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))
              }
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-[#2C2C2E] text-sm font-semibold tabular-nums text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">
            Catégorie associée
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {expenseCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-2xl border text-left transition-all',
                  categoryId === cat.id
                    ? 'border-[#007AFF] bg-[#007AFF]/[0.08] dark:border-[#0A84FF] dark:bg-[#0A84FF]/[0.16]'
                    : 'border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#2C2C2E]/60'
                )}
              >
                <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="rec-note"
            className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
          >
            Note (optionnel)
          </label>
          <input
            id="rec-note"
            type="text"
            placeholder="Ex : Prélèvement SEPA"
            value={note}
            onChange={(e) => setNote(e.target.value)}
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
            {editingPayment ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
