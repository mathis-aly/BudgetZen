'use client';

import { useEffect } from 'react';
import type { NavTab } from '@/features/dashboard';

export const SHORTCUT_NAV_MAP: Record<string, NavTab> = {
  '1': 'dashboard',
  '2': 'transactions',
  '3': 'wealth',
  '4': 'price-tracker',
  '5': 'taxes',
  '6': 'custom-indices',
};

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

export interface GlobalShortcutsOptions {
  isLocked?: boolean;
  isPlanningActive?: boolean;
  isPaletteOpen: boolean;
  onTogglePalette: () => void;
  onClosePalette: () => void;
  onOpenQuickAdd: () => void;
  onNavigate: (tab: NavTab) => void;
}

/**
 * Global keyboard shortcuts hook supporting macOS (Cmd / metaKey) and Windows/Linux (Ctrl / ctrlKey):
 * - ⌘+K / Ctrl+K : Open / close Command Palette from anywhere
 * - ⌘+E / Ctrl+E (and plain `N` when no text field is focused) : Open Quick Add Transaction modal
 * - ⌘+1..⌘+6 / Ctrl+1..6 : Navigate directly to primary views
 * - ⌘+Enter / Ctrl+Enter : Submit the active form inside any currently open modal dialog
 * Automatically isolated whenever `isLocked === true` (Privacy Shield active).
 */
export function useGlobalShortcuts({
  isLocked = false,
  isPlanningActive = false,
  isPaletteOpen,
  onTogglePalette,
  onClosePalette,
  onOpenQuickAdd,
  onNavigate,
}: GlobalShortcutsOptions) {
  useEffect(() => {
    if (isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const keyLower = e.key.toLowerCase();

      // 1. ⌘ + K (or Ctrl + K) — Toggle Command Palette from anywhere
      if (mod && !e.altKey && !e.shiftKey && keyLower === 'k') {
        e.preventDefault();
        onTogglePalette();
        return;
      }

      // 2. ⌘ + Enter (or Ctrl + Enter) — Submit active form inside an open modal dialog
      if (mod && e.key === 'Enter' && !isPaletteOpen) {
        const activeEl = document.activeElement;
        const activeDialog =
          activeEl instanceof HTMLElement
            ? activeEl.closest('[role="dialog"]')
            : null;
        const openDialog =
          activeDialog ??
          Array.from(document.querySelectorAll('[role="dialog"]')).pop() ??
          null;

        if (openDialog) {
          const form = openDialog.querySelector('form');
          if (form instanceof HTMLFormElement) {
            e.preventDefault();
            form.requestSubmit();
            return;
          }
        }
      }

      // 3. ⌘ + E (or Ctrl + E) — Open Quick Add modal immediately
      if (mod && !e.altKey && !e.shiftKey && keyLower === 'e') {
        if (isPlanningActive) return;
        e.preventDefault();
        onClosePalette();
        onOpenQuickAdd();
        return;
      }

      // 4. ⌘ + 1..6 (or Ctrl + 1..6) — Instant navigation to primary views
      if (mod && !e.altKey && !e.shiftKey && e.key in SHORTCUT_NAV_MAP) {
        if (isPlanningActive) return;
        e.preventDefault();
        onClosePalette();
        onNavigate(SHORTCUT_NAV_MAP[e.key]);
        return;
      }

      // 5. Escape closes Command Palette if open
      if (e.key === 'Escape' && isPaletteOpen) {
        e.preventDefault();
        onClosePalette();
        return;
      }

      // 6. Plain single-key shortcuts (`N` or `+`) — strictly ignored when an input/textarea/modal/palette/planning is active
      if (isPlanningActive || mod || e.altKey || isPaletteOpen) return;
      if (isEditableElement(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;

      if (keyLower === 'n' || e.key === '+') {
        e.preventDefault();
        onOpenQuickAdd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isLocked,
    isPlanningActive,
    isPaletteOpen,
    onTogglePalette,
    onClosePalette,
    onOpenQuickAdd,
    onNavigate,
  ]);
}
