'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { toISODateOnly } from '@/core';
import { Button, type ButtonProps } from './Button';

export interface ExportCsvButtonProps {
  label?: string;
  filenamePrefix: string;
  getCsvContent: () => string;
  disabled?: boolean;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  onExported?: (filename: string) => void;
}

export function ExportCsvButton({
  label = 'Exporter en CSV',
  filenamePrefix,
  getCsvContent,
  disabled = false,
  variant = 'secondary',
  size = 'sm',
  className,
  onExported,
}: ExportCsvButtonProps) {
  const handleDownload = () => {
    const csv = getCsvContent();
    const dateStamp = toISODateOnly(new Date());
    const filename = `${filenamePrefix}_${dateStamp}.csv`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    onExported?.(filename);
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={handleDownload}
      className={className}
    >
      <Download className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </Button>
  );
}
