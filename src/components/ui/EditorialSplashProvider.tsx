'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const SPLASH_KEY = 'bz-editorial-splash-seen';

export function EditorialSplashProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showCurtain, setShowCurtain] = useState(false);

  useEffect(() => {
    try {
      const alreadySeen = window.sessionStorage.getItem(SPLASH_KEY);
      if (!alreadySeen) {
        setShowCurtain(true);
        window.sessionStorage.setItem(SPLASH_KEY, '1');
        const timer = window.setTimeout(() => {
          setShowCurtain(false);
        }, 400);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // sessionStorage unavailable (e.g., strict private context): skip curtain safely
    }
  }, []);

  return (
    <>
      <AnimatePresence>
        {showCurtain && (
          <motion.div
            key="editorial-curtain"
            initial={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[100] bg-[#141413] text-[#F2F0E8] flex flex-col items-center justify-center px-6 pointer-events-auto"
            aria-hidden="true"
          >
            <div className="flex flex-col items-center gap-5 max-w-xs w-full">
              {/* Minimalist Swiss Editorial Monogram */}
              <div className="flex items-center gap-3">
                <span className="h-9 w-9 border border-[#F2F0E8]/35 rounded-sm flex items-center justify-center font-serif text-lg tracking-tight">
                  BZ
                </span>
                <div className="text-left">
                  <p className="font-serif text-xl tracking-tight leading-none text-[#F2F0E8]">
                    BudgetZen
                  </p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#9A9890] mt-1">
                    Édition Financière
                  </p>
                </div>
              </div>

              {/* Continuous Financial Curve SVG drawing pathLength 0 -> 1 in 300ms */}
              <svg
                viewBox="0 0 220 44"
                fill="none"
                className="w-52 h-11 overflow-visible"
              >
                <line
                  x1="0"
                  y1="38"
                  x2="220"
                  y2="38"
                  stroke="#2A2A27"
                  strokeWidth="1"
                />
                <motion.path
                  d="M 4 34 L 44 28 L 76 31 L 118 18 L 154 21 L 216 6"
                  stroke="#F2F0E8"
                  strokeWidth="1.75"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                />
                <motion.circle
                  cx="216"
                  cy="6"
                  r="2.5"
                  fill="#22C55E"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.24, duration: 0.12 }}
                />
              </svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
