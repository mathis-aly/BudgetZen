'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
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
  TransactionType,
  UpcomingRecurringItem,
  formatCurrency,
  formatMonthLabel,
  getMonthlyFixedIncome,
  getMonthlyRecurringSchedule,
  getRecurringType,
  getUpcomingRecurringPayments,
  roundCurrency,
} from '@/core';
import {
  Badge,
  Button,
  Card,
  CategoryIcon,
  SectionHeader,
} from '@/components/ui';
import { cn } from '@/lib/cn';
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
  const [initialModalType, setInitialModalType] =
    useState<TransactionType>('EXPENSE');
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

  const { incomeItems, expenseItems } = useMemo(() => {
    const inc: UpcomingRecurringItem[] = [];
    const exp: UpcomingRecurringItem[] = [];
    for (const item of monthlySchedule) {
      if (getRecurringType(item.payment) === 'INCOME') {
        inc.push(item);
      } else {
        exp.push(item);
      }
    }
    return { incomeItems: inc, expenseItems: exp };
  }, [monthlySchedule]);

  const stats = useMemo(() => {
    let totalIncome = 0;
    let remainingIncome = 0;
    let totalExpenses = 0;
    let remainingExpenses = 0;

    for (const item of incomeItems) {
      totalIncome += item.payment.amount;
      if (!item.isPaid) remainingIncome += item.payment.amount;
    }
    for (const item of expenseItems) {
      totalExpenses += item.payment.amount;
      if (!item.isPaid) remainingExpenses += item.payment.amount;
    }

    const monthlyTaxableIncome = getMonthlyFixedIncome(recurringPayments, {
      taxableOnly: true,
    });
    const netMonthlyRecurring = roundCurrency(totalIncome - totalExpenses);

    return {
      totalIncome: roundCurrency(totalIncome),
      remainingIncome: roundCurrency(remainingIncome),
      totalExpenses: roundCurrency(totalExpenses),
      remainingExpenses: roundCurrency(remainingExpenses),
      netMonthlyRecurring,
      monthlyTaxableIncome,
    };
  }, [incomeItems, expenseItems, recurringPayments]);

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
      const label =
        getRecurringType(payment) === 'INCOME' ? 'Entrée fixe' : 'Charge fixe';
      await onChanged(`${label} « ${payment.title} » supprimée`);
    } finally {
      setDeletingId(null);
    }
  };

  const openCreateModal = (type: TransactionType) => {
    setEditing(null);
    setInitialModalType(type);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Échéancier récurrent · Entrées & Charges fixes"
        subtitle={`Suivi mensuel des salaires, revenus récurrents et prélèvements · ${formatMonthLabel(selectedMonthKey)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openCreateModal('INCOME')}
              className="border-[#15803D]/35 text-[#15803D] hover:bg-[#15803D]/[0.06] dark:border-[#22C55E]/35 dark:text-[#22C55E]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Entrée fixe</span>
            </Button>
            <Button size="sm" onClick={() => openCreateModal('EXPENSE')}>
              <Plus className="h-3.5 w-3.5" />
              <span>Charge fixe</span>
            </Button>
          </div>
        }
      />

      {/* Swiss Editorial 4-Column Hairline KPI Strip */}
      <Card padded={false} className="overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E0D8] dark:divide-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413]">
          <div className="p-4">
            <p className="editorial-kicker">Solde net récurrent mensuel</p>
            <p
              className={cn(
                'font-mono text-xl font-semibold tabular-nums mt-1',
                stats.netMonthlyRecurring >= 0
                  ? 'text-[#15803D] dark:text-[#22C55E]'
                  : 'text-[#B91C1C] dark:text-[#EF4444]'
              )}
            >
              {formatCurrency(stats.netMonthlyRecurring, currency, {
                showSign: true,
              })}
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5 tabular-nums">
              Entrées − Charges fixes
            </p>
          </div>

          <div className="p-4">
            <p className="editorial-kicker">Entrées fixes attendues</p>
            <p className="font-mono text-xl font-semibold tabular-nums text-[#15803D] dark:text-[#22C55E] mt-1">
              {formatCurrency(stats.totalIncome, currency, { showSign: true })}
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5 tabular-nums">
              À encaisser : {formatCurrency(stats.remainingIncome, currency)}
            </p>
          </div>

          <div className="p-4">
            <p className="editorial-kicker">Charges fixes mensuelles</p>
            <p className="font-mono text-xl font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1">
              {stats.totalExpenses > 0
                ? formatCurrency(-stats.totalExpenses, currency)
                : formatCurrency(0, currency)}
            </p>
            <p className="font-mono text-[10px] text-[#B45309] dark:text-[#F59E0B] mt-0.5 tabular-nums">
              Reste à prélever :{' '}
              {formatCurrency(stats.remainingExpenses, currency)}
            </p>
          </div>

          <div className="p-4">
            <p className="editorial-kicker">Revenu fixe imposable</p>
            <p className="font-mono text-xl font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1">
              {formatCurrency(stats.monthlyTaxableIncome, currency)}
              <span className="text-xs font-normal text-[#5C5B57] dark:text-[#9A9890]">
                /m
              </span>
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5 tabular-nums">
              Base annuelle :{' '}
              {formatCurrency(stats.monthlyTaxableIncome * 12, currency)}
            </p>
          </div>
        </div>
      </Card>

      {/* Dedicated Next 7 Days Section (Chronological Inflows & Outflows) */}
      <section>
        <SectionHeader
          title="À venir dans les 7 prochains jours"
          subtitle="Validez en un clic dès qu'un encaissement ou prélèvement apparaît sur votre compte"
        />

        <Card
          padded={false}
          className="overflow-hidden divide-y divide-[#E2E0D8] dark:divide-[#2A2A27]"
        >
          {upcoming7Days.length === 0 ? (
            <div className="p-7 text-center space-y-1.5">
              <CheckCircle2 className="h-6 w-6 text-[#15803D] dark:text-[#22C55E] mx-auto" />
              <p className="text-sm font-semibold text-[#141413] dark:text-[#F2F0E8]">
                Aucune échéance imminente
              </p>
              <p className="text-xs text-[#5C5B57] dark:text-[#9A9890]">
                Vous n’avez aucune entrée ni charge fixe en attente sur les 7
                prochains jours.
              </p>
            </div>
          ) : (
            upcoming7Days.map((item) => {
              const isIncome = getRecurringType(item.payment) === 'INCOME';
              const dueLabel = item.isOverdue
                ? `RETARD ${Math.abs(item.daysUntilDue)}J`
                : item.daysUntilDue === 0
                  ? "AUJOURD'HUI"
                  : item.daysUntilDue === 1
                    ? 'DEMAIN'
                    : `J+${item.daysUntilDue}`;

              return (
                <div
                  key={`${item.payment.id}:${item.billingMonth}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon
                      icon={item.category?.icon ?? 'CalendarClock'}
                      color={item.category?.color ?? '#141413'}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[#141413] dark:text-[#F2F0E8]">
                          {item.payment.title}
                        </p>
                        <Badge tone={isIncome ? 'green' : 'neutral'}>
                          {isIncome ? (
                            <ArrowDownLeft className="h-2.5 w-2.5" />
                          ) : (
                            <ArrowUpRight className="h-2.5 w-2.5" />
                          )}
                          {isIncome ? 'ENTRÉE' : 'SORTIE'}
                        </Badge>
                        <Badge
                          tone={
                            item.isOverdue
                              ? 'red'
                              : item.daysUntilDue <= 2
                                ? 'orange'
                                : 'neutral'
                          }
                        >
                          <CalendarClock className="h-2.5 w-2.5" />
                          {dueLabel}
                        </Badge>
                      </div>
                      <p className="font-mono text-[11px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5 tabular-nums">
                        {item.category?.name ??
                          (isIncome ? 'Entrée fixe' : 'Charge fixe')}{' '}
                        · Le {item.payment.dayOfMonth} du mois
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span
                      className={cn(
                        'font-mono text-base font-semibold tabular-nums',
                        isIncome
                          ? 'text-[#15803D] dark:text-[#22C55E]'
                          : 'text-[#141413] dark:text-[#F2F0E8]'
                      )}
                    >
                      {formatCurrency(
                        isIncome ? item.payment.amount : -item.payment.amount,
                        currency,
                        { showSign: true }
                      )}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={validatingId === item.payment.id}
                      onClick={() => handleValidate(item)}
                      className="font-mono text-[11px] text-[#15803D] border-[#15803D]/30 hover:bg-[#15803D]/[0.08] dark:text-[#22C55E] dark:border-[#22C55E]/35"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isIncome
                        ? 'Marquer comme encaissé'
                        : 'Marquer comme débité'}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </section>

      {/* Two Split Swiss Editorial Columns: Entrées Fixes Attendues vs Charges Fixes à Venir */}
      <section>
        <Card padded={false} className="overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E0D8] dark:divide-[#2A2A27]">
            {/* Left Column: Entrées Fixes Attendues */}
            <div className="flex flex-col">
              <div className="px-4 py-3 border-b border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413] flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg text-[#141413] dark:text-[#F2F0E8]">
                      Entrées Fixes Attendues
                    </h3>
                    <Badge tone="green">{incomeItems.length}</Badge>
                  </div>
                  <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5 tabular-nums">
                    Total{' '}
                    {formatCurrency(stats.totalIncome, currency, {
                      showSign: true,
                    })}{' '}
                    · Pris en compte dans la réserve &amp; projection
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openCreateModal('INCOME')}
                  aria-label="Ajouter une entrée fixe"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="divide-y divide-[#E2E0D8] dark:divide-[#2A2A27] flex-1">
                {incomeItems.length === 0 ? (
                  <div className="p-7 text-center space-y-2">
                    <p className="text-xs text-[#5C5B57] dark:text-[#9A9890]">
                      Aucune entrée fixe configurée (salaire, rente, pension,
                      allocation).
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openCreateModal('INCOME')}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter une entrée fixe
                    </Button>
                  </div>
                ) : (
                  incomeItems.map((item) => (
                    <RecurringScheduleRow
                      key={item.payment.id}
                      item={item}
                      isIncome
                      currency={currency}
                      validating={validatingId === item.payment.id}
                      deleting={deletingId === item.payment.id}
                      onValidate={() => handleValidate(item)}
                      onEdit={() => {
                        setEditing(item.payment);
                        setModalOpen(true);
                      }}
                      onDelete={() => handleDelete(item.payment)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Charges Fixes à Venir */}
            <div className="flex flex-col">
              <div className="px-4 py-3 border-b border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413] flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg text-[#141413] dark:text-[#F2F0E8]">
                      Charges Fixes à Venir
                    </h3>
                    <Badge
                      tone={stats.remainingExpenses > 0 ? 'red' : 'neutral'}
                    >
                      {expenseItems.length}
                    </Badge>
                  </div>
                  <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5 tabular-nums">
                    Total{' '}
                    {stats.totalExpenses > 0
                      ? formatCurrency(-stats.totalExpenses, currency)
                      : formatCurrency(0, currency)}{' '}
                    · Déduites du Reste à vivre tant qu’elles restent dues
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openCreateModal('EXPENSE')}
                  aria-label="Ajouter une charge fixe"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="divide-y divide-[#E2E0D8] dark:divide-[#2A2A27] flex-1">
                {expenseItems.length === 0 ? (
                  <div className="p-7 text-center space-y-2">
                    <p className="text-xs text-[#5C5B57] dark:text-[#9A9890]">
                      Aucune charge fixe configurée (loyer, énergie,
                      abonnements).
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openCreateModal('EXPENSE')}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter une charge fixe
                    </Button>
                  </div>
                ) : (
                  expenseItems.map((item) => (
                    <RecurringScheduleRow
                      key={item.payment.id}
                      item={item}
                      isIncome={false}
                      currency={currency}
                      validating={validatingId === item.payment.id}
                      deleting={deletingId === item.payment.id}
                      onValidate={() => handleValidate(item)}
                      onEdit={() => {
                        setEditing(item.payment);
                        setModalOpen(true);
                      }}
                      onDelete={() => handleDelete(item.payment)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>
      </section>

      <RecurringFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categories={categories}
        editingPayment={editing}
        initialType={initialModalType}
        onSaved={onChanged}
      />
    </div>
  );
}

function RecurringScheduleRow({
  item,
  isIncome,
  currency,
  validating,
  deleting,
  onValidate,
  onEdit,
  onDelete,
}: {
  item: UpcomingRecurringItem;
  isIncome: boolean;
  currency: string;
  validating: boolean;
  deleting: boolean;
  onValidate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5 px-4 py-3.5">
      <div className="flex items-center gap-3 min-w-0">
        <CategoryIcon
          icon={item.category?.icon ?? 'Repeat'}
          color={item.category?.color ?? '#141413'}
          size="md"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-[#141413] dark:text-[#F2F0E8] truncate">
              {item.payment.title}
            </p>
            {item.isPaid ? (
              <Badge tone="green">
                <CheckCircle2 className="h-2.5 w-2.5" />
                {isIncome ? 'Encaissé' : 'Débité'}
              </Badge>
            ) : (
              <Badge tone="neutral">
                <Clock className="h-2.5 w-2.5" />
                Le {item.payment.dayOfMonth}
              </Badge>
            )}
            {isIncome && (
              <Badge
                tone={item.payment.isTaxable !== false ? 'neutral' : 'blue'}
              >
                {item.payment.isTaxable !== false ? 'Imposable' : 'Exonéré'}
              </Badge>
            )}
          </div>
          <p className="font-mono text-[11px] text-[#5C5B57] dark:text-[#9A9890] truncate mt-0.5">
            {item.category?.name ?? 'Autre'}
            {item.payment.note ? ` · ${item.payment.note}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            isIncome
              ? 'text-[#15803D] dark:text-[#22C55E]'
              : 'text-[#141413] dark:text-[#F2F0E8]'
          )}
        >
          {formatCurrency(
            isIncome ? item.payment.amount : -item.payment.amount,
            currency,
            { showSign: true }
          )}
        </span>

        {!item.isPaid && (
          <Button
            size="sm"
            variant="secondary"
            loading={validating}
            onClick={onValidate}
            title={
              isIncome ? 'Marquer comme encaissé' : 'Marquer comme débité'
            }
            className="h-7 px-2 font-mono text-[10px] hidden sm:inline-flex"
          >
            {isIncome ? 'Encaissé' : 'Débité'}
          </Button>
        )}

        <button
          type="button"
          onClick={onEdit}
          aria-label="Modifier"
          className="h-7 w-7 rounded-sm flex items-center justify-center text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8] hover:bg-[#F7F6F2] dark:hover:bg-[#1E1E1B]"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          aria-label="Supprimer"
          className="h-7 w-7 rounded-sm flex items-center justify-center text-[#5C5B57] dark:text-[#9A9890] hover:text-[#B91C1C] dark:hover:text-[#EF4444] disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
