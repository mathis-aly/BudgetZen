'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSandbox } from '@/features/dev-console';

const SPLIT_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];
const DROP_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function PlanningWaveIntro() {
  const { isPlanningIntroActive, completePlanningIntro } = useSandbox();

  if (!isPlanningIntroActive) return null;

  return <PlanningWaveIntroSequence onComplete={completePlanningIntro} />;
}

function PlanningWaveIntroSequence({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [splitPhase, setSplitPhase] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSplitPhase(true);
    }, 750);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      id="planning-wave-intro"
      onClick={onComplete}
      role="dialog"
      aria-modal="true"
      aria-label="Ouverture du mode Planification"
      className="fixed inset-0 z-[55] pointer-events-auto select-none overflow-hidden cursor-pointer"
    >
      {/* Left Split Panel (0s -> 0.75s static, 0.75s -> 1.20s slides left) */}
      <motion.div
        initial={{ x: '0%' }}
        animate={{ x: '-100%' }}
        transition={{ delay: 0.75, duration: 0.45, ease: SPLIT_EASE }}
        className="fixed inset-y-0 left-0 w-1/2 z-10 bg-[#111110] border-r border-[#2A2A27]/60 overflow-hidden"
      >
        {splitPhase && (
          <span
            aria-hidden="true"
            className="absolute right-0 top-1/2 -translate-y-1/2 font-serif text-7xl text-[#F7F6F2] leading-none tracking-tight inline-block w-[0.95em] text-right pr-[0.03em]"
          >
            M
          </span>
        )}
      </motion.div>

      {/* Right Split Panel (0s -> 0.75s static, 0.75s -> 1.20s slides right) */}
      <motion.div
        initial={{ x: '0%' }}
        animate={{ x: '100%' }}
        transition={{ delay: 0.75, duration: 0.45, ease: SPLIT_EASE }}
        className="fixed inset-y-0 right-0 w-1/2 z-10 bg-[#111110] border-l border-[#2A2A27]/60 overflow-hidden"
      >
        {splitPhase && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 -translate-y-1/2 font-serif text-7xl text-[#F7F6F2] leading-none tracking-tight inline-block w-[0.95em] text-left pl-[0.03em]"
          >
            L
          </span>
        )}
      </motion.div>

      {/* Phase 1: Central Fine Paper Sine Wave (0s -> 0.45s trace, fades out by 0.75s) */}
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-1/2 -translate-y-1/2 h-32 z-20 pointer-events-none"
      >
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
        >
          <motion.path
            d="M 0 60 C 100 14, 200 106, 300 60 C 400 14, 500 106, 600 60 C 700 14, 800 106, 900 60 C 1000 14, 1100 106, 1200 60"
            fill="none"
            stroke="#F7F6F2"
            strokeWidth={1.5}
            strokeLinecap="round"
            style={{ originX: '50%', originY: '50%' }}
            initial={{ pathLength: 0, opacity: 0, scaleY: 0.25 }}
            animate={{
              pathLength: [0, 1, 1, 1],
              opacity: [0, 1, 1, 0],
              scaleY: [0.25, 1.15, -0.8, 0.2],
            }}
            transition={{
              duration: 0.75,
              times: [0, 0.42, 0.76, 1],
              ease: DROP_EASE,
            }}
          />
        </svg>
      </div>

      {/* Phase 2: ML Monogram Drops & Rotates 360° (0.30s -> 0.75s) */}
      {!splitPhase && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ y: -140, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.16, ease: DROP_EASE }}
          >
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ delay: 0.4, duration: 0.35, ease: DROP_EASE }}
              className="flex items-center font-serif text-7xl text-[#F7F6F2] leading-none tracking-tight"
            >
              <span className="inline-block w-[0.95em] text-right pr-[0.03em]">
                M
              </span>
              <span className="inline-block w-[0.95em] text-left pl-[0.03em]">
                L
              </span>
            </motion.div>
          </motion.div>
        </div>
      )}

      {/* Subtle Skip Control */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onComplete();
        }}
        className="fixed bottom-6 right-6 z-40 px-2.5 py-1 border border-[#2A2A27] text-[#9A9890] hover:text-[#F7F6F2] font-mono text-[10px] uppercase tracking-[0.14em] rounded-[2px] transition-colors"
      >
        Passer
      </button>
    </div>
  );
}
