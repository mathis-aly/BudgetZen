'use client';

import React from 'react';
import type { AnalyticsTimeframe } from '@/core';
import { cn } from '@/lib/cn';

export const TIMEFRAME_OPTIONS: Array<{
  id: AnalyticsTimeframe;
  label: string;
  fullLabel: string;
}> = [
  { id: 'DAY', label: '1J', fullLabel: "Aujourd'hui (24h)" },
  { id: 'WEEK', label: '1S', fullLabel: '7 derniers jours' },
  { id: 'MONTH', label: '1M', fullLabel: '30 derniers jours' },
  { id: '1Y', label: '1A', fullLabel: '1 an' },
  { id: '3Y', label: '3A', fullLabel: '3 ans' },
  { id: '5Y', label: '5A', fullLabel: '5 ans' },
  { id: '10Y', label: '10A', fullLabel: '10 ans' },
  { id: 'ALL', label: 'TOUT', fullLabel: "Tout l'historique" },
];

export interface TimeframeSelectorProps {
  value: AnalyticsTimeframe;
  onChange: (next: AnalyticsTimeframe) => void;
  rangeLabel?: string;
  granularityLabel?: string;
  historyNotice?: string | null;
  className?: string;
}

/**
 * Swiss Editorial horizontal segmented timeframe selector inspired by financial terminals:
 * 1J | 1S | 1M | 1A | 3A | 5A | 10A | TOUT
 */
export function TimeframeSelector({
  value,
  onChange,
  rangeLabel,
  granularityLabel,
  historyNotice,
  className,
}: TimeframeSelectorProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div
          role="tablist"
          aria-label="Horizon d'analyse"
          className="inline-flex w-full sm:w-auto overflow-x-auto rounded-md border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FFFFFF] dark:bg-[#181816] divide-x divide-[#E2E0D8] dark:divide-[#2A2A27]"
        >
          {TIMEFRAME_OPTIONS.map((opt) => {
            const active = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={opt.fullLabel}
                onClick={() => onChange(opt.id)}
                className={cn(
                  'flex-1 sm:flex-none px-2.5 sm:px-3.5 h-8 font-mono text-[11px] font-semibold tabular-nums tracking-[0.04em] transition-colors whitespace-nowrap focus:outline-none',
                  active
                    ? 'bg-[#141413] text-[#F7F6F2] dark:bg-[#F2F0E8] dark:text-[#111110]'
                    : 'text-[#5C5B57] dark:text-[#9A9890] hover:bg-[#FCFBF9] dark:hover:bg-[#1E1E1B] hover:text-[#141413] dark:hover:text-[#F2F0E8]'
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {(rangeLabel || granularityLabel) && (
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#5C5B57] dark:text-[#9A9890] tabular-nums">
            {rangeLabel && <span>{rangeLabel}</span>}
            {granularityLabel && (
              <>
                <span className="opacity-40">·</span>
                <span className="uppercase text-[10px] tracking-[0.08em] text-[#141413] dark:text-[#F2F0E8] font-semibold">
                  {granularityLabel}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {historyNotice && (
        <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890]">
          {historyNotice}
        </p>
      )}
    </div>
  );
}
