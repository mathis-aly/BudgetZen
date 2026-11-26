'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { NavTab } from '@/features/dashboard';
import { SANDBOX_TOUR_TOTAL_STEPS, useSandbox } from './SandboxContext';

interface TourStepConfig {
  id: string;
  tab: NavTab;
  selector: string;
  badge: string;
  title: string;
  description: string;
}

const TOUR_STEPS: TourStepConfig[] = [
  {
    id: 'income-settings',
    tab: 'dashboard',
    selector: '[data-tour="sandbox-income-settings"]',
    badge: 'ÉTAPE 01 / 03',
    title: 'Modifier les revenus / paramètres',
    description:
      "Simule ici un nouveau salaire (via + ou ⌘E) ou ajuste tes paramètres pour voir l'impact immédiat",
  },
  {
    id: 'reste-reserve',
    tab: 'dashboard',
    selector: '[data-tour="sandbox-reste-reserve"]',
    badge: 'ÉTAPE 02 / 03',
    title: 'Le Reste à vivre & Réserve',
    description:
      "Observe comment ton bouclier et ta capacité d'épargne se recalculent en direct",
  },
  {
    id: 'wealth-sim',
    tab: 'wealth',
    selector: '[data-tour="sandbox-wealth-sim"]',
    badge: 'ÉTAPE 03 / 03',
    title: 'Le Simulateur de Patrimoine',
    description: "Projette ce surplus d'épargne sur 10 ou 20 ans",
  },
];

interface TargetBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  viewportW: number;
  viewportH: number;
}

