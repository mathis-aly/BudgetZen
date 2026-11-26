'use client';

import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  CategoryDTO,
  RecurringPaymentDTO,
  TransactionDTO,
  UpcomingRecurringItem,
  formatCurrency,
  formatMonthLabel,
  getMonthlyRecurringSchedule,
  getUpcomingRecurringPayments,
} from '@/core';
import {
  Badge,
  Button,
  Card,
  CategoryIcon,
  SectionHeader,
} from '@/components/ui';
import { RecurringFormModal } from './RecurringFormModal';

export function RecurringView({
  recurringPayments,
  categories,
  transactions,
  selectedMonthKey,
  currency = 'EUR',
  onChanged,
  onValidateRecurring,
}: {
  recurringPayments: RecurringPaymentDTO[];
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  selectedMonthKey: string;
  currency?: string;
  onChanged: (message: string) => Promise<void>;
  onValidateRecurring: (item: UpcomingRecurringItem) => Promise<void>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringPaymentDTO | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const upcoming7Days = useMemo(
    () =>
      getUpcomingRecurringPayments(
        recurringPayments,
        new Date(),
        7,
        categories,
        transactions
      ),
    [recurringPayments, categories, transactions]
  );

  const monthlySchedule = useMemo(
    () =>
      getMonthlyRecurringSchedule(
        recurringPayments,
        selectedMonthKey,
        new Date(),
        categories,
        transactions
      ),
    [recurringPayments, selectedMonthKey, categories, transactions]
  );

  const totals = useMemo(() => {
    let total = 0;
    let paid = 0;
    let remaining = 0;
    for (const item of monthlySchedule) {
      total += item.payment.amount;
      if (item.isPaid) paid += item.payment.amount;
      else remaining += item.payment.amount;
    }
    return { total, paid, remaining };
  }, [monthlySchedule]);

  const handleValidate = async (item: UpcomingRecurringItem) => {
    setValidatingId(item.payment.id);
    try {
      await onValidateRecurring(item);
    } finally {
      setValidatingId(null);
    }
  };

  const handleDelete = async (payment: RecurringPaymentDTO) => {
    setDeletingId(payment.id);
    try {
      const res = await fetch(`/api/recurring/${payment.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      await onChanged(`Charge fixe « ${payment.title} » supprimée`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Échéancier des paiements fixes"
        subtitle={`Anticipez vos prélèvements récurrents · ${formatMonthLabel(selectedMonthKey)}`}
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Ajouter une charge
          </Button>
        }
      />

      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Card className="p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Total mensuel
          </p>
          <p className="text-base sm:text-xl font-bold tabular-nums text-zinc-900 dark:text-white mt-0.5">
            {formatCurrency(totals.total, currency)}
          </p>
        </Card>
        <Card className="p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Déjà débités
          </p>
          <p className="text-base sm:text-xl font-bold tabular-nums text-[#34C759] dark:text-[#30D158] mt-0.5">
            {formatCurrency(totals.paid, currency)}
          </p>
        </Card>
        <Card className="p-3.5 sm:p-4">
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Reste à prélever
          </p>
          <p className="text-base sm:text-xl font-bold tabular-nums text-[#FF9500] dark:text-[#FF9F0A] mt-0.5">
            {formatCurrency(totals.remaining, currency)}
          </p>
        </Card>
      </div>

      {/* Dedicated Next 7 Days Section (Required MVP Feature #4) */}
      <section>
        <SectionHeader
          title="À venir dans les 7 prochains jours"
          subtitle="Validez en un clic dès que le prélèvement apparaît sur votre compte"
        />

        <Card
          padded={false}
          className="overflow-hidden border-[#007AFF]/20 dark:border-[#0A84FF]/25 divide-y divide-black/[0.05] dark:divide-white/[0.07]"
        >
          {upcoming7Days.length === 0 ? (
            <div className="p-7 text-center space-y-1.5">
              <CheckCircle2 className="h-7 w-7 text-[#34C759] mx-auto" />
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                Aucun prélèvement imminent
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Vous n’avez aucune charge fixe en attente sur les 7 prochains jours.
              </p>
            </div>
          ) : (
            upcoming7Days.map((item) => {
              const dueLabel = item.isOverdue
                ? `En retard (${Math.abs(item.daysUntilDue)}j)`
                : item.daysUntilDue === 0
                  ? "Aujourd'hui"
                  : item.daysUntilDue === 1
                    ? 'Demain'
                    : `Dans ${item.daysUntilDue} jours`;

              return (
                <div
                  key={`${item.payment.id}:${item.billingMonth}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-4 bg-[#007AFF]/[0.02] dark:bg-[#0A84FF]/[0.04]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon
                      icon={item.category?.icon ?? 'CalendarClock'}
                      color={item.category?.color ?? '#007AFF'}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {item.payment.title}
                        </p>
                        <Badge
                          tone={
                            item.isOverdue
                              ? 'red'
                              : item.daysUntilDue <= 2
                                ? 'orange'
                                : 'blue'
                          }
                        >
                          <CalendarClock className="h-3 w-3" />
                          {dueLabel}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {item.category?.name ?? 'Charge fixe'} · Prélèvement le{' '}
                        {item.payment.dayOfMonth} du mois
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="text-base font-bold tabular-nums text-zinc-900 dark:text-white">
                      {formatCurrency(item.payment.amount, currency)}
                    </span>
                    <Button
                      size="sm"
                      variant="success"
                      loading={validatingId === item.payment.id}
                      onClick={() => handleValidate(item)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Valider le débit
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </section>

      {/* Complete Monthly Schedule */}
      <section>
        <SectionHeader
          title={`Toutes les charges fixes (${monthlySchedule.length})`}
          subtitle="Provisionnées dans le calcul du reste à vivre tant qu'elles ne sont pas débitées"
        />

        <Card padded={false} className="overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.07]">
          {monthlySchedule.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              Aucune charge fixe configurée. Ajoutez votre loyer ou vos abonnements.
            </div>
          ) : (
            monthlySchedule.map((item) => (
              <div
                key={item.payment.id}
                className="flex items-center justify-between gap-3 px-4 py-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CategoryIcon
                    icon={item.category?.icon ?? 'Repeat'}
                    color={item.category?.color ?? '#007AFF'}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                        {item.payment.title}
                      </p>
                      {item.isPaid ? (
                        <Badge tone="green">
                          <CheckCircle2 className="h-3 w-3" />
                          Débité
                        </Badge>
                      ) : (
                        <Badge tone="neutral">
                          <Clock className="h-3 w-3" />
                          Le {item.payment.dayOfMonth}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {item.category?.name ?? 'Autre'}
                      {item.payment.note ? ` · ${item.payment.note}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-white">
                    {formatCurrency(item.payment.amount, currency)}
                  </span>

                  {!item.isPaid && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={validatingId === item.payment.id}
                      onClick={() => handleValidate(item)}
                      className="h-8 px-2.5 text-[11px] hidden sm:inline-flex"
                    >
                      Débité
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setEditing(item.payment);
                      setModalOpen(true);
                    }}
                    aria-label="Modifier"
                    className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === item.payment.id}
                    onClick={() => handleDelete(item.payment)}
                    aria-label="Supprimer"
                    className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </Card>
      </section>

      <RecurringFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categories={categories}
        editingPayment={editing}
        onSaved={onChanged}
      />
    </div>
  );
}
