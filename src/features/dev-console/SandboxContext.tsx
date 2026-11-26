'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { AppBootstrapData } from '@/lib/data';
import type { NavTab } from '@/features/dashboard';
import type {
  CloseMonthActionInput,
  CloseMonthActionResult,
} from '@/features/monthly-close/actions';
import type {
  ImportTransactionRowPayload,
  ImportTransactionsActionResult,
} from '@/features/transactions/actions';
import { usePrivacyShield } from '@/components/ui';
import {
  applySandboxApiMutation,
  applySandboxCloseMonth,
  applySandboxImportTransactions,
} from './sandbox-reducer';

export const SANDBOX_TOUR_TOTAL_STEPS = 3;
const SANDBOX_ENTRANCE_DURATION_MS = 900;

interface SandboxContextValue {
  isSandbox: boolean;
  plannedModuleStatus: string | null;
  markPlannedModule: () => void;
  isConsoleOpen: boolean;
  setConsoleOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isTransitioning: boolean;
  isTourActive: boolean;
  tourStep: number;
  setTourStep: React.Dispatch<React.SetStateAction<number>>;
  nextTourStep: () => void;
  prevTourStep: () => void;
  startTour: () => void;
  closeTour: () => void;
  sandboxData: AppBootstrapData | null;
  syncRealData: (data: AppBootstrapData) => void;
  registerShellNav: (fn: (tab: NavTab) => void) => void;
  navigateShell: (tab: NavTab) => void;
  enterSandbox: () => void;
  exitSandbox: () => void;
  runSandboxImportTransactions: (
    rows: ImportTransactionRowPayload[]
  ) => Promise<ImportTransactionsActionResult>;
  runSandboxCloseMonth: (
    input: CloseMonthActionInput
  ) => Promise<CloseMonthActionResult>;
}

const SandboxContext = createContext<SandboxContextValue>({
  isSandbox: false,
  plannedModuleStatus: null,
  markPlannedModule: () => {},
  isConsoleOpen: false,
  setConsoleOpen: () => {},
  isTransitioning: false,
  isTourActive: false,
  tourStep: 0,
  setTourStep: () => {},
  nextTourStep: () => {},
  prevTourStep: () => {},
  startTour: () => {},
  closeTour: () => {},
  sandboxData: null,
  syncRealData: () => {},
  registerShellNav: () => {},
  navigateShell: () => {},
  enterSandbox: () => {},
  exitSandbox: () => {},
  runSandboxImportTransactions: async () => ({
    ok: false,
    error: 'Sandbox inactif.',
  }),
  runSandboxCloseMonth: async () => ({
    ok: false,
    error: 'Sandbox inactif.',
  }),
});