interface TourGeometry {
  cardX: number;
  cardY: number;
  cardWidth: number;
  pathD: string;
  arrowHeadD: string;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function computeTourGeometry(
  bounds: TargetBounds,
  cardHeight: number
): TourGeometry {
  const vw = bounds.viewportW;
  const vh = bounds.viewportH;
  const margin = 12;
  const topBannerClearance = 38;
  const cardWidth = Math.min(340, Math.max(240, vw - margin * 2));

  const targetCx = bounds.left + bounds.width / 2;
  const targetCy = bounds.top + bounds.height / 2;

  const spaceBelow = vh - bounds.bottom;
  const spaceAbove = bounds.top - topBannerClearance;

  let placement: 'above' | 'below' | 'overlay-bottom' = 'below';
  if (bounds.bottom > vh - 165 || (spaceAbove > spaceBelow && spaceAbove >= cardHeight + 36)) {
    placement = 'above';
  } else if (spaceBelow >= cardHeight + 36) {
    placement = 'below';
  } else if (spaceAbove >= cardHeight + 36) {
    placement = 'above';
  } else {
    placement = 'overlay-bottom';
  }

  let cardX = clamp(targetCx - cardWidth / 2, margin, vw - cardWidth - margin);
  let cardY = topBannerClearance;

  if (placement === 'above') {
    cardY = clamp(
      bounds.top - cardHeight - 64,
      topBannerClearance,
      vh - cardHeight - margin
    );
  } else if (placement === 'below') {
    cardY = clamp(
      bounds.bottom + 64,
      topBannerClearance,
      vh - cardHeight - margin
    );
  } else {
    cardX = clamp(vw - cardWidth - margin, margin, vw - cardWidth - margin);
    cardY = clamp(vh - cardHeight - 20, topBannerClearance, vh - cardHeight - margin);
  }

  // Compute curved quadratic Bézier arrow from card toward target
  let sx = cardX + cardWidth / 2;
  let sy = cardY;
  let ex = clamp(targetCx, bounds.left + 12, bounds.right - 12);
  let ey = bounds.top - 8;

  if (placement === 'above') {
    sx = clamp(targetCx, cardX + 28, cardX + cardWidth - 28);
    sy = cardY + cardHeight + 6;
    ex = clamp(targetCx, bounds.left + 8, bounds.right - 8);
    ey = bounds.top - 8;
  } else if (placement === 'below') {
    sx = clamp(targetCx, cardX + 28, cardX + cardWidth - 28);
    sy = cardY - 6;
    ex = clamp(targetCx, bounds.left + 8, bounds.right - 8);
    ey = bounds.bottom + 8;
  } else {
    // Overlay bottom pointing up toward the upper-center of target frame
    sx = cardX + cardWidth * 0.35;
    sy = cardY - 6;
    ex = clamp(targetCx, bounds.left + 20, bounds.right - 20);
    ey = clamp(bounds.top + 36, topBannerClearance + 12, sy - 36);
  }

  const dx = ex - sx;
  const dy = ey - sy;
  const dist = Math.hypot(dx, dy) || 1;
  const bendMag = Math.min(48, Math.max(18, dist * 0.28));
  const bendDir = targetCx > vw / 2 ? -1 : 1;

  const midX = (sx + ex) / 2;
  const midY = (sy + ey) / 2;
  // Perpendicular vector (-dy, dx) normalized
  const perpX = (-dy / dist) * bendMag * bendDir;
  const perpY = (dx / dist) * bendMag * bendDir;

  const cx = clamp(midX + perpX, 16, vw - 16);
  const cy = clamp(midY + perpY, topBannerClearance, vh - 16);

  // Tangent vector at Bézier end t=1 is proportional to (ex - cx, ey - cy)
  const tx = ex - cx;
  const ty = ey - cy;
  const angle = Math.atan2(ty, tx);
  const headLen = 10;
  const wingSpread = 0.48; // ~27.5 deg

  const w1x = ex - headLen * Math.cos(angle - wingSpread);
  const w1y = ey - headLen * Math.sin(angle - wingSpread);
  const w2x = ex - headLen * Math.cos(angle + wingSpread);
  const w2y = ey - headLen * Math.sin(angle + wingSpread);

  const pathD = `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  const arrowHeadD = `M ${w1x.toFixed(1)} ${w1y.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)} L ${w2x.toFixed(1)} ${w2y.toFixed(1)}`;

  void targetCy;

  return {
    cardX,
    cardY,
    cardWidth,
    pathD,
    arrowHeadD,
  };
}

export function SandboxTour() {
  const {
    isSandbox,
    isTourActive,
    tourStep,
    nextTourStep,
    prevTourStep,
    closeTour,
    navigateShell,
  } = useSandbox();

  const [bounds, setBounds] = useState<TargetBounds | null>(null);
  const [cardHeight, setCardHeight] = useState(236);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const step = TOUR_STEPS[tourStep] ?? TOUR_STEPS[0];

  const measureTarget = useCallback(() => {
    if (!isSandbox || !isTourActive || !step) return;
    if (cardRef.current && cardRef.current.offsetHeight > 0) {
      const measured = cardRef.current.offsetHeight;
      setCardHeight((prev) => (prev !== measured ? measured : prev));
    }
    const el = document.querySelector(step.selector);
    if (!el) {
      setBounds(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setBounds({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
    });
  }, [isSandbox, isTourActive, step]);

  // Measure floating tour card height cleanly once committed for each step
  useEffect(() => {
    if (!isSandbox || !isTourActive) return;
    const raf = window.requestAnimationFrame(() => {
      if (cardRef.current && cardRef.current.offsetHeight > 0) {
        setCardHeight(cardRef.current.offsetHeight);
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isSandbox, isTourActive, tourStep]);

  // Switch active shell tab when tour step changes and scroll target into view
  useEffect(() => {
    if (!isSandbox || !isTourActive || !step) return;
    navigateShell(step.tab);

    let settledTimer: number | null = null;
    const raf = window.requestAnimationFrame(() => {
      settledTimer = window.setTimeout(() => {
        const el = document.querySelector(step.selector);
        if (el) {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (
            style.position !== 'fixed' &&
            (rect.top < 56 || rect.bottom > window.innerHeight - 28)
          ) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        measureTarget();
      }, 90);
    });

    return () => {
      window.cancelAnimationFrame(raf);
      if (settledTimer !== null) window.clearTimeout(settledTimer);
    };
  }, [isSandbox, isTourActive, step, navigateShell, measureTarget]);

  // Re-measure on resize or scroll while tour is visible
  useEffect(() => {
    if (!isSandbox || !isTourActive) return;

    const handleUpdate = () => measureTarget();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, {
      passive: true,
      capture: true,
    });

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, { capture: true });
    };
  }, [isSandbox, isTourActive, measureTarget]);

  // Close tour cleanly on Escape (unless another modal dialog is open)
  useEffect(() => {
    if (!isSandbox || !isTourActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        closeTour();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSandbox, isTourActive, closeTour]);

  if (!isSandbox || !isTourActive || !step) return null;

  const geometry = bounds ? computeTourGeometry(bounds, cardHeight) : null;
  const fallbackW =
    typeof window !== 'undefined' ? Math.min(340, window.innerWidth - 24) : 320;
  const fallbackX =
    typeof window !== 'undefined'
      ? Math.max(12, (window.innerWidth - fallbackW) / 2)
      : 16;

  return (
    <AnimatePresence mode="wait">
      <div
        key={step.id}
        className="fixed inset-0 z-[45] pointer-events-none"
        role="region"
        aria-label={`Guide Sandbox — ${step.title}`}
      >
        {/* Subtle Editorial Dimming */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-[#111110]/25 pointer-events-none"
        />

        {/* Target Editorial Frame Highlight */}
        {bounds && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{
              left: Math.max(4, bounds.left - 5),
              top: Math.max(32, bounds.top - 5),
              width: bounds.width + 10,
              height: bounds.height + 10,
            }}
            className="fixed border-2 border-[#F59E0B] bg-[#F59E0B]/5 rounded-md pointer-events-none"
          />
        )}

        {/* Hand-drawn Editorial SVG Curved Arrow */}
        {geometry && (
          <svg
            aria-hidden="true"
            className="fixed inset-0 w-full h-full pointer-events-none overflow-visible"
          >
            <motion.path
              d={geometry.pathD}
              fill="none"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.path
              d={geometry.arrowHeadD}
              fill="none"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                duration: 0.22,
                delay: 0.42,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          </svg>
        )}

        {/* Floating Explanatory Editorial Bubble */}
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          style={{
            left: geometry ? geometry.cardX : fallbackX,
            top: geometry ? geometry.cardY : 80,
            width: geometry ? geometry.cardWidth : fallbackW,
          }}
          className="fixed z-[46] pointer-events-auto bg-[#111110] text-[#F7F6F2] border border-[#2A2A27] rounded-sm p-4"
        >
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#2A2A27] font-mono text-[10px] tracking-[0.14em] uppercase tabular-nums">
            <span className="text-[#F59E0B] font-semibold">{step.badge}</span>
            <span className="text-[#9A9890]">VISITE SANDBOX</span>
          </div>

          <h3 className="mt-2.5 font-serif text-xl leading-snug text-[#F7F6F2]">
            {step.title}
          </h3>
          <p className="mt-1.5 font-mono text-xs leading-relaxed text-[#E2E0D8] tabular-nums">
            {step.description}
          </p>

          <div className="mt-4 pt-3 border-t border-[#2A2A27] flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums">
            <button
              type="button"
              onClick={closeTour}
              className="text-[#9A9890] hover:text-[#F7F6F2] transition-colors underline underline-offset-4"
            >
              Passer le tutoriel
            </button>

            <div className="flex items-center gap-1.5">
              {tourStep > 0 && (
                <button
                  type="button"
                  onClick={prevTourStep}
                  className="px-2 py-1 border border-[#2A2A27] text-[#E2E0D8] hover:border-[#F59E0B] rounded-[2px] transition-colors"
                >
                  Préc.
                </button>
              )}
              <button
                type="button"
                onClick={nextTourStep}
                className="px-3 py-1 bg-[#B45309] hover:bg-[#92400E] text-[#F7F6F2] border border-[#F59E0B]/40 rounded-[2px] font-semibold transition-colors"
              >
                {tourStep + 1 >= SANDBOX_TOUR_TOTAL_STEPS ? 'Terminer' : 'Suivant'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
