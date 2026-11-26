'use client';

import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ToastMessage {
  id: number;
  text: string;
  tone?: 'success' | 'error';
}

export function ToastContainer({ toast }: { toast: ToastMessage | null }) {
  if (!toast) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] pointer-events-none px-4 w-full max-w-md flex justify-center animate-slide-up-tight">
      <div
        className={cn(
          'flex items-center gap-2.5 px-4 py-2.5 rounded-md font-mono text-xs font-medium border',
          toast.tone === 'error'
            ? 'bg-[#B91C1C] text-[#FFFFFF] border-[#991B1B]'
            : 'bg-[#141413] text-[#F2F0E8] border-[#2A2A27] dark:bg-[#F2F0E8] dark:text-[#111110] dark:border-[#E2E0D8]'
        )}
      >
        {toast.tone === 'error' ? (
          <AlertCircle className="h-4 w-4 shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22C55E] dark:text-[#15803D]" />
        )}
        <span>{toast.text}</span>
      </div>
    </div>
  );
}
