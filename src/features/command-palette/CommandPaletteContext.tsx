'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { CategoryDTO } from '@/core';
import type { NavTab } from '@/features/dashboard';

export interface CommandPaletteBridge {
  navigate: (tab: NavTab) => void;
  openQuickAdd: () => void;
  refreshData: (toastMessage?: string) => Promise<void>;
  showToast: (text: string, tone?: 'success' | 'error') => void;
  categories: CategoryDTO[];
  currency: string;
}

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggle: () => void;
  bridge: CommandPaletteBridge;
  registerBridge: (next: CommandPaletteBridge) => void;
}

const DEFAULT_BRIDGE: CommandPaletteBridge = {
  navigate: () => {},
  openQuickAdd: () => {},
  refreshData: async () => {},
  showToast: () => {},
  categories: [],
  currency: 'EUR',
};

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
  bridge: DEFAULT_BRIDGE,
  registerBridge: () => {},
});

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [bridge, setBridge] = useState<CommandPaletteBridge>(DEFAULT_BRIDGE);
  const bridgeRef = useRef<CommandPaletteBridge>(DEFAULT_BRIDGE);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const registerBridge = useCallback((next: CommandPaletteBridge) => {
    bridgeRef.current = next;
    setBridge(next);
  }, []);

  return (
    <CommandPaletteContext.Provider
      value={{ open, setOpen, toggle, bridge, registerBridge }}
    >
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}
