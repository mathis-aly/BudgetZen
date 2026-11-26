'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSandbox } from './SandboxContext';

export function SandboxTransition() {
  const { isTransitioning } = useSandbox();

  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          key="sandbox-transition"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[85] bg-[#111110] text-[#F7F6F2] flex items-center justify-center overflow-hidden select-none pointer-events-auto"
          aria-live="assertive"
        >
          {/* Editorial Swiss Grid Backdrop */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                'linear-gradient(to right, #2A2A27 1px, transparent 1px), linear-gradient(to bottom, #2A2A27 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />

          {/* Sweeping Amber Calibration Line (0 -> 0.9s) */}
          <motion.div
            aria-hidden="true"
            initial={{ y: '-10vh', opacity: 0 }}
            animate={{ y: '110vh', opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 top-0 h-[2px] bg-[#F59E0B]"
          />

          {/* Center Typographic Focal Point */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 px-6 py-8 border border-[#2A2A27] bg-[#111110]/95 text-center max-w-md mx-4"
          >
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#F59E0B] mb-2 tabular-nums">
              SANDBOX RUNTIME // ISOLATION ACTIVE
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl tracking-tight text-[#F7F6F2]">
              MODE SIMULATION
            </h2>
            <div className="mt-3 pt-3 border-t border-[#2A2A27] font-mono text-xs text-[#E2E0D8] tabular-nums">
              « Environnement isolé initialisé »
            </div>
            <div className="mt-1 font-mono text-[10px] text-[#9A9890] uppercase tracking-wider tabular-nums">
              Clonage mémoire · Zéro mutation SQLite
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
