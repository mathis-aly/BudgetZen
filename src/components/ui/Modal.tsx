'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Crisp Editorial Ink Backdrop */}
      <div
        className="fixed inset-0 bg-[#141413]/55 dark:bg-black/75"
        onClick={onClose}
      />

      {/* Sharp Swiss Editorial Sheet / Dialog (max rounded-md, 1px hairline border, zero soft shadow) */}
      <div
        className={cn(
          'relative z-10 w-full bg-[#FFFFFF] dark:bg-[#181816] rounded-t-md sm:rounded-md border border-[#E2E0D8] dark:border-[#2A2A27] max-h-[92dvh] flex flex-col overflow-hidden animate-slide-up-tight',
          maxWidth
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413]">
          <div>
            <h3 className="font-serif text-[21px] font-medium tracking-[-0.015em] leading-tight text-[#141413] dark:text-[#F2F0E8]">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[#5C5B57] dark:text-[#9A9890] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="h-8 w-8 rounded-md border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FFFFFF] dark:bg-[#181816] flex items-center justify-center text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8] hover:border-[#141413]/40 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