async function extractRequestBody(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<unknown> {
  const rawBody = init?.body;
  if (typeof rawBody === 'string' && rawBody.length > 0) {
    try {
      return JSON.parse(rawBody);
    } catch {
      return {};
    }
  }
  if (input instanceof Request) {
    try {
      const cloned = input.clone();
      const text = await cloned.text();
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function SandboxProvider({ children }: { children: React.ReactNode }) {
  const { isLocked } = usePrivacyShield();

  const [isSandbox, setIsSandbox] = useState(false);
  const [plannedModuleStatus, setPlannedModuleStatus] = useState<string | null>(
    null
  );
  const [isConsoleOpen, setConsoleOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [sandboxData, setSandboxData] = useState<AppBootstrapData | null>(null);

  const realDataRef = useRef<AppBootstrapData | null>(null);
  const sandboxDataRef = useRef<AppBootstrapData | null>(null);
  const shellNavRef = useRef<((tab: NavTab) => void) | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  const clearTransitionTimer = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  const syncRealData = useCallback((data: AppBootstrapData) => {
    realDataRef.current = data;
  }, []);

  const registerShellNav = useCallback((fn: (tab: NavTab) => void) => {
    shellNavRef.current = fn;
  }, []);

  const navigateShell = useCallback((tab: NavTab) => {
    shellNavRef.current?.(tab);
  }, []);

  const markPlannedModule = useCallback(() => {
    setPlannedModuleStatus('Planification · En spécification');
  }, []);

  const startTour = useCallback(() => {
    setTourStep(0);
    setIsTourActive(true);
    shellNavRef.current?.('dashboard');
  }, []);

  const closeTour = useCallback(() => {
    setIsTourActive(false);
  }, []);

  const nextTourStep = useCallback(() => {
    setTourStep((prev) => {
      if (prev + 1 >= SANDBOX_TOUR_TOTAL_STEPS) {
        setIsTourActive(false);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  const prevTourStep = useCallback(() => {
    setTourStep((prev) => Math.max(0, prev - 1));
  }, []);

  const enterSandbox = useCallback(() => {
    clearTransitionTimer();

    const baseSnapshot = realDataRef.current
      ? structuredClone(realDataRef.current)
      : null;

    sandboxDataRef.current = baseSnapshot;
    setSandboxData(baseSnapshot);
    setIsSandbox(true);
    setConsoleOpen(false);
    setIsTourActive(false);
    setTourStep(0);
    setIsTransitioning(true);

    shellNavRef.current?.('dashboard');

    transitionTimerRef.current = window.setTimeout(() => {
      setIsTransitioning(false);
      setIsTourActive(true);
      transitionTimerRef.current = null;
    }, SANDBOX_ENTRANCE_DURATION_MS);
  }, [clearTransitionTimer]);

  const exitSandbox = useCallback(() => {
    clearTransitionTimer();
    sandboxDataRef.current = null;
    setSandboxData(null);
    setIsSandbox(false);
    setIsTransitioning(false);
    setIsTourActive(false);
    setTourStep(0);
    setConsoleOpen(false);
  }, [clearTransitionTimer]);

  const runSandboxImportTransactions = useCallback(
    async (
      rows: ImportTransactionRowPayload[]
    ): Promise<ImportTransactionsActionResult> => {
      const current = sandboxDataRef.current;
      if (!current) {
        return { ok: false, error: 'État Sandbox introuvable.' };
      }
      const next = applySandboxImportTransactions(current, rows);
      sandboxDataRef.current = next.state;
      setSandboxData(next.state);
      return next.result;
    },
    []
  );

  const runSandboxCloseMonth = useCallback(
    async (input: CloseMonthActionInput): Promise<CloseMonthActionResult> => {
      const current = sandboxDataRef.current;
      if (!current) {
        return { ok: false, error: 'État Sandbox introuvable.' };
      }
      const next = applySandboxCloseMonth(current, input);
      sandboxDataRef.current = next.state;
      setSandboxData(next.state);
      return next.result;
    },
    []
  );

  // Intercept same-origin `/api/*` calls while Sandbox mode is active so NO
  // mutation or network write ever hits SQLite / Prisma.
  useEffect(() => {
    if (!isSandbox) return;

    const nativeFetch = window.fetch.bind(window);

    const sandboxFetch: typeof window.fetch = async (input, init) => {
      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      let parsedUrl: URL | null = null;
      try {
        parsedUrl = new URL(rawUrl, window.location.origin);
      } catch {
        parsedUrl = null;
      }

      if (
        !parsedUrl ||
        parsedUrl.origin !== window.location.origin ||
        !parsedUrl.pathname.startsWith('/api/')
      ) {
        return nativeFetch(input, init);
      }

      const method = (
        init?.method ??
        (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();
      const body = await extractRequestBody(input, init);

      const currentState = sandboxDataRef.current;
      if (!currentState) {
        return new Response(
          JSON.stringify({ error: 'État Sandbox non initialisé.' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const next = applySandboxApiMutation(
        currentState,
        method,
        parsedUrl.pathname,
        body
      );
      sandboxDataRef.current = next.state;
      setSandboxData(next.state);

      return new Response(JSON.stringify(next.response.data), {
        status: next.response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    window.fetch = sandboxFetch;
    return () => {
      window.fetch = nativeFetch;
    };
  }, [isSandbox]);

  // Hidden console shortcut: ⌘ + I (macOS) or Ctrl + I (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isLocked) return;

      const mod = event.metaKey || event.ctrlKey;
      if (
        mod &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'i'
      ) {
        event.preventDefault();
        setConsoleOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked]);

  useEffect(() => {
    if (isLocked && isConsoleOpen) {
      setConsoleOpen(false);
    }
  }, [isLocked, isConsoleOpen]);

  useEffect(() => {
    return () => clearTransitionTimer();
  }, [clearTransitionTimer]);

  return (
    <SandboxContext.Provider
      value={{
        isSandbox,
        plannedModuleStatus,
        markPlannedModule,
        isConsoleOpen,
        setConsoleOpen,
        isTransitioning,
        isTourActive,
        tourStep,
        setTourStep,
        nextTourStep,
        prevTourStep,
        startTour,
        closeTour,
        sandboxData,
        syncRealData,
        registerShellNav,
        navigateShell,
        enterSandbox,
        exitSandbox,
        runSandboxImportTransactions,
        runSandboxCloseMonth,
      }}
    >
      {children}
    </SandboxContext.Provider>
  );
}

export function useSandbox() {
  return useContext(SandboxContext);
}

export function SandboxTopBanner() {
  const { isSandbox, startTour, exitSandbox } = useSandbox();

  if (!isSandbox) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[60] h-7 bg-[#B45309] text-[#F7F6F2] border-b border-[#92400E] px-2.5 sm:px-5 flex items-center justify-between gap-2 font-mono text-[10px] sm:text-[11px] tabular-nums select-none"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-[#FDE68A] shrink-0"
        />
        <span className="truncate font-semibold tracking-wider">
          MODE TEST / SANDBOX — SIMULATIONS EN MÉMOIRE UNIQUEMENT
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={startTour}
          className="hidden sm:inline-flex items-center px-1.5 py-0.5 border border-[#FDE68A]/50 text-[#F7F6F2] hover:bg-[#92400E] transition-colors rounded-[2px] tracking-wide"
        >
          [GUIDE]
        </button>
        <button
          type="button"
          onClick={exitSandbox}
          className="inline-flex items-center px-1.5 py-0.5 bg-[#111110]/30 hover:bg-[#111110]/55 border border-[#F7F6F2]/40 text-[#F7F6F2] transition-colors rounded-[2px] font-semibold tracking-wide"
        >
          [QUITTER (exit)]
        </button>
      </div>
    </div>
  );
}
