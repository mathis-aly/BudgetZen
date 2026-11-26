'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { motion } from 'framer-motion';

export const INTRO_STORAGE_KEY = 'budgetzen_intro_seen';
export const INTRO_DONE_EVENT = 'budgetzen:intro-done';

const HOROLOGICAL_OPEN_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];
const EMERGENCY_CLOSE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const DRAW_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const DOUBLE_ESCAPE_WINDOW_MS = 350;

type ShieldMode = 'intro' | 'unlocked' | 'locked' | 'unlocking';

interface PrivacyShieldContextValue {
  isLocked: boolean;
  mode: ShieldMode;
  lock: () => void;
  unlock: () => void;
}

const PrivacyShieldContext = createContext<PrivacyShieldContextValue>({
  isLocked: false,
  mode: 'unlocked',
  lock: () => {},
  unlock: () => {},
});

/**
 * Hook providing access to the Privacy Shield state & controls (`isLocked`, `lock`, `unlock`).
 */
export function usePrivacyShield() {
  return useContext(PrivacyShieldContext);
}

/**
 * Global provider managing:
 * - Initial once-per-session intro state (`sessionStorage.getItem('budgetzen_intro_seen')`)
 * - Double `Escape` (< 350ms) instant lock without interfering with single `Escape`
 * - `Enter` unlock exclusively when locked
 * - Capture-phase shortcut isolation while `isLocked === true`
 */
