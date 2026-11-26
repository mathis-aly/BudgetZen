import React from 'react';
import { cn } from '@/lib/cn';
import type { AlertStatus } from '@/core';

export type BadgeTone = 'neutral' | 'green' | 'orange' | 'red' | 'blue';

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  const styles: Record<BadgeTone, string> = {
    neutral:
      'bg-[#FCFBF9] text-[#5C5B57] border-[#E2E0D8] dark:bg-[#1E1E1B] dark:text-[#9A9890] dark:border-[#2A2A27]',
    green:
      'bg-[#15803D]/[0.08] text-[#15803D] border-[#15803D]/25 dark:bg-[#22C55E]/[0.12] dark:text-[#22C55E] dark:border-[#22C55E]/30',
    orange:
      'bg-[#B45309]/[0.08] text-[#B45309] border-[#B45309]/25 dark:bg-[#F59E0B]/[0.12] dark:text-[#F59E0B] dark:border-[#F59E0B]/30',
    red: 'bg-[#B91C1C]/[0.08] text-[#B91C1C] border-[#B91C1C]/25 dark:bg-[#EF4444]/[0.12] dark:text-[#EF4444] dark:border-[#EF4444]/30',
    blue: 'bg-[#141413]/[0.05] text-[#141413] border-[#141413]/20 dark:bg-[#F2F0E8]/[0.08] dark:text-[#F2F0E8] dark:border-[#F2F0E8]/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-tight whitespace-nowrap tabular-nums',
        styles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function AlertStatusBadge({
  status,
  usagePercent,
}: {
  status: AlertStatus;
  usagePercent: number;
}) {
  const label =
    status === 'red'
      ? `DÉPASSÉ · ${Math.round(usagePercent)}%`
      : status === 'orange'
        ? `SEUIL · ${Math.round(usagePercent)}%`
        : `${Math.round(usagePercent)}%`;

  return (
    <Badge tone={status}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-[1px]',
          status === 'red' && 'bg-[#B91C1C] dark:bg-[#EF4444]',
          status === 'orange' && 'bg-[#B45309] dark:bg-[#F59E0B]',
          status === 'green' && 'bg-[#15803D] dark:bg-[#22C55E]'
        )}
      />
      {label}
    </Badge>
  );
}
