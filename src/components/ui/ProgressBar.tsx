import React from 'react';
import { cn } from '@/lib/cn';
import type { AlertStatus } from '@/core';

/**
 * Surgical Swiss Editorial threshold gauge (`h-2`) with a crisp vertical
 * threshold marker (defaulting to 80%) indicating the attention boundary.
 */
export function ProgressBar({
  value,
  status = 'green',
  markerPercent = 80,
  height = 'md',
  className,
}: {
  value: number; // 0..100+
  status?: AlertStatus;
  markerPercent?: number;
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  const barColors: Record<AlertStatus, string> = {
    green: 'bg-[#15803D] dark:bg-[#22C55E]',
    orange: 'bg-[#B45309] dark:bg-[#F59E0B]',
    red: 'bg-[#B91C1C] dark:bg-[#EF4444]',
  };

  // Surgical thin gauges (max h-2)
  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-2',
  };

  return (
    <div
      className={cn(
        'relative w-full overflow-visible rounded-[2px] bg-[#E2E0D8]/75 dark:bg-[#2A2A27]',
        heights[height],
        className
      )}
    >
      <div
        className={cn(
          'h-full rounded-[2px] transition-all duration-500 ease-out',
          barColors[status]
        )}
        style={{ width: `${clamped}%` }}
      />
      {markerPercent !== undefined && markerPercent > 0 && markerPercent < 100 && (
        <div
          className="absolute -top-[2px] -bottom-[2px] w-[1.5px] bg-[#141413] dark:bg-[#F2F0E8] z-10 pointer-events-none"
          style={{ left: `${markerPercent}%` }}
          title={`Seuil d'attention : ${Math.round(markerPercent)}%`}
        />
      )}
    </div>
  );
}
