'use client';

import React from 'react';
import { cn } from '@/lib/cn';
import type { PaceStatus } from '@/core';
import { formatPercent } from '@/core';

export function SpendingPaceGauge({
  spendingPacePercent,
  monthProgressPercent,
  paceStatus,
  currentDayOfMonth,
  daysInMonth,
}: {
  spendingPacePercent: number;
  monthProgressPercent: number;
  paceStatus: PaceStatus;
  currentDayOfMonth: number;
  daysInMonth: number;
}) {
  const clampedSpend = Math.max(0, Math.min(100, spendingPacePercent));
  const clampedMonth = Math.max(0, Math.min(100, monthProgressPercent));

  const statusMeta: Record<
    PaceStatus,
    { label: string; bar: string; pill: string }
  > = {
    ahead: {
      label: 'RYTHME MAÎTRISÉ',
      bar: 'bg-[#15803D] dark:bg-[#22C55E]',
      pill: 'text-[#15803D] border-[#15803D]/30 bg-[#15803D]/[0.07] dark:text-[#22C55E] dark:border-[#22C55E]/35 dark:bg-[#22C55E]/[0.12]',
    },
    watch: {
      label: 'VIGILANCE RYTHME',
      bar: 'bg-[#B45309] dark:bg-[#F59E0B]',
      pill: 'text-[#B45309] border-[#B45309]/30 bg-[#B45309]/[0.07] dark:text-[#F59E0B] dark:border-[#F59E0B]/35 dark:bg-[#F59E0B]/[0.12]',
    },
    fast: {
      label: 'RYTHME ÉLEVÉ',
      bar: 'bg-[#B91C1C] dark:bg-[#EF4444]',
      pill: 'text-[#B91C1C] border-[#B91C1C]/30 bg-[#B91C1C]/[0.07] dark:text-[#EF4444] dark:border-[#EF4444]/35 dark:bg-[#EF4444]/[0.12]',
    },
  };

  const meta = statusMeta[paceStatus];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5C5B57] dark:text-[#9A9890]">
            Cadence mensuelle
          </span>
          <span
            className={cn(
              'font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-sm border',
              meta.pill
            )}
          >
            {meta.label}
          </span>
        </div>
        <span className="font-mono text-xs font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8]">
          J{currentDayOfMonth}/{daysInMonth}
        </span>
      </div>

      {/* Surgical 8px gauge with crisp vertical calendar pin + 80% threshold hairline */}
      <div className="relative pt-4 pb-1">
        <div
          className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-500"
          style={{ left: `${Math.min(92, Math.max(8, clampedMonth))}%` }}
        >
          <span className="font-mono text-[10px] font-semibold tabular-nums text-[#5C5B57] dark:text-[#9A9890] whitespace-nowrap">
            Mois {formatPercent(monthProgressPercent)}
          </span>
        </div>

        <div className="relative h-2 w-full rounded-[2px] bg-[#E2E0D8]/80 dark:bg-[#2A2A27] overflow-visible">
          <div
            className={cn(
              'h-full rounded-[2px] transition-all duration-500 ease-out',
              meta.bar
            )}
            style={{ width: `${clampedSpend}%` }}
          />
          {/* Subtle 80% warning tick */}
          <div
            className="absolute top-0 bottom-0 w-[1px] bg-[#5C5B57]/40 dark:bg-[#9A9890]/40"
            style={{ left: '80%' }}
            title="Repère 80 %"
          />
          {/* Crisp calendar vertical indicator */}
          <div
            className="absolute -top-1 -bottom-1 -translate-x-1/2 w-[2px] bg-[#141413] dark:bg-[#F2F0E8] transition-all duration-500"
            style={{ left: `${clampedMonth}%` }}
            title={`Avancement du mois : ${formatPercent(monthProgressPercent)}`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between font-mono text-[11px] text-[#5C5B57] dark:text-[#9A9890] tabular-nums">
        <span>
          Budgets consommés :{' '}
          <strong className="text-[#141413] dark:text-[#F2F0E8]">
            {formatPercent(spendingPacePercent)}
          </strong>
        </span>
        <span>
          Calendrier :{' '}
          <strong className="text-[#141413] dark:text-[#F2F0E8]">
            {formatPercent(monthProgressPercent)}
          </strong>
        </span>
      </div>
    </div>
  );
}
