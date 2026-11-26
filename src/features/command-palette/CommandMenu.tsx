'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  Moon,
  Plus,
  Scale,
  Search,
  Settings,
  ShoppingBasket,
  Sliders,
  Sparkles,
  Sun,
} from 'lucide-react';
import { formatCurrency, parseQuickCommand } from '@/core';
import { useTheme } from '@/components/ui';
import type { NavTab } from '@/features/dashboard';
import { cn } from '@/lib/cn';
import { useCommandPalette } from './CommandPaletteContext';
import { useGlobalShortcuts } from './useGlobalShortcuts';

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-sm bg-[#F7F6F2] dark:bg-[#111110] border border-[#E2E0D8] dark:border-[#2A2A27] font-mono text-[10px] font-semibold text-[#5C5B57] dark:text-[#9A9890]">
      {children}
    </kbd>
  );
}

export function CommandMenu() {
  const { open, setOpen, toggle, bridge } = useCommandPalette();
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [submittingQuick, setSubmittingQuick] = useState(false);

  // Wire all global macOS / Windows keyboard shortcuts
  useGlobalShortcuts({
    isPaletteOpen: open,
    onTogglePalette: toggle,
    onClosePalette: () => setOpen(false),
    onOpenQuickAdd: bridge.openQuickAdd,
    onNavigate: bridge.navigate,
  });

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSubmittingQuick(false);
    }
  }, [open]);

  const parsedQuick = useMemo(
    () => parseQuickCommand(search, bridge.categories, bridge.currency),
    [search, bridge.categories, bridge.currency]
  );

  const runNav = (tab: NavTab) => {
    setOpen(false);
    bridge.navigate(tab);
  };

  const handleQuickSave = async () => {
    if (!parsedQuick || submittingQuick) return;
    setSubmittingQuick(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parsedQuick.amount,
          type: parsedQuick.type,
          categoryId: parsedQuick.category.id,
          date: new Date().toISOString(),
          note: parsedQuick.note,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Impossible d'enregistrer l'opération.");
      }

      const directionText =
        parsedQuick.type === 'INCOME' ? 'Entrée' : 'Sortie';
      setOpen(false);
      await bridge.refreshData(
        `${directionText} de ${formatCurrency(
          parsedQuick.amount,
          bridge.currency
        )} enregistrée dans ${parsedQuick.category.name}`
      );
    } catch (err) {
      bridge.showToast(
        err instanceof Error ? err.message : 'Erreur lors de la saisie rapide',
        'error'
      );
    } finally {
      setSubmittingQuick(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[10vh] sm:pt-[14vh] px-4 animate-fade-in"
      role="presentation"
    >
      {/* Editorial Ink Backdrop */}
      <div
        className="fixed inset-0 bg-[#141413]/55 dark:bg-black/75"
        onClick={() => setOpen(false)}
      />

      {/* Swiss Editorial Command Palette Surface (sharp rounded-md, 1px hairline, zero shadow) */}
      <div className="relative z-10 w-full max-w-xl rounded-md bg-[#FFFFFF] dark:bg-[#181816] border border-[#E2E0D8] dark:border-[#2A2A27] overflow-hidden animate-slide-up-tight">
        <Command
          label="Command Palette BudgetZen"
          shouldFilter={!parsedQuick}
          className="flex flex-col"
        >
          {/* Search Input Row */}
          <div className="flex items-center gap-3 px-4 h-12 border-b border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413]">
            <Search className="h-4 w-4 text-[#5C5B57] dark:text-[#9A9890] shrink-0" />
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder="Rechercher une vue ou saisir ex. -18.50 courses pain…"
              className="w-full bg-transparent text-sm text-[#141413] dark:text-[#F2F0E8] placeholder:text-[#5C5B57]/70 dark:placeholder:text-[#9A9890]/70 focus:outline-none"
            />
            <Kbd>ESC</Kbd>
          </div>

          {/* Results List */}
          <Command.List className="max-h-[58vh] overflow-y-auto p-2 space-y-2">
            <Command.Empty className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Aucun résultat. Essayez une saisie rapide comme{' '}
              <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/10 font-mono">
                -18.50 courses pain
              </code>
            </Command.Empty>

            {/* DYNAMIC QUICK TRANSACTION ACTION (when input begins with an amount) */}
            {parsedQuick && (
              <Command.Group
                heading="Saisie rapide instantanée"
                className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-400"
              >
                <Command.Item
                  value={`quick-save-${search}`}
                  onSelect={handleQuickSave}
                  disabled={submittingQuick}
                  className={cn(
                    'flex items-center justify-between gap-3 px-3 py-2.5 rounded-sm border cursor-pointer select-none transition-colors',
                    parsedQuick.type === 'INCOME'
                      ? 'bg-[#15803D]/[0.08] border-[#15803D]/30 text-[#141413] dark:text-[#F2F0E8] data-[selected=true]:bg-[#15803D]/[0.14]'
                      : 'bg-[#F7F6F2] dark:bg-[#1E1E1B] border-[#141413]/30 dark:border-[#F2F0E8]/25 text-[#141413] dark:text-[#F2F0E8] data-[selected=true]:bg-[#141413] data-[selected=true]:text-[#F7F6F2] dark:data-[selected=true]:bg-[#F2F0E8] dark:data-[selected=true]:text-[#111110]'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        'h-7 w-7 rounded-sm flex items-center justify-center shrink-0 text-white',
                        parsedQuick.type === 'INCOME'
                          ? 'bg-[#15803D] dark:bg-[#22C55E] dark:text-[#111110]'
                          : 'bg-[#141413] dark:bg-[#F2F0E8] dark:text-[#111110]'
                      )}
                    >
                      {parsedQuick.type === 'INCOME' ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold leading-snug">
                        {submittingQuick
                          ? 'Enregistrement en cours…'
                          : parsedQuick.previewLabel}
                      </p>
                      <p className="font-mono text-[10px] opacity-75 mt-0.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        Entrée pour comptabiliser immédiatement
                      </p>
                    </div>
                  </div>
                  <Kbd>↵</Kbd>
                </Command.Item>
              </Command.Group>
            )}

            {/* QUICK ACTIONS GROUP */}
            {!parsedQuick && (
              <>
                <Command.Group
                  heading="Actions rapides"
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-400"
                >
                  <Command.Item
                    value="Nouvelle dépense revenu saisie rapide transaction ajouter"
                    onSelect={() => {
                      setOpen(false);
                      bridge.openQuickAdd();
                    }}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-sm text-sm text-[#141413] dark:text-[#F2F0E8] cursor-pointer select-none data-[selected=true]:bg-[#141413] data-[selected=true]:text-[#F7F6F2] dark:data-[selected=true]:bg-[#F2F0E8] dark:data-[selected=true]:text-[#111110] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Plus className="h-4 w-4 shrink-0" />
                      <span className="font-medium">Nouvelle transaction (Dépense / Revenu)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Kbd>⌘</Kbd>
                      <Kbd>E</Kbd>
                    </div>
                  </Command.Item>

                  <Command.Item
                    value="Clôture mensuelle bilan fin de mois fermer"
                    onSelect={() => runNav('monthly-close')}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-sm text-sm text-[#141413] dark:text-[#F2F0E8] cursor-pointer select-none data-[selected=true]:bg-[#141413] data-[selected=true]:text-[#F7F6F2] dark:data-[selected=true]:bg-[#F2F0E8] dark:data-[selected=true]:text-[#111110] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <CalendarCheck2 className="h-4 w-4 shrink-0" />
                      <span className="font-medium">Lancer la clôture du mois</span>
                    </div>
                  </Command.Item>

                  <Command.Item
                    value="Mode clair sombre theme apparence dark light"
                    onSelect={() => {
                      toggleTheme();
                      setOpen(false);
                    }}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-sm text-sm text-[#141413] dark:text-[#F2F0E8] cursor-pointer select-none data-[selected=true]:bg-[#141413] data-[selected=true]:text-[#F7F6F2] dark:data-[selected=true]:bg-[#F2F0E8] dark:data-[selected=true]:text-[#111110] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      {theme === 'dark' ? (
                        <Sun className="h-4 w-4 shrink-0" />
                      ) : (
                        <Moon className="h-4 w-4 shrink-0" />
                      )}
                      <span className="font-medium">
                        Basculer en mode {theme === 'dark' ? 'clair' : 'sombre'}
                      </span>
                    </div>
                  </Command.Item>
                </Command.Group>

                {/* PRIMARY NAVIGATION (⌘1 – ⌘6) */}
                <Command.Group
                  heading="Navigation principale"
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-400"
                >
                  {[
                    {
                      tab: 'dashboard' as NavTab,
                      label: 'Tableau de bord',
                      keywords: 'accueil reste a vivre dashboard',
                      icon: LayoutDashboard,
                      shortcut: '1',
                    },
                    {
                      tab: 'transactions' as NavTab,
                      label: 'Transactions & Historique',
                      keywords: 'operations depenses revenus csv',
                      icon: ListOrdered,
                      shortcut: '2',
                    },
                    {
                      tab: 'wealth' as NavTab,
                      label: 'Patrimoine & Projections',
                      keywords: 'epargne investissements pea livret interets composes',
                      icon: Landmark,
                      shortcut: '3',
                    },
                    {
                      tab: 'price-tracker' as NavTab,
                      label: 'Panier Témoin & Suivi des Prix',
                      keywords: 'inflation produits prix courses',
                      icon: ShoppingBasket,
                      shortcut: '4',
                    },
                    {
                      tab: 'taxes' as NavTab,
                      label: 'Impôts & Fiscalité 2026',
                      keywords: 'impots declaration bareme pfu 2op tmi',
                      icon: Scale,
                      shortcut: '5',
                    },
                    {
                      tab: 'custom-indices' as NavTab,
                      label: 'Indices personnalisés',
                      keywords: 'indice base 100 composite ponderation',
                      icon: Activity,
                      shortcut: '6',
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.tab}
                        value={`${item.label} ${item.keywords}`}
                        onSelect={() => runNav(item.tab)}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-sm text-sm text-[#141413] dark:text-[#F2F0E8] cursor-pointer select-none data-[selected=true]:bg-[#141413] data-[selected=true]:text-[#F7F6F2] dark:data-[selected=true]:bg-[#F2F0E8] dark:data-[selected=true]:text-[#111110] transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="font-medium">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Kbd>⌘</Kbd>
                          <Kbd>{item.shortcut}</Kbd>
                        </div>
                      </Command.Item>
                    );
                  })}
                </Command.Group>

                {/* OTHER MODULES */}
                <Command.Group
                  heading="Autres modules"
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-400"
                >
                  {[
                    {
                      tab: 'categories' as NavTab,
                      label: 'Catégories & Plafonds',
                      icon: Sliders,
                    },
                    {
                      tab: 'recurring' as NavTab,
                      label: 'Échéancier des paiements fixes',
                      icon: CalendarClock,
                    },
                    {
                      tab: 'analytics' as NavTab,
                      label: 'Analyse & Moteur d’optimisation',
                      icon: BarChart3,
                    },
                    {
                      tab: 'settings' as NavTab,
                      label: 'Paramètres manuels & Sauvegarde CSV',
                      icon: Settings,
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.tab}
                        value={item.label}
                        onSelect={() => runNav(item.tab)}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-sm text-sm text-[#5C5B57] dark:text-[#9A9890] cursor-pointer select-none data-[selected=true]:bg-[#141413] data-[selected=true]:text-[#F7F6F2] dark:data-[selected=true]:bg-[#F2F0E8] dark:data-[selected=true]:text-[#111110] transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="font-medium">{item.label}</span>
                        </div>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              </>
            )}
          </Command.List>

          {/* Footer Shortcuts Bar */}
          <div className="px-4 py-2.5 border-t border-black/[0.06] dark:border-white/[0.09] bg-zinc-50/80 dark:bg-white/[0.03] flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Kbd>↑↓</Kbd> Naviguer
              </span>
              <span className="inline-flex items-center gap-1">
                <Kbd>↵</Kbd> Exécuter
              </span>
              <span className="hidden sm:inline-flex items-center gap-1">
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd> Valider modale
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">
              Astuce : -18.50 courses pain
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
