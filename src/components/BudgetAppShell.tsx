'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  Plus,
  Scale,
  Search,
  Settings,
  ShoppingBasket,
  Sliders,
} from 'lucide-react';
import {
  RebalanceSuggestion,
  TransactionDTO,
  UpcomingRecurringItem,
  calculateBasketInflationIndex,
  calculateCashErosion,
  computeBudgetSummary,
  computeCategoryBudgetStatuses,
  computePersonalInflation,
  filterTransactionsByMonth,
  formatCurrency,
  formatMonthLabel,
  generateOptimizationTips,
  getMonthKey,
  getUpcomingRecurringPayments,
  isWithinEndOfMonthWindow,
  shiftMonthKey,
} from '@/core';
import type { AppBootstrapData } from '@/lib/data';
import { Button, ThemeToggle, ToastContainer, ToastMessage } from '@/components/ui';
import {
  BalanceEditModal,
  DashboardView,
  ExceptionalExpenseModal,
  NavTab,
} from '@/features/dashboard';
import { QuickAddModal, TransactionsView } from '@/features/transactions';
import { CategoriesView } from '@/features/categories';
import { RecurringView } from '@/features/recurring';
import { WealthView } from '@/features/wealth';
import { PriceTrackerView } from '@/features/price-tracker';
import { MonthlyCloseWizard } from '@/features/monthly-close';
import { TaxesView } from '@/features/taxes';
import { CustomIndicesView } from '@/features/custom-indices';
import { AnalyticsView } from '@/features/analytics';
import { SettingsView } from '@/features/settings';
import { useCommandPalette } from '@/features/command-palette';
import { cn } from '@/lib/cn';

const PRIMARY_NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Tableau de bord', mobileLabel: 'Accueil', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', mobileLabel: 'Opérations', icon: ListOrdered },
  { id: 'categories', label: 'Catégories', mobileLabel: 'Budgets', icon: Sliders },
  { id: 'recurring', label: 'Échéancier', mobileLabel: 'Fixes', icon: CalendarClock },
  { id: 'wealth', label: 'Patrimoine', mobileLabel: 'Patrimoine', icon: Landmark },
  { id: 'analytics', label: 'Analyse', mobileLabel: 'Analyse', icon: BarChart3 },
];

