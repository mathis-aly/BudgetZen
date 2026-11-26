'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  FileText,
  Sparkles,
} from 'lucide-react';
import {
  CategoryDTO,
  TransactionDTO,
  TransactionType,
  formatCurrency,
  getMonthKey,
  previewTransactionImpact,
  toISODateOnly,
} from '@/core';
import {
  AlertStatusBadge,
  Button,
  CategoryIcon,
  Modal,
  ProgressBar,
} from '@/components/ui';
import { cn } from '@/lib/cn';

const QUICK_AMOUNTS = [10, 20, 35, 50, 100];

export function QuickAddModal({
  open,
  onClose,
  categories,
  transactions,
  currentResteAVivre,
  currency = 'EUR',
  editingTransaction,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  currentResteAVivre: number;
  currency?: string;
  editingTransaction?: TransactionDTO | null;
  onSaved: (message: string) => Promise<void>;
}) {
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [dateStr, setDateStr] = useState(() => toISODateOnly(new Date()));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  const availableCategories = useMemo(
    () => categories.filter((c) => !c.isArchived && c.type === type),
    [categories, type]
  );

  // Reset form and focus amount input reliably when opening (including via ⌘E / N)
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmountStr(String(editingTransaction.amount));
      setCategoryId(editingTransaction.categoryId);
      setDateStr(toISODateOnly(new Date(editingTransaction.date)));
      setNote(editingTransaction.note ?? '');
    } else {
      setType('EXPENSE');
      setAmountStr('');
      setDateStr(toISODateOnly(new Date()));
      setNote('');
      const firstExpense = categories.find((c) => !c.isArchived && c.type === 'EXPENSE');
      setCategoryId(firstExpense?.id ?? '');
    }
    const timer = window.setTimeout(() => {
      amountInputRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open, editingTransaction, categories]);

  // Ensure a valid category is selected when switching type
  useEffect(() => {
    if (!open) return;
    if (!availableCategories.some((c) => c.id === categoryId)) {
      setCategoryId(availableCategories[0]?.id ?? '');
    }
  }, [availableCategories, categoryId, open]);

  const parsedAmount = useMemo(() => {
    const normalized = amountStr.replace(',', '.').trim();
    const num = Number(normalized);
    return Number.isFinite(num) && num > 0 ? num : 0;
  }, [amountStr]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId]
  );

  // Real-time impact preview computed directly via src/core/budget.ts
  const impactPreview = useMemo(() => {
    if (!selectedCategory || type !== 'EXPENSE') return null;

    const targetMonthKey = dateStr ? dateStr.slice(0, 7) : getMonthKey(new Date());
    const currentCategorySpent = transactions
      .filter(
        (tx) =>
          tx.type === 'EXPENSE' &&
          tx.categoryId === selectedCategory.id &&
          getMonthKey(new Date(tx.date)) === targetMonthKey &&
          tx.id !== editingTransaction?.id
      )
      .reduce((sum, tx) => sum + tx.amount, 0);

    const effectiveResteAVivre =
      editingTransaction && editingTransaction.type === 'EXPENSE'
        ? currentResteAVivre + editingTransaction.amount
        : currentResteAVivre;

    return previewTransactionImpact({
      category: selectedCategory,
      currentCategorySpent,
      candidateAmount: parsedAmount,
      transactionType: type,
      currentResteAVivre: effectiveResteAVivre,
    });
  }, [
    selectedCategory,
    type,
    dateStr,
    transactions,
    parsedAmount,
    currentResteAVivre,
    editingTransaction,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      setError('Saisissez un montant supérieur à 0 €.');
      return;
    }
    if (!categoryId) {
      setError('Sélectionnez une catégorie.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        amount: parsedAmount,
        type,
        categoryId,
        date: new Date(`${dateStr}T12:00:00`).toISOString(),
        note: note.trim() || null,
      };

      const url = editingTransaction
        ? `/api/transactions/${editingTransaction.id}`
        : '/api/transactions';
      const method = editingTransaction ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur lors de la sauvegarde.');
      }

      await onSaved(
        editingTransaction
          ? 'Transaction mise à jour'
          : type === 'EXPENSE'
            ? `Dépense de ${formatCurrency(parsedAmount, currency)} ajoutée`
            : `Revenu de ${formatCurrency(parsedAmount, currency)} ajouté`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingTransaction ? 'Modifier la transaction' : 'Saisie rapide'}
      subtitle="Ajoutez une dépense ou un revenu en quelques secondes"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Segmented Control: Expense / Income */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-zinc-100 dark:bg-white/[0.08]">
          <button
            type="button"
            onClick={() => setType('EXPENSE')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all',
              type === 'EXPENSE'
                ? 'bg-white dark:bg-[#2C2C2E] text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400'
            )}
          >
            <ArrowUpRight className="h-4 w-4 text-[#FF3B30]" />
            Dépense
          </button>
          <button
            type="button"
            onClick={() => setType('INCOME')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all',
              type === 'INCOME'
                ? 'bg-white dark:bg-[#2C2C2E] text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400'
            )}
          >
            <ArrowDownLeft className="h-4 w-4 text-[#34C759]" />
            Revenu
          </button>
        </div>

        {/* Hero Amount Input */}
        <div className="rounded-2xl bg-zinc-50 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] p-4 text-center">
          <label
            htmlFor="quick-amount"
            className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1"
          >
            Montant ({currency})
          </label>
          <div className="flex items-baseline justify-center gap-1.5">
            <input
              ref={amountInputRef}
              id="quick-amount"
              type="text"
              inputMode="decimal"
              autoFocus
              placeholder="0"
              value={amountStr}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.,]/g, '');
                setAmountStr(val);
              }}
              className="w-44 text-center text-4xl font-bold tracking-tight tabular-nums bg-transparent text-zinc-900 dark:text-white focus:outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
            />
            <span className="text-2xl font-semibold text-zinc-400">€</span>
          </div>

          {/* Quick tap amounts for thumb ergonomics */}
          <div className="flex items-center justify-center flex-wrap gap-1.5 mt-3">
            {QUICK_AMOUNTS.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmountStr(String(val))}
                className="px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums bg-white dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] text-zinc-700 dark:text-zinc-200 hover:border-[#007AFF] active:scale-95 transition-all"
              >
                {val} €
              </button>
            ))}
          </div>
        </div>

        {/* Real-Time Impact Preview Card (Required MVP Feature #2) */}
        {impactPreview && impactPreview.monthlyLimit > 0 && (
          <div
            className={cn(
              'rounded-2xl p-3.5 border transition-all duration-300',
              impactPreview.projectedStatus === 'red'
                ? 'bg-[#FF3B30]/[0.07] border-[#FF3B30]/30 dark:bg-[#FF453A]/[0.12] dark:border-[#FF453A]/35'
                : impactPreview.projectedStatus === 'orange'
                  ? 'bg-[#FF9500]/[0.08] border-[#FF9500]/30 dark:bg-[#FF9F0A]/[0.12] dark:border-[#FF9F0A]/35'
                  : 'bg-[#34C759]/[0.07] border-[#34C759]/25 dark:bg-[#30D158]/[0.1] dark:border-[#30D158]/30'
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                {impactPreview.projectedStatus === 'red' ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-[#FF3B30] dark:text-[#FF453A] shrink-0" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-[#007AFF] dark:text-[#0A84FF] shrink-0" />
                )}
                <span>
                  {parsedAmount > 0 ? 'Après cette dépense : ' : 'Plafond actuel : '}
                  <strong className="tabular-nums">
                    {formatCurrency(impactPreview.projectedSpent, currency)} /{' '}
                    {formatCurrency(impactPreview.monthlyLimit, currency)}
                  </strong>
                </span>
              </div>
              <AlertStatusBadge
                status={impactPreview.projectedStatus}
                usagePercent={impactPreview.projectedPercent}
              />
            </div>

            <ProgressBar
              value={impactPreview.projectedPercent}
              status={impactPreview.projectedStatus}
              markerPercent={selectedCategory?.alertThreshold ?? 80}
              height="sm"
            />

            <div className="flex items-center justify-between mt-2 text-[11px] text-zinc-600 dark:text-zinc-300 tabular-nums">
              <span>
                {impactPreview.willExceedLimit ? (
                  <span className="font-semibold text-[#D70015] dark:text-[#FF453A]">
                    Dépassement de {formatCurrency(impactPreview.exceededBy, currency)}
                  </span>
                ) : (
                  <>
                    Reste sur {impactPreview.categoryName} :{' '}
                    <strong>{formatCurrency(impactPreview.remainingAfter, currency)}</strong>
                  </>
                )}
              </span>
              {parsedAmount > 0 && (
                <span>
                  Reste à vivre :{' '}
                  <strong
                    className={cn(
                      impactPreview.projectedResteAVivre < 0
                        ? 'text-[#FF3B30]'
                        : 'text-zinc-900 dark:text-white'
                    )}
                  >
                    {formatCurrency(impactPreview.projectedResteAVivre, currency)}
                  </strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Category Picker Grid */}
        <div>
          <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">
            Catégorie
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-0.5">
            {availableCategories.map((cat) => {
              const selected = cat.id === categoryId;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-2xl border text-left transition-all active:scale-[0.98]',
                    selected
                      ? 'border-[#007AFF] bg-[#007AFF]/[0.08] dark:border-[#0A84FF] dark:bg-[#0A84FF]/[0.16]'
                      : 'border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#2C2C2E]/60 hover:border-black/15'
                  )}
                >
                  <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                  <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date & Note row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="quick-date"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              Date
            </label>
            <input
              id="quick-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100/90 dark:bg-[#2C2C2E] border border-transparent focus:border-[#007AFF] text-sm text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="quick-note"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              Note (optionnel)
            </label>
            <input
              id="quick-note"
              type="text"
              placeholder="Ex : Déjeuner, Monoprix…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100/90 dark:bg-[#2C2C2E] border border-transparent focus:border-[#007AFF] text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs font-semibold text-[#FF3B30] dark:text-[#FF453A] px-1">
            {error}
          </p>
        )}

        <div className="flex gap-2.5 pt-1">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onClose}
            className="flex-1 sm:flex-none sm:w-32"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            variant={type === 'INCOME' ? 'success' : 'primary'}
            size="lg"
            loading={submitting}
            className="flex-1"
          >
            <Check className="h-4 w-4" />
            {editingTransaction
              ? 'Enregistrer'
              : type === 'EXPENSE'
                ? 'Ajouter la dépense'
                : 'Ajouter le revenu'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
