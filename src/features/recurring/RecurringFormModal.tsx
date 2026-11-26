'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Calendar, Check } from 'lucide-react';
import {
  CategoryDTO,
  RecurringPaymentDTO,
  TransactionType,
  getRecurringType,
} from '@/core';
import { Button, CategoryIcon, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';

export function RecurringFormModal({
  open,
  onClose,
  categories,
  editingPayment,
  initialType = 'EXPENSE',
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryDTO[];
  editingPayment: RecurringPaymentDTO | null;
  initialType?: TransactionType;
  onSaved: (message: string) => Promise<void>;
}) {
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [isTaxable, setIsTaxable] = useState(true);
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState(5);
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    const active = categories.filter((c) => !c.isArchived);
    const matched = active.filter((c) => c.type === type);
    return matched.length > 0 ? matched : active;
  }, [categories, type]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingPayment) {
      const editType = getRecurringType(editingPayment);
      setType(editType);
      setIsTaxable(editingPayment.isTaxable !== false);
      setTitle(editingPayment.title);
      setAmountStr(String(editingPayment.amount));
      setDayOfMonth(editingPayment.dayOfMonth);
      setCategoryId(editingPayment.categoryId);
      setNote(editingPayment.note ?? '');
    } else {
      const nextType = initialType;
      setType(nextType);
      setIsTaxable(true);
      setTitle('');
      setAmountStr('');
      setDayOfMonth(nextType === 'INCOME' ? 1 : 5);
      const active = categories.filter((c) => !c.isArchived);
      const matched = active.filter((c) => c.type === nextType);
      setCategoryId(matched[0]?.id ?? active[0]?.id ?? '');
      setNote('');
    }
  }, [open, editingPayment, initialType, categories]);

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType);
    const active = categories.filter((c) => !c.isArchived);
    const matched = active.filter((c) => c.type === nextType);
    if (matched.length > 0 && !matched.some((c) => c.id === categoryId)) {
      setCategoryId(matched[0].id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(amountStr.replace(',', '.').trim());
    if (!title.trim()) {
      setError(
        type === 'INCOME'
          ? 'Indiquez le libellé du revenu fixe.'
          : 'Indiquez le nom de la charge fixe.'
      );
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
          type,
          isTaxable: type === 'INCOME' ? isTaxable : true,
          dayOfMonth,
          categoryId,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Impossible de sauvegarder.');
      }

      const kindLabel = type === 'INCOME' ? 'Entrée fixe' : 'Charge fixe';
      await onSaved(
        editingPayment
          ? `${kindLabel} « ${title.trim()} » modifiée`
          : `${kindLabel} « ${title.trim()} » ajoutée`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setSaving(false);
    }
  };

  const isIncome = type === 'INCOME';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        editingPayment
          ? isIncome
            ? "Modifier l'entrée fixe"
            : 'Modifier la charge fixe'
          : isIncome
            ? 'Nouvelle entrée fixe'
            : 'Nouvelle charge fixe'
      }
      subtitle={
        isIncome
          ? 'Intégrée dans votre projection de fin de mois, la réserve, les projets et la fiscalité'
          : 'Provisionnée automatiquement dans le calcul prudent de votre Reste à vivre'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Direction Switcher: Sortie fixe (-) vs Entrée fixe (+) */}
        <div className="grid grid-cols-2 rounded-sm border border-[#E2E0D8] dark:border-[#2A2A27] overflow-hidden">
          <button
            type="button"
            onClick={() => handleTypeChange('EXPENSE')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2 px-3 font-mono text-xs transition-colors',
              !isIncome
                ? 'bg-[#141413] text-[#F7F6F2] dark:bg-[#F2F0E8] dark:text-[#111110] font-semibold'
                : 'bg-[#FCFBF9] dark:bg-[#141413] text-[#5C5B57] dark:text-[#9A9890]'
            )}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Sortie fixe (−)</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('INCOME')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2 px-3 font-mono text-xs border-l border-[#E2E0D8] dark:border-[#2A2A27] transition-colors',
              isIncome
                ? 'bg-[#15803D] text-[#F7F6F2] dark:bg-[#22C55E] dark:text-[#111110] font-semibold'
                : 'bg-[#FCFBF9] dark:bg-[#141413] text-[#5C5B57] dark:text-[#9A9890]'
            )}
          >
            <ArrowDownLeft className="h-3.5 w-3.5" />
            <span>Entrée fixe (+)</span>
          </button>
        </div>

        <div>
          <label htmlFor="rec-title" className="editorial-kicker block mb-1.5">
            Intitulé
          </label>
          <input
            id="rec-title"
            type="text"
            placeholder={
              isIncome
                ? 'Ex : Salaire net, APL, Rente, Pension…'
                : 'Ex : Loyer, Assurance auto, iCloud+…'
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-10 px-3 rounded-sm bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] text-sm text-[#141413] dark:text-[#F2F0E8] focus:outline-none focus:border-[#141413] dark:focus:border-[#F2F0E8]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="rec-amount"
              className="editorial-kicker block mb-1.5"
            >
              Montant mensuel (€)
            </label>
            <input
              id="rec-amount"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amountStr}
              onChange={(e) =>
                setAmountStr(e.target.value.replace(/[^0-9.,]/g, ''))
              }
              className="w-full h-10 px-3 rounded-sm bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] font-mono text-sm font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] focus:outline-none focus:border-[#141413] dark:focus:border-[#F2F0E8]"
            />
          </div>

          <div>
            <label
              htmlFor="rec-day"
              className="editorial-kicker flex items-center gap-1 mb-1.5"
            >
              <Calendar className="h-3 w-3" />
              {isIncome ? "Jour d'encaissement" : 'Jour de prélèvement'}
            </label>
            <input
              id="rec-day"
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) =>
                setDayOfMonth(
                  Math.min(31, Math.max(1, Number(e.target.value) || 1))
                )
              }
              className="w-full h-10 px-3 rounded-sm bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] font-mono text-sm font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] focus:outline-none focus:border-[#141413] dark:focus:border-[#F2F0E8]"
            />
          </div>
        </div>

        {/* Taxable Income Option (only for fixed INCOME) */}
        {isIncome && (
          <label
            htmlFor="rec-taxable"
            className="flex items-start gap-2.5 p-3 rounded-sm border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413] cursor-pointer"
          >
            <input
              id="rec-taxable"
              type="checkbox"
              checked={isTaxable}
              onChange={(e) => setIsTaxable(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#15803D] dark:accent-[#22C55E] rounded-[2px]"
            />
            <div className="space-y-0.5">
              <span className="font-mono text-xs font-semibold text-[#141413] dark:text-[#F2F0E8] block">
                Revenu imposable
              </span>
              <span className="text-[11px] text-[#5C5B57] dark:text-[#9A9890] leading-snug block">
                Cochez pour les salaires, rentes ou pensions ; décochez pour
                les revenus exonérés (APL, bourses, aides sociales).
              </span>
            </div>
          </label>
        )}

        <div>
          <label className="editorial-kicker block mb-2">
            Catégorie associée
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {filteredCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-sm border text-left transition-colors',
                  categoryId === cat.id
                    ? 'border-[#141413] dark:border-[#F2F0E8] bg-[#141413]/[0.05] dark:bg-[#F2F0E8]/[0.08]'
                    : 'border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FFFFFF] dark:bg-[#181816]'
                )}
              >
                <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                <span className="text-xs font-medium text-[#141413] dark:text-[#F2F0E8] truncate">
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="rec-note" className="editorial-kicker block mb-1.5">
            Note (optionnel)
          </label>
          <input
            id="rec-note"
            type="text"
            placeholder={isIncome ? 'Ex : Virement employeur' : 'Ex : Prélèvement SEPA'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full h-10 px-3 rounded-sm bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] text-sm text-[#141413] dark:text-[#F2F0E8] focus:outline-none focus:border-[#141413] dark:focus:border-[#F2F0E8]"
          />
        </div>

        {error && (
          <p className="font-mono text-xs font-semibold text-[#B91C1C] dark:text-[#EF4444]">
            {error}
          </p>
        )}

        <div className="flex gap-2.5 pt-2 border-t border-[#E2E0D8] dark:border-[#2A2A27]">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
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