export function BudgetAppShell({ initialData }: { initialData: AppBootstrapData }) {
  const [data, setData] = useState<AppBootstrapData>(initialData);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() =>
    getMonthKey(new Date())
  );
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionDTO | null>(null);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [exceptionalModalOpen, setExceptionalModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const { registerBridge, setOpen: setPaletteOpen } = useCommandPalette();

  const showToast = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToast({ id, text, tone });
    window.setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 3200);
  }, []);

  const refreshData = useCallback(
    async (toastMessage?: string) => {
      const res = await fetch('/api/bootstrap', { cache: 'no-store' });
      if (!res.ok) {
        showToast('Impossible d’actualiser les données', 'error');
        return;
      }
      const next: AppBootstrapData = await res.json();
      setData(next);
      if (toastMessage) {
        showToast(toastMessage, 'success');
      }
    },
    [showToast]
  );

  const openQuickAdd = useCallback(() => {
    setEditingTransaction(null);
    setQuickAddOpen(true);
  }, []);

  // Register live app handlers & categories into the global Command Palette mounted in layout.tsx
  useEffect(() => {
    registerBridge({
      navigate: setActiveTab,
      openQuickAdd,
      refreshData,
      showToast,
      categories: data.categories,
      currency: data.settings.currency,
    });
  }, [
    registerBridge,
    openQuickAdd,
    refreshData,
    showToast,
    data.categories,
    data.settings.currency,
  ]);

  // Derived pure business computations from src/core/
  const summary = useMemo(
    () =>
      computeBudgetSummary({
        initialBalance: data.settings.initialBalance,
        transactions: data.transactions,
        categories: data.categories,
        recurringPayments: data.recurringPayments,
        mandatoryReserveRate: data.userSettings.mandatoryReserveRate,
        reserveExpenses: data.reserveExpenses,
        monthKey: selectedMonthKey,
        referenceDate: new Date(),
      }),
    [data, selectedMonthKey]
  );

  const cashErosion = useMemo(
    () =>
      calculateCashErosion(
        summary.currentBalance,
        data.userSettings.manualInflationRate
      ),
    [summary.currentBalance, data.userSettings.manualInflationRate]
  );

  const personalInflation = useMemo(
    () =>
      computePersonalInflation({
        transactions: data.transactions,
        categories: data.categories,
        referenceDate: new Date(),
      }),
    [data.transactions, data.categories]
  );

  const categoryStatuses = useMemo(
    () =>
      computeCategoryBudgetStatuses({
        categories: data.categories,
        transactions: data.transactions,
        monthKey: selectedMonthKey,
        prioritizeAlerts: true,
      }),
    [data.categories, data.transactions, selectedMonthKey]
  );

  const upcomingRecurring = useMemo(
    () =>
      getUpcomingRecurringPayments(
        data.recurringPayments,
        new Date(),
        7,
        data.categories,
        data.transactions
      ),
    [data.recurringPayments, data.categories, data.transactions]
  );

  const monthTransactions = useMemo(
    () => filterTransactionsByMonth(data.transactions, selectedMonthKey),
    [data.transactions, selectedMonthKey]
  );

  const optimizationTips = useMemo(
    () =>
      generateOptimizationTips({
        monthKey: selectedMonthKey,
        summary,
        categoryStatuses,
        categories: data.categories,
        transactions: data.transactions,
        currency: data.settings.currency,
        manualInflationRate: data.userSettings.manualInflationRate,
      }),
    [
      selectedMonthKey,
      summary,
      categoryStatuses,
      data.categories,
      data.transactions,
      data.settings.currency,
      data.userSettings.manualInflationRate,
    ]
  );

  const alertCount = useMemo(
    () => categoryStatuses.filter((c) => c.status === 'red' || c.status === 'orange').length,
    [categoryStatuses]
  );

  const basketAlertCount = useMemo(
    () => calculateBasketInflationIndex(data.trackedProducts).alertTriggeredCount,
    [data.trackedProducts]
  );

  const currentRealMonthKey = getMonthKey(new Date());

  const showCloseReminderBadge = useMemo(() => {
    const inWindow = isWithinEndOfMonthWindow(new Date(), 3);
    const alreadyClosed = data.monthlyReports.some(
      (r) => r.month === currentRealMonthKey
    );
    return inWindow && !alreadyClosed;
  }, [data.monthlyReports, currentRealMonthKey]);

  const handleValidateRecurring = async (item: UpcomingRecurringItem) => {
    const res = await fetch(`/api/recurring/${item.payment.id}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingMonth: item.billingMonth }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      showToast(d.error || 'Erreur lors de la validation', 'error');
      return;
    }
    await refreshData(
      `Prélèvement « ${item.payment.title} » (${formatCurrency(
        item.payment.amount,
        data.settings.currency
      )}) validé`
    );
  };

  const handleDeleteTransaction = async (tx: TransactionDTO) => {
    const res = await fetch(`/api/transactions/${tx.id}`, { method: 'DELETE' });
    if (!res.ok) {
      showToast('Impossible de supprimer la transaction', 'error');
      return;
    }
    await refreshData('Transaction supprimée');
  };

  const handleApplyRebalance = async (rebalance: RebalanceSuggestion) => {
    const res = await fetch('/api/categories/rebalance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromCategoryId: rebalance.fromCategoryId,
        toCategoryId: rebalance.toCategoryId,
        amount: rebalance.amount,
      }),
    });
    if (!res.ok) {
      showToast('Impossible d’appliquer le rééquilibrage', 'error');
      return;
    }
    await refreshData(
      `Rééquilibré : ${formatCurrency(rebalance.amount, data.settings.currency)} transférés vers ${rebalance.toCategoryName}`
    );
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[#F7F6F2] dark:bg-[#111110]">
      <ToastContainer toast={toast} />

      {/* Swiss Editorial Masthead Header — Matte Surface, Sharp 1px Rules, Zero Blur */}
      <header className="sticky top-0 z-30 bg-[#F7F6F2] dark:bg-[#111110] border-b border-[#E2E0D8] dark:border-[#2A2A27] pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Editorial Brand Monogram */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 shrink-0 focus:outline-none group"
          >
            <div className="h-8 w-8 rounded-sm bg-[#141413] dark:bg-[#F2F0E8] text-[#F7F6F2] dark:text-[#111110] flex items-center justify-center font-serif text-sm font-medium tracking-tight">
              BZ
            </div>
            <div className="text-left hidden sm:block">
              <p className="font-serif text-[18px] font-medium tracking-[-0.015em] text-[#141413] dark:text-[#F2F0E8] leading-none">
                BudgetZen
              </p>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#5C5B57] dark:text-[#9A9890] mt-0.5 leading-none">
                {data.settings.accountName}
              </p>
            </div>
          </button>

          {/* Period Selector — Crisp Swiss Editorial Segmented Frame */}
          <div className="inline-flex items-center rounded-md bg-[#FFFFFF] dark:bg-[#181816] border border-[#E2E0D8] dark:border-[#2A2A27] divide-x divide-[#E2E0D8] dark:divide-[#2A2A27]">
            <button
              type="button"
              onClick={() => setSelectedMonthKey((k) => shiftMonthKey(k, -1))}
              aria-label="Mois précédent"
              className="h-8 w-8 flex items-center justify-center text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8] hover:bg-[#FCFBF9] dark:hover:bg-[#1E1E1B] transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedMonthKey(currentRealMonthKey)}
              title="Revenir au mois actuel"
              className="px-3 h-8 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#141413] dark:text-[#F2F0E8] min-w-[126px] sm:min-w-[144px] text-center hover:bg-[#FCFBF9] dark:hover:bg-[#1E1E1B] transition-colors"
            >
              {formatMonthLabel(selectedMonthKey)}
            </button>
            <button
              type="button"
              onClick={() => setSelectedMonthKey((k) => shiftMonthKey(k, 1))}
              aria-label="Mois suivant"
              className="h-8 w-8 flex items-center justify-center text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8] hover:bg-[#FCFBF9] dark:hover:bg-[#1E1E1B] transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Right Utility Controls: ⌘K + Settings + Theme */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Ouvrir la Command Palette (⌘K)"
              title="Command Palette (⌘K)"
              className="hidden sm:inline-flex items-center gap-2 h-8 px-2.5 rounded-md bg-[#FFFFFF] dark:bg-[#181816] border border-[#E2E0D8] dark:border-[#2A2A27] text-xs text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8] hover:border-[#141413]/40 dark:hover:border-[#F2F0E8]/35 transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline text-[11px]">Commande…</span>
              <kbd className="font-mono text-[10px] font-semibold px-1 py-0.25 rounded-sm bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] text-[#141413] dark:text-[#F2F0E8]">
                ⌘K
              </kbd>
            </button>
            <Button
              variant={activeTab === 'settings' ? 'primary' : 'secondary'}
              size="icon"
              onClick={() => setActiveTab('settings')}
              aria-label="Paramètres manuels"
              title="Paramètres manuels"
              className="h-8 w-8"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile Secondary Tools Ribbon */}
        <div className="md:hidden px-4 py-2 border-t border-[#E2E0D8] dark:border-[#2A2A27] overflow-x-auto">
          <div className="inline-flex items-center gap-1.5">
            {[
              { id: 'price-tracker' as NavTab, label: 'Panier', icon: ShoppingBasket, badge: basketAlertCount },
              { id: 'monthly-close' as NavTab, label: 'Clôture', icon: CalendarCheck2, dot: showCloseReminderBadge },
              { id: 'taxes' as NavTab, label: 'Fiscalité', icon: Scale },
              { id: 'custom-indices' as NavTab, label: 'Indices', icon: Activity },
            ].map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTab === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveTab(tool.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm font-mono text-[10px] font-semibold uppercase tracking-[0.06em] border whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-[#141413] border-[#141413] text-[#F7F6F2] dark:bg-[#F2F0E8] dark:border-[#F2F0E8] dark:text-[#111110]'
                      : 'bg-[#FFFFFF] dark:bg-[#181816] border-[#E2E0D8] dark:border-[#2A2A27] text-[#5C5B57] dark:text-[#9A9890]'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span>{tool.label}</span>
                  {tool.badge && tool.badge > 0 ? (
                    <span className="px-1 rounded-sm bg-[#B91C1C] dark:bg-[#EF4444] text-[9px] text-white">
                      {tool.badge}
                    </span>
                  ) : null}
                  {tool.dot ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#15803D] dark:bg-[#22C55E]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop Financial-Press Tab Bar (sharp bottom hairline indicator) */}
        <nav
          aria-label="Navigation principale"
          className="hidden md:block border-t border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413]"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
            {[
              ...PRIMARY_NAV_ITEMS,
              {
                id: 'price-tracker' as NavTab,
                label: 'Panier',
                mobileLabel: 'Panier',
                icon: ShoppingBasket,
              },
              {
                id: 'monthly-close' as NavTab,
                label: 'Clôture',
                mobileLabel: 'Clôture',
                icon: CalendarCheck2,
              },
              {
                id: 'taxes' as NavTab,
                label: 'Fiscalité',
                mobileLabel: 'Fiscalité',
                icon: Scale,
              },
              {
                id: 'custom-indices' as NavTab,
                label: 'Indices',
                mobileLabel: 'Indices',
                icon: Activity,
              },
              {
                id: 'settings' as NavTab,
                label: 'Paramètres',
                mobileLabel: 'Réglages',
                icon: Settings,
              },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const badgeCount =
                item.id === 'recurring'
                  ? upcomingRecurring.length
                  : item.id === 'categories'
                    ? alertCount
                    : item.id === 'price-tracker'
                      ? basketAlertCount
                      : 0;
              const showDot =
                item.id === 'monthly-close' && showCloseReminderBadge;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'relative inline-flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-[1px]',
                    isActive
                      ? 'border-[#141413] dark:border-[#F2F0E8] text-[#141413] dark:text-[#F2F0E8] font-semibold'
                      : 'border-transparent text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8]'
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                  {badgeCount > 0 && (
                    <span
                      className={cn(
                        'font-mono h-4 min-w-4 px-1 rounded-sm text-[9px] font-bold flex items-center justify-center text-white',
                        item.id === 'categories' || item.id === 'price-tracker'
                          ? 'bg-[#B91C1C] dark:bg-[#EF4444]'
                          : 'bg-[#141413] dark:bg-[#F2F0E8] dark:text-[#111110]'
                      )}
                    >
                      {badgeCount}
                    </span>
                  )}
                  {showDot && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[#15803D] dark:bg-[#22C55E]"
                      title="Derniers jours du mois : pensez à clôturer"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Swiss Editorial Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 pb-28 md:pb-14">
        {activeTab === 'dashboard' && (
          <DashboardView
            settings={data.settings}
            summary={summary}
            cashErosion={cashErosion}
            categoryStatuses={categoryStatuses}
            upcomingRecurring={upcomingRecurring}
            recentTransactions={monthTransactions}
            categories={data.categories}
            topTip={optimizationTips[0] ?? null}
            onNavigate={setActiveTab}
            onEditBalance={() => setBalanceModalOpen(true)}
            onOpenExceptionalExpense={() => setExceptionalModalOpen(true)}
            onValidateRecurring={handleValidateRecurring}
            onApplyRebalance={handleApplyRebalance}
            onEditTransaction={(tx) => {
              setEditingTransaction(tx);
              setQuickAddOpen(true);
            }}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={data.transactions}
            categories={data.categories}
            selectedMonthKey={selectedMonthKey}
            currency={data.settings.currency}
            onEdit={(tx) => {
              setEditingTransaction(tx);
              setQuickAddOpen(true);
            }}
            onDelete={handleDeleteTransaction}
            onImported={refreshData}
            onNotify={(msg) => showToast(msg, 'success')}
          />
        )}

        {activeTab === 'categories' && (
          <CategoriesView
            categories={data.categories}
            categoryStatuses={categoryStatuses}
            currency={data.settings.currency}
            onChanged={refreshData}
          />
        )}

        {activeTab === 'recurring' && (
          <RecurringView
            recurringPayments={data.recurringPayments}
            categories={data.categories}
            transactions={data.transactions}
            selectedMonthKey={selectedMonthKey}
            currency={data.settings.currency}
            onChanged={refreshData}
            onValidateRecurring={handleValidateRecurring}
          />
        )}

        {activeTab === 'wealth' && (
          <WealthView
            assets={data.wealthAssets}
            manualInflationRate={data.userSettings.manualInflationRate}
            idleCheckingBalance={summary.currentBalance}
            currency={data.settings.currency}
            onChanged={refreshData}
            onOpenSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'price-tracker' && (
          <PriceTrackerView
            products={data.trackedProducts}
            manualInflationRate={data.userSettings.manualInflationRate}
            currency={data.settings.currency}
            onChanged={refreshData}
          />
        )}

        {activeTab === 'monthly-close' && (
          <MonthlyCloseWizard
            selectedMonthKey={selectedMonthKey}
            accountSettings={data.settings}
            userSettings={data.userSettings}
            transactions={data.transactions}
            recurringPayments={data.recurringPayments}
            reserveExpenses={data.reserveExpenses}
            wealthAssets={data.wealthAssets}
            trackedProducts={data.trackedProducts}
            monthlyReports={data.monthlyReports}
            onClosed={refreshData}
            onNotify={(msg) => showToast(msg, 'success')}
          />
        )}

        {activeTab === 'taxes' && (
          <TaxesView
            taxProfile={data.taxProfile}
            taxEntries={data.taxEntries}
            currency={data.settings.currency}
            onChanged={refreshData}
          />
        )}

        {activeTab === 'custom-indices' && (
          <CustomIndicesView
            indices={data.customIndices}
            trackedProducts={data.trackedProducts}
            categories={data.categories}
            transactions={data.transactions}
            wealthAssets={data.wealthAssets}
            selectedMonthKey={selectedMonthKey}
            onChanged={refreshData}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            transactions={data.transactions}
            categories={data.categories}
            tips={optimizationTips}
            currency={data.settings.currency}
            onApplyRebalance={handleApplyRebalance}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            userSettings={data.userSettings}
            summary={summary}
            personalInflation={personalInflation}
            transactions={data.transactions}
            categories={data.categories}
            monthlyReports={data.monthlyReports}
            currency={data.settings.currency}
            onSaved={refreshData}
            onNotify={(msg) => showToast(msg, 'success')}
          />
        )}
      </main>

      {/* Crisp Editorial Action Button (+) — Matte Ink, Zero Glow, Micro-Rounded */}
      <button
        type="button"
        onClick={openQuickAdd}
        aria-label="Ajouter une dépense ou un revenu"
        title="Saisie rapide (⌘E ou N)"
        className="fixed right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-7 md:right-7 z-40 h-12 w-12 rounded-md bg-[#141413] hover:bg-[#2A2A27] dark:bg-[#F2F0E8] dark:hover:bg-[#E2E0D8] text-[#F7F6F2] dark:text-[#111110] border border-[#141413] dark:border-[#F2F0E8] flex items-center justify-center active:translate-y-[1px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#141413]"
      >
        <Plus className="h-5 w-5" strokeWidth={2.2} />
      </button>

      {/* Mobile Bottom Tab Bar — Solid Editorial Surface, 1px Top Rule */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#FFFFFF] dark:bg-[#181816] border-t border-[#E2E0D8] dark:border-[#2A2A27] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-6 h-14 px-0.5">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badgeCount =
              item.id === 'recurring'
                ? upcomingRecurring.length
                : item.id === 'categories'
                  ? alertCount
                  : 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 transition-colors border-t-2 -mt-[1px]',
                  isActive
                    ? 'border-[#141413] dark:border-[#F2F0E8] text-[#141413] dark:text-[#F2F0E8]'
                    : 'border-transparent text-[#5C5B57] dark:text-[#9A9890]'
                )}
              >
                <div className="relative">
                  <Icon className="h-4 w-4" />
                  {badgeCount > 0 && (
                    <span
                      className={cn(
                        'absolute -top-1.5 -right-2 font-mono h-3.5 min-w-3.5 px-1 rounded-sm text-[8px] font-bold flex items-center justify-center text-white',
                        item.id === 'categories'
                          ? 'bg-[#B91C1C] dark:bg-[#EF4444]'
                          : 'bg-[#141413] dark:bg-[#F2F0E8] dark:text-[#111110]'
                      )}
                    >
                      {badgeCount}
                    </span>
                  )}
                </div>
                <span className="font-mono text-[9px] font-semibold tracking-tight truncate max-w-full px-0.5">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      <QuickAddModal
        open={quickAddOpen}
        onClose={() => {
          setQuickAddOpen(false);
          setEditingTransaction(null);
        }}
        categories={data.categories}
        transactions={data.transactions}
        currentResteAVivre={summary.resteAVivre}
        currency={data.settings.currency}
        editingTransaction={editingTransaction}
        onSaved={refreshData}
      />

      <BalanceEditModal
        open={balanceModalOpen}
        onClose={() => setBalanceModalOpen(false)}
        currentBalance={summary.currentBalance}
        accountName={data.settings.accountName}
        currency={data.settings.currency}
        onSaved={refreshData}
      />

      <ExceptionalExpenseModal
        open={exceptionalModalOpen}
        onClose={() => setExceptionalModalOpen(false)}
        reserveRemaining={summary.reserveRemainingThisMonth}
        currency={data.settings.currency}
        onSaved={refreshData}
      />
    </div>
  );
}