export function PrivacyShieldProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<ShieldMode>('intro');
  const lastEscapeAtRef = useRef<number>(0);

  const isLocked = mode === 'locked' || mode === 'unlocking';

  const markIntroSeen = useCallback(() => {
    try {
      window.sessionStorage.setItem(INTRO_STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors in restricted environments
    }
    document.documentElement.dataset.introSeen = '1';
    window.dispatchEvent(new CustomEvent(INTRO_DONE_EVENT));
  }, []);

  const finishIntro = useCallback(() => {
    markIntroSeen();
    setMode((curr) => (curr === 'intro' ? 'unlocked' : curr));
  }, [markIntroSeen]);

  const lock = useCallback(() => {
    markIntroSeen();
    // Blur any active input behind the shield so stray keys never mutate hidden fields
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setMode('locked');
  }, [markIntroSeen]);

  const unlock = useCallback(() => {
    setMode((curr) => (curr === 'locked' ? 'unlocking' : curr));
  }, []);

  const completeUnlock = useCallback(() => {
    setMode((curr) => (curr === 'unlocking' ? 'unlocked' : curr));
  }, []);

  // Skip intro immediately if already seen in this browser session
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(INTRO_STORAGE_KEY)) {
        document.documentElement.dataset.introSeen = '1';
        setMode('unlocked');
      }
    } catch {
      // Continue with intro if sessionStorage is unavailable
    }
  }, []);

  // Global keyboard handler for Double-Escape lock, Enter unlock, and shortcut isolation
  useEffect(() => {
    const handleKeyDownCapture = (e: KeyboardEvent) => {
      // Intro mode: allow Escape / Enter / Space to skip intro cleanly
      if (mode === 'intro') {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          finishIntro();
        }
        return;
      }

      // Locked mode: ONLY Enter unlocks; block all other global shortcuts (⌘K, ⌘E, ⌘1-6, N, etc.)
      if (mode === 'locked') {
        if (e.key === 'Enter' && !e.repeat) {
          e.preventDefault();
          e.stopPropagation();
          unlock();
          return;
        }

        const mod = e.metaKey || e.ctrlKey;
        if (mod || e.key === 'Escape' || e.key.toLowerCase() === 'n' || e.key === '+') {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      if (mode === 'unlocking') {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      // Unlocked mode: listen for Double Escape (< 350ms) WITHOUT blocking single Escape
      if (e.key === 'Escape' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const now = performance.now();
        if (now - lastEscapeAtRef.current <= DOUBLE_ESCAPE_WINDOW_MS) {
          lastEscapeAtRef.current = 0;
          e.preventDefault();
          lock();
        } else {
          lastEscapeAtRef.current = now;
        }
      }
    };

    // Use capture phase so locked state reliably isolates shortcuts before child listeners fire
    window.addEventListener('keydown', handleKeyDownCapture, { capture: true });
    return () =>
      window.removeEventListener('keydown', handleKeyDownCapture, { capture: true });
  }, [mode, finishIntro, lock, unlock]);

  return (
    <PrivacyShieldContext.Provider value={{ isLocked, mode, lock, unlock }}>
      <PrivacyShieldOverlay
        mode={mode}
        onFinishIntro={finishIntro}
        onUnlock={unlock}
        onCompleteUnlock={completeUnlock}
      />
      {children}
    </PrivacyShieldContext.Provider>
  );
}

/**
 * Architectural Split-Shield Overlay supporting 3 distinct motion states:
 * 1. `intro`     : First session load — SVG trace (0-0.45s) + monogram (0.35-0.70s) + horological parting (0.75-1.25s)
 * 2. `locked`    : Emergency double-Escape close — panels converge from ±100% -> 0% in 250ms, static shield + unlock prompt
 * 3. `unlocking` : Enter / click reopen — text fades and panels part 0% -> ±100% in 350ms without redrawing SVG
 */
function PrivacyShieldOverlay({
  mode,
  onFinishIntro,
  onUnlock,
  onCompleteUnlock,
}: {
  mode: ShieldMode;
  onFinishIntro: () => void;
  onUnlock: () => void;
  onCompleteUnlock: () => void;
}) {
  if (mode === 'unlocked') return null;

  const isIntro = mode === 'intro';
  const isLocked = mode === 'locked';
  const isUnlocking = mode === 'unlocking';

  const leftInitialX = isIntro ? '0%' : isLocked ? '-100%' : '0%';
  const leftAnimateX = isIntro ? '-100%' : isLocked ? '0%' : '-100%';

  const rightInitialX = isIntro ? '0%' : isLocked ? '100%' : '0%';
  const rightAnimateX = isIntro ? '100%' : isLocked ? '0%' : '100%';

  const panelTransition = isIntro
    ? { delay: 0.75, duration: 0.5, ease: HOROLOGICAL_OPEN_EASE }
    : isLocked
      ? { delay: 0, duration: 0.25, ease: EMERGENCY_CLOSE_EASE }
      : { delay: 0.04, duration: 0.35, ease: HOROLOGICAL_OPEN_EASE };

  const gridStyle = {
    backgroundImage:
      'linear-gradient(to right, #2A2A27 1px, transparent 1px), linear-gradient(to bottom, #2A2A27 1px, transparent 1px)',
    backgroundSize: '64px 64px',
  };

  return (
    <div
      id={isIntro ? 'shield-preloader' : 'privacy-shield'}
      onClick={isIntro ? onFinishIntro : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={isLocked ? 'Écran verrouillé' : 'Introduction BudgetZen'}
      className={`fixed inset-0 z-[90] pointer-events-auto select-none overflow-hidden ${
        isIntro ? 'cursor-pointer' : ''
      }`}
    >
      {/* ================================================================= */}
      {/* LEFT SLIDING PANEL (w-1/2) + LEFT HALF OF GEOMETRIC SHIELD        */}
      {/* ================================================================= */}
      <motion.div
        key={`left-${isIntro ? 'intro' : 'shield'}`}
        initial={{ x: leftInitialX }}
        animate={{ x: leftAnimateX }}
        transition={panelTransition}
        className="absolute inset-y-0 left-0 w-1/2 z-10 bg-[#111110] overflow-hidden border-r border-[#2A2A27]/60"
      >
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={gridStyle}
        />

        <svg
          viewBox="0 0 110 260"
          fill="none"
          className="absolute right-0 top-1/2 -translate-y-1/2 w-[104px] sm:w-[122px] h-auto overflow-visible"
        >
          <motion.path
            d="M 110 10 L 22 34 L 12 132 L 42 204 L 110 250"
            stroke="#F7F6F2"
            strokeWidth="1.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
            initial={{ pathLength: isIntro ? 0 : 1 }}
            animate={{ pathLength: 1 }}
            transition={isIntro ? { duration: 0.45, ease: DRAW_EASE } : { duration: 0 }}
          />
          <motion.path
            d="M 110 22 L 32 43 L 24 130 L 50 196 L 110 237"
            stroke="#F7F6F2"
            strokeOpacity="0.22"
            strokeWidth="1"
            strokeLinecap="square"
            strokeLinejoin="miter"
            initial={{ pathLength: isIntro ? 0 : 1 }}
            animate={{ pathLength: 1 }}
            transition={
              isIntro ? { duration: 0.45, delay: 0.05, ease: DRAW_EASE } : { duration: 0 }
            }
          />
          <motion.line
            x1="109.25"
            y1="10"
            x2="109.25"
            y2="250"
            stroke="#F7F6F2"
            strokeOpacity="0.45"
            strokeWidth="1"
            initial={{ pathLength: isIntro ? 0 : 1 }}
            animate={{ pathLength: 1 }}
            transition={isIntro ? { duration: 0.45, ease: DRAW_EASE } : { duration: 0 }}
          />
        </svg>
      </motion.div>

      {/* ================================================================= */}
      {/* RIGHT SLIDING PANEL (w-1/2) + RIGHT HALF OF GEOMETRIC SHIELD      */}
      {/* ================================================================= */}
      <motion.div
        key={`right-${isIntro ? 'intro' : 'shield'}`}
        initial={{ x: rightInitialX }}
        animate={{ x: rightAnimateX }}
        transition={panelTransition}
        onAnimationComplete={() => {
          if (isIntro) onFinishIntro();
          else if (isUnlocking) onCompleteUnlock();
        }}
        className="absolute inset-y-0 right-0 w-1/2 z-10 bg-[#111110] overflow-hidden border-l border-[#2A2A27]/60"
      >
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={gridStyle}
        />

        <svg
          viewBox="0 0 110 260"
          fill="none"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[104px] sm:w-[122px] h-auto overflow-visible"
        >
          <motion.path
            d="M 0 10 L 88 34 L 98 132 L 68 204 L 0 250"
            stroke="#F7F6F2"
            strokeWidth="1.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
            initial={{ pathLength: isIntro ? 0 : 1 }}
            animate={{ pathLength: 1 }}
            transition={isIntro ? { duration: 0.45, ease: DRAW_EASE } : { duration: 0 }}
          />
          <motion.path
            d="M 0 22 L 78 43 L 86 130 L 60 196 L 0 237"
            stroke="#F7F6F2"
            strokeOpacity="0.22"
            strokeWidth="1"
            strokeLinecap="square"
            strokeLinejoin="miter"
            initial={{ pathLength: isIntro ? 0 : 1 }}
            animate={{ pathLength: 1 }}
            transition={
              isIntro ? { duration: 0.45, delay: 0.05, ease: DRAW_EASE } : { duration: 0 }
            }
          />
          <motion.line
            x1="0.75"
            y1="10"
            x2="0.75"
            y2="250"
            stroke="#F7F6F2"
            strokeOpacity="0.45"
            strokeWidth="1"
            initial={{ pathLength: isIntro ? 0 : 1 }}
            animate={{ pathLength: 1 }}
            transition={isIntro ? { duration: 0.45, ease: DRAW_EASE } : { duration: 0 }}
          />
        </svg>
      </motion.div>

      {/* ================================================================= */}
      {/* CENTERED MONOGRAM ("BUDGETZEN" / "ML")                            */}
      {/* ================================================================= */}
      {isIntro ? (
        <motion.div
          key="monogram-intro"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0.94, 1, 1, 1],
          }}
          transition={{
            delay: 0.35,
            duration: 0.9,
            times: [0, 0.38, 0.72, 1],
            ease: DRAW_EASE,
          }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none px-6"
        >
          <div className="flex flex-col items-center text-center bg-[#111110]/75 px-4 py-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#9A9890] pl-[0.3em]">
              BUDGETZEN
            </span>
            <div className="mt-2.5 flex flex-col items-center">
              <span className="w-20 h-[1px] bg-[#F7F6F2]/40 mb-2" />
              <span className="font-serif text-6xl sm:text-7xl font-normal tracking-tight text-[#F7F6F2] leading-none">
                ML
              </span>
              <span className="w-20 h-[1px] bg-[#F7F6F2]/40 mt-2.5" />
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="monogram-locked"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={
            isLocked
              ? { opacity: 1, scale: 1 }
              : { opacity: 0, scale: 0.98 }
          }
          transition={
            isLocked
              ? { delay: 0.2, duration: 0.16, ease: DRAW_EASE }
              : { duration: 0.14, ease: 'easeOut' }
          }
          className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none px-6"
        >
          <div className="flex flex-col items-center text-center bg-[#111110]/80 px-4 py-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#9A9890] pl-[0.3em]">
              BUDGETZEN
            </span>
            <div className="mt-2.5 flex flex-col items-center">
              <span className="w-20 h-[1px] bg-[#F7F6F2]/40 mb-2" />
              <span className="font-serif text-6xl sm:text-7xl font-normal tracking-tight text-[#F7F6F2] leading-none">
                ML
              </span>
              <span className="w-20 h-[1px] bg-[#F7F6F2]/40 mt-2.5" />
            </div>
          </div>
        </motion.div>
      )}

      {/* ================================================================= */}
      {/* BOTTOM CONTROLS: "PASSER" (INTRO) OR UNLOCK PROMPT (LOCKED)       */}
      {/* ================================================================= */}
      {isIntro ? (
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.85, 0.85, 0] }}
          transition={{
            delay: 0.1,
            duration: 1.05,
            times: [0, 0.15, 0.75, 1],
          }}
          onClick={(e) => {
            e.stopPropagation();
            onFinishIntro();
          }}
          className="absolute right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9A9890] hover:text-[#F7F6F2] border border-[#2A2A27] hover:border-[#F7F6F2]/40 bg-[#111110] px-3 py-1.5 rounded-sm transition-colors"
        >
          Passer →
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={isLocked ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
          transition={
            isLocked
              ? { delay: 0.22, duration: 0.18, ease: DRAW_EASE }
              : { duration: 0.12 }
          }
          className="absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-4"
        >
          <button
            type="button"
            onClick={onUnlock}
            className="font-mono text-xs tracking-[0.12em] uppercase text-[#9A9890] hover:text-[#F7F6F2] border border-[#2A2A27] hover:border-[#F7F6F2]/40 bg-[#111110] px-4 py-2 rounded-sm transition-colors cursor-pointer"
          >
            ÉCRAN VERROUILLÉ — APPUYER SUR ENTRÉE POUR ROUVRIR
          </button>
        </motion.div>
      )}
    </div>
  );
}

export { PrivacyShieldOverlay as PrivacyShield };
