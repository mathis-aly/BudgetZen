'use client';

import React from 'react';
import { cn } from '@/lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-[#141413] hover:bg-[#2A2A27] text-[#F7F6F2] border border-[#141413] dark:bg-[#F2F0E8] dark:hover:bg-[#E2E0D8] dark:text-[#111110] dark:border-[#F2F0E8]',
      secondary:
        'bg-[#FFFFFF] hover:bg-[#F7F6F2] text-[#141413] border border-[#E2E0D8] dark:bg-[#181816] dark:hover:bg-[#22221F] dark:text-[#F2F0E8] dark:border-[#2A2A27]',
      ghost:
        'bg-transparent hover:bg-[#141413]/[0.05] text-[#5C5B57] hover:text-[#141413] border border-transparent dark:hover:bg-[#F2F0E8]/[0.06] dark:text-[#9A9890] dark:hover:text-[#F2F0E8]',
      danger:
        'bg-[#B91C1C]/[0.07] hover:bg-[#B91C1C]/[0.14] text-[#B91C1C] border border-[#B91C1C]/30 dark:bg-[#EF4444]/[0.12] dark:hover:bg-[#EF4444]/[0.2] dark:text-[#EF4444] dark:border-[#EF4444]/35',
      success:
        'bg-[#15803D] hover:bg-[#166534] text-[#FFFFFF] border border-[#15803D] dark:bg-[#22C55E] dark:hover:bg-[#16A34A] dark:text-[#111110] dark:border-[#22C55E]',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'h-8 px-3 text-xs font-semibold rounded-md gap-1.5',
      md: 'h-10 px-4 text-sm font-semibold rounded-md gap-2',
      lg: 'h-11 px-5 text-sm font-semibold rounded-md gap-2',
      icon: 'h-9 w-9 rounded-md p-0 flex items-center justify-center',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center transition-colors duration-150 select-none active:translate-y-[0.5px] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#141413] dark:focus-visible:ring-[#F2F0E8] disabled:opacity-45 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
