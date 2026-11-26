'use client';

import React, { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';
import { formatCurrency } from '@/core';
import { cn } from '@/lib/cn';

export interface RollingNumberProps {
  value: number;
  currency?: string;
  formatter?: (val: number) => string;
  duration?: number;
  className?: string;
}

/**
 * Mechanical editorial counter that smoothly rolls numbers over 500ms
 * on mount or whenever `value` updates, using strict tabular-nums alignment.
 */
export function RollingNumber({
  value,
  currency = 'EUR',
  formatter,
  duration = 0.5,
  className,
}: RollingNumberProps) {
  const safeTarget = Number.isFinite(value) ? value : 0;
  const previousRef = useRef<number>(0);
  const [displayValue, setDisplayValue] = useState<number>(safeTarget);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const from = hasMountedRef.current ? previousRef.current : safeTarget * 0.88;
    hasMountedRef.current = true;
    previousRef.current = safeTarget;

    if (Math.abs(safeTarget - from) < 0.001) {
      setDisplayValue(safeTarget);
      return;
    }

    const controls = animate(from, safeTarget, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplayValue(latest),
      onComplete: () => setDisplayValue(safeTarget),
    });

    return () => controls.stop();
  }, [safeTarget, duration]);

  const formatted = formatter
    ? formatter(displayValue)
    : formatCurrency(displayValue, currency);

  return (
    <span className={cn('tabular-nums', className)}>
      {formatted}
    </span>
  );
}
