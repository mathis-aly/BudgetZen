'use client';

import React, { useMemo, useState } from 'react';
import {
  Pencil,
  Repeat,
  Search,
  Trash2,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import {
  CategoryDTO,
  TransactionDTO,
  formatCurrency,
  formatDateShort,
  formatMonthLabel,
  formatTransactionsCSV,
  getMonthKey,
} from '@/core';
import {
  Badge,
  Button,
  Card,
  CategoryIcon,
  ExportCsvButton,
  ImportCsvModal,
  SectionHeader,
} from '@/components/ui';
import { cn } from '@/lib/cn';

export function TransactionsView({
  transactions,
  categories,
  selectedMonthKey,
  currency = 'EUR',
  onEdit,
  onDelete,
  onImported,
  onNotify,
}: {
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  selectedMonthKey: string;
  currency?: string;
  onEdit: (tx: TransactionDTO) => void;
  onDelete: (tx: TransactionDTO) => Promise<void>;
  onImported: (message: string) => Promise<void>;
  onNotify?: (message: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [scopeAllMonths, setScopeAllMonths] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (!scopeAllMonths && getMonthKey(new Date(tx.date)) !== selectedMonthKey) {
        return false;
      }
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (categoryFilter !== 'ALL' && tx.categoryId !== categoryFilter) return false;
      if (q) {
        const catName = categoryMap.get(tx.categoryId)?.name.toLowerCase() ?? '';
        const noteStr = (tx.note ?? '').toLowerCase();
        if (!catName.includes(q) && !noteStr.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, selectedMonthKey, scopeAllMonths, typeFilter, categoryFilter, search, categoryMap]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filtered) {
      if (tx.type === 'INCOME') income += tx.amount;
      else expense += tx.amount;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  const handleDelete = async (tx: TransactionDTO) => {
    setDeletingId(tx.id);
    try {
      await onDelete(tx);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Historique des transactions"
        subtitle={
          scopeAllMonths
            ? `${filtered.length} opération(s) sur toute la période`
            : `${filtered.length} opération(s) · ${formatMonthLabel(selectedMonthKey)}`
        }
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setImportModalOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              Importer un CSV
            </Button>
            <ExportCsvButton
              label="Exporter en CSV"
              filenamePrefix={
                scopeAllMonths ? 'transactions_complet' : `transactions_${selectedMonthKey}`
              }
              disabled={filtered.length === 0}
              getCsvContent={() => formatTransactionsCSV(filtered, categories)}
              onExported={(file) =>
                onNotify?.(`Export CSV téléchargé (${filtered.length} opérations · ${file})`)
              }
            />
            <Button
              variant={scopeAllMonths ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setScopeAllMonths((v) => !v)}
            >
              {scopeAllMonths ? 'Mois en cours' : 'Tout l’historique'}
            </Button>
          </div>
        }
      />

      {/* Quick Summary Pills */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="p-3 sm:p-4">
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Entrées</p>
          <p className="text-base sm:text-lg font-bold tabular-nums text-[#34C759] dark:text-[#30D158] mt-0.5">
            {formatCurrency(totals.income, currency, { showSign: true })}
          </p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Sorties</p>
          <p className="text-base sm:text-lg font-bold tabular-nums text-zinc-900 dark:text-white mt-0.5">
            {formatCurrency(-totals.expense, currency)}
          </p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Solde filtré</p>
          <p
            className={cn(
              'text-base sm:text-lg font-bold tabular-nums mt-0.5',
              totals.net >= 0
                ? 'text-[#34C759] dark:text-[#30D158]'
                : 'text-[#FF3B30] dark:text-[#FF453A]'
            )}
          >
            {formatCurrency(totals.net, currency, { showSign: true })}
          </p>
        </Card>
      </div>

      {/* Filters Card */}
      <Card className="p-3.5 space-y-3">
        <div className="relative">
          <Search className="h-4 w-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par note ou catégorie…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-zinc-100/90 dark:bg-[#2C2C2E] text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-0.5 rounded-xl bg-zinc-100 dark:bg-white/[0.08]">
            {(['ALL', 'EXPENSE', 'INCOME'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  typeFilter === t
                    ? 'bg-white dark:bg-[#2C2C2E] text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400'
                )}
              >
                {t === 'ALL' ? 'Tout' : t === 'EXPENSE' ? 'Dépenses' : 'Revenus'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filtrer par catégorie"
              className="w-full h-8 px-2.5 rounded-xl bg-zinc-100 dark:bg-[#2C2C2E] text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="ALL">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Transactions List */}
      <Card padded={false} className="overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.07]">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Aucune transaction ne correspond à vos filtres.
            </p>
          </div>
        ) : (
          filtered.map((tx) => {
            const cat = categoryMap.get(tx.categoryId);
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-zinc-50/80 dark:hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CategoryIcon
                    icon={cat?.icon ?? 'Tag'}
                    color={cat?.color ?? '#007AFF'}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                        {tx.note || cat?.name || 'Transaction'}
                      </p>
                      {tx.recurringPaymentId && (
                        <Badge tone="blue" className="px-1.5 py-0 text-[10px]">
                          <Repeat className="h-2.5 w-2.5" />
                          Fixe
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {cat?.name ?? 'Autre'} · {formatDateShort(tx.date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      tx.type === 'INCOME'
                        ? 'text-[#34C759] dark:text-[#30D158]'
                        : 'text-zinc-900 dark:text-white'
                    )}
                  >
                    {tx.type === 'INCOME'
                      ? formatCurrency(tx.amount, currency, { showSign: true })
                      : formatCurrency(-tx.amount, currency)}
                  </span>

                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onEdit(tx)}
                      aria-label="Modifier"
                      className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === tx.id}
                      onClick={() => handleDelete(tx)}
                      aria-label="Supprimer"
                      className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Card>

      <ImportCsvModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        categories={categories}
        transactions={transactions}
        currency={currency}
        onImported={onImported}
      />
    </div>
  );
}
