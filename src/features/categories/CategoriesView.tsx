'use client';

import React, { useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
} from 'lucide-react';
import {
  CategoryBudgetStatus,
  CategoryDTO,
  formatCurrency,
  formatPercent,
} from '@/core';
import {
  AlertStatusBadge,
  Badge,
  Button,
  Card,
  CategoryIcon,
  ProgressBar,
  SectionHeader,
} from '@/components/ui';
import { CategoryFormModal } from './CategoryFormModal';

export function CategoriesView({
  categories,
  categoryStatuses,
  currency = 'EUR',
  onChanged,
}: {
  categories: CategoryDTO[];
  categoryStatuses: CategoryBudgetStatus[];
  currency?: string;
  onChanged: (message: string) => Promise<void>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryDTO | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const incomeCategories = categories.filter((c) => !c.isArchived && c.type === 'INCOME');
  const archivedCategories = categories.filter((c) => c.isArchived);

  const totalBudget = categoryStatuses.reduce((sum, s) => sum + s.monthlyLimit, 0);
  const totalSpent = categoryStatuses.reduce((sum, s) => sum + s.spent, 0);
  const overallPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const handleToggleArchive = async (cat: CategoryDTO) => {
    setArchivingId(cat.id);
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !cat.isArchived }),
      });
      if (!res.ok) throw new Error();
      await onChanged(
        cat.isArchived
          ? `Catégorie « ${cat.name} » restaurée`
          : `Catégorie « ${cat.name} » archivée`
      );
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Catégories & Plafonds"
        subtitle="Définissez vos budgets mensuels et vos seuils d'alerte progressifs"
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle catégorie
          </Button>
        }
      />

      {/* Global Budget Envelope Summary */}
      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Enveloppe globale des plafonds actifs
            </p>
            <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-white mt-0.5">
              {formatCurrency(totalSpent, currency)}{' '}
              <span className="text-sm font-medium text-zinc-400">
                / {formatCurrency(totalBudget, currency)}
              </span>
            </p>
          </div>
          <Badge
            tone={
              overallPercent >= 100
                ? 'red'
                : overallPercent >= 80
                  ? 'orange'
                  : 'green'
            }
          >
            {formatPercent(overallPercent)} consommés
          </Badge>
        </div>

        <ProgressBar
          value={overallPercent}
          status={
            overallPercent >= 100
              ? 'red'
              : overallPercent >= 80
                ? 'orange'
                : 'green'
          }
          markerPercent={80}
          height="md"
        />

        {/* Legend of 3 progressive visual states */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#34C759]" />
            Vert (&lt; seuil)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#FF9500]" />
            Orange (seuil – 99%)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#FF3B30]" />
            Rouge (≥ 100% · dépassement)
          </span>
        </div>
      </Card>

      {/* Active Expense Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {categoryStatuses.map((item) => (
          <Card key={item.category.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <CategoryIcon
                  icon={item.category.icon}
                  color={item.category.color}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {item.category.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {item.transactionCount} opération(s) · seuil {item.category.alertThreshold}%
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(item.category);
                    setModalOpen(true);
                  }}
                  aria-label="Modifier"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={archivingId === item.category.id}
                  onClick={() => handleToggleArchive(item.category)}
                  aria-label="Archiver"
                  title="Archiver cette catégorie"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-[#FF9500] hover:bg-[#FF9500]/10 disabled:opacity-40"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {item.monthlyLimit > 0 ? (
              <>
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {formatCurrency(item.spent, currency)}{' '}
                    <span className="text-zinc-400 font-normal">
                      / {formatCurrency(item.monthlyLimit, currency)}
                    </span>
                  </span>
                  <AlertStatusBadge
                    status={item.status}
                    usagePercent={item.usagePercent}
                  />
                </div>

                <ProgressBar
                  value={item.usagePercent}
                  status={item.status}
                  markerPercent={item.category.alertThreshold}
                  height="md"
                />

                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {item.remaining >= 0
                    ? `Reste disponible : ${formatCurrency(item.remaining, currency)}`
                    : `Dépassement : ${formatCurrency(Math.abs(item.remaining), currency)}`}
                </p>
              </>
            ) : (
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Dépensé ce mois :{' '}
                  <strong className="text-zinc-900 dark:text-white tabular-nums">
                    {formatCurrency(item.spent, currency)}
                  </strong>
                </span>
                <Badge tone="neutral">Sans plafond</Badge>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Income Categories */}
      {incomeCategories.length > 0 && (
        <section>
          <SectionHeader
            title="Catégories de revenus"
            subtitle="Sources d'entrées d'argent"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {incomeCategories.map((cat) => (
              <Card key={cat.id} className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {cat.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(cat);
                      setModalOpen(true);
                    }}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleArchive(cat)}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-[#FF9500] hover:bg-[#FF9500]/10"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Archived Categories */}
      {archivedCategories.length > 0 && (
        <section>
          <SectionHeader
            title="Catégories archivées"
            subtitle="Conservées pour l'historique et restaurables à tout moment"
          />
          <Card padded={false} className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
            {archivedCategories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between gap-3 px-4 py-3 opacity-75"
              >
                <div className="flex items-center gap-2.5">
                  <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {cat.name}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={archivingId === cat.id}
                  onClick={() => handleToggleArchive(cat)}
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                  Restaurer
                </Button>
              </div>
            ))}
          </Card>
        </section>
      )}

      <CategoryFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingCategory={editing}
        onSaved={onChanged}
      />
    </div>
  );
}
