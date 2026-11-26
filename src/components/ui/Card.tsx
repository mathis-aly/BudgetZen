import React from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  interactive?: boolean;
}

export function Card({
  className,
  padded = true,
  interactive = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-md bg-[#FFFFFF] dark:bg-[#181816] border border-[#E2E0D8] dark:border-[#2A2A27] transition-colors duration-150',
        padded && 'p-4 sm:p-5',
        interactive &&
          'cursor-pointer hover:border-[#141413]/40 dark:hover:border-[#F2F0E8]/35',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 pb-2.5 mb-3.5 border-b border-[#E2E0D8] dark:border-[#2A2A27]',
        className
      )}
    >
      <div>
        <h2 className="font-serif text-[22px] sm:text-[24px] font-medium tracking-[-0.015em] leading-tight text-[#141413] dark:text-[#F2F0E8]">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-[#5C5B57] dark:text-[#9A9890] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
