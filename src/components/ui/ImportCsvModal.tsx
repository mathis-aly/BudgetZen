'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  CategoryDTO,
  CsvImportParseResult,
  TransactionDTO,
  formatCurrency,
  formatDateShort,
  generateTransactionsTemplateCSV,
  parseTransactionsCSV,
} from '@/core';
import { importTransactionsAction } from '@/features/transactions/actions';
import { useSandbox } from '@/features/dev-console';
import { cn } from '@/lib/cn';
import { Badge } from './Badge';
import { Button } from './Button';
import { Modal } from './Modal';

export function ImportCsvModal({
  open,
  onClose,
  categories,
  transactions,
  currency = 'EUR',
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  currency?: string;
  onImported: (message: string) => Promise<void>;
}) {
  const { isSandbox, runSandboxImportTransactions } = useSandbox();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<CsvImportParseResult | null>(null);
  const [ignoreDuplicates, setIgnoreDuplicates] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setFileName('');
      setIsDragging(false);
      setParseResult(null);
      setIgnoreDuplicates(true);
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setError('Veuillez sélectionner un fichier au format .csv.');
      return;
    }

    try {
      const content = await file.text();
      const parsed = parseTransactionsCSV(content, {
        existingCategories: categories,
        existingTransactions: transactions,
      });

      if (parsed.headerError) {
        setError(parsed.headerError);
        return;
      }

      setFileName(file.name);
      setParseResult(parsed);
      setIgnoreDuplicates(true);
      setStep(2);
    } catch {
      setError('Impossible de lire ce fichier CSV.');
    }
  };

  const handleDownloadTemplate = () => {
    const csv = generateTransactionsTemplateCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modele_import_transactions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const rowsToImport = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.rows.filter(
      (r) => r.isValid && (!ignoreDuplicates || !r.isDuplicate)
    );
  }, [parseResult, ignoreDuplicates]);

  const newCategoriesForSelectedRows = useMemo(() => {
    const map = new Map<string, { name: string; type: string }>();
    for (const row of rowsToImport) {
      if (row.willCreateCategory) {
        const key = `${row.type}:${row.categoryName.toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, { name: row.categoryName, type: row.type });
        }
      }
    }
    return Array.from(map.values());
  }, [rowsToImport]);

  const handleConfirmImport = async () => {
    if (rowsToImport.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = rowsToImport.map((r) => ({
        dateIso: r.dateIso!,
        type: r.type,
        categoryName: r.categoryName,
        categoryId: r.categoryId,
        amount: r.amount!,
        note: r.note,
      }));
      const res = isSandbox
        ? await runSandboxImportTransactions(payload)
        : await importTransactionsAction(payload);

      if (!res.ok) {
        throw new Error(res.error || "Erreur lors de l'importation.");
      }

      const catsSuffix =
        res.createdCategoriesCount && res.createdCategoriesCount > 0
          ? ` (+${res.createdCategoriesCount} catégorie${
              res.createdCategoriesCount > 1 ? 's' : ''
            } créée${res.createdCategoriesCount > 1 ? 's' : ''})`
          : '';

      await onImported(
        `${res.importedCount ?? 0} transaction${
          (res.importedCount ?? 0) > 1 ? 's' : ''
        } importée${(res.importedCount ?? 0) > 1 ? 's' : ''}${catsSuffix}`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importer des transactions (CSV)"
      subtitle={
        step === 1
          ? 'Étape 1 / 2 · Sélectionnez un fichier UTF-8 (séparateur « ; » ou « , »)'
          : `Étape 2 / 2 · Prévisualisation de ${fileName}`
      }
      maxWidth="max-w-2xl"
    >
      {/* ================================================================== */}
      {/* STEP 1: FILE SELECTION / DRAG & DROP + BLANK TEMPLATE              */}
      {/* ================================================================== */}
      {step === 1 && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              'rounded-md border border-dashed p-8 text-center cursor-pointer transition-colors space-y-3',
              isDragging
                ? 'border-[#141413] dark:border-[#F2F0E8] bg-[#F7F6F2] dark:bg-[#1E1E1B]'
                : 'border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413] hover:border-[#141413]/45 dark:hover:border-[#F2F0E8]/40'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />

            <div className="h-11 w-11 rounded-md border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FFFFFF] dark:bg-[#181816] mx-auto flex items-center justify-center text-[#141413] dark:text-[#F2F0E8]">
              <Upload className="h-5 w-5" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#141413] dark:text-[#F2F0E8]">
                Glissez-déposez votre fichier .csv ici
              </p>
              <p className="text-xs text-[#5C5B57] dark:text-[#9A9890]">
                ou cliquez pour parcourir vos fichiers · Compatible Excel, Apple Numbers
                et sauvegardes BudgetZen
              </p>
            </div>

            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] pt-1">
              Colonnes attendues : Date ; Type ; Catégorie ; Montant ; Note
            </p>
          </div>

          {/* Blank CSV Template Helper */}
          <div className="rounded-md border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="h-4 w-4 text-[#5C5B57] dark:text-[#9A9890] shrink-0" />
              <p className="text-xs text-[#5C5B57] dark:text-[#9A9890]">
                Besoin d’un gabarit prêt à remplir dans Excel ou Numbers ?
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleDownloadTemplate}
              className="shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger un modèle CSV vierge
            </Button>
          </div>

          {error && (
            <p className="font-mono text-xs font-semibold text-[#B91C1C] dark:text-[#EF4444]">
              {error}
            </p>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* STEP 2: PRE-WRITE PREVIEW TABLE & CONFIRMATION                     */}
      {/* ================================================================== */}
      {step === 2 && parseResult && (
        <div className="space-y-4">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#E2E0D8] dark:border-[#2A2A27] rounded-md divide-y sm:divide-y-0 sm:divide-x divide-[#E2E0D8] dark:divide-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413]">
            <div className="p-3">
              <p className="editorial-kicker">Lignes valides</p>
              <p className="font-mono text-lg font-semibold text-[#15803D] dark:text-[#22C55E] mt-0.5">
                {parseResult.validCount}
              </p>
            </div>
            <div className="p-3">
              <p className="editorial-kicker">Invalides</p>
              <p
                className={cn(
                  'font-mono text-lg font-semibold mt-0.5',
                  parseResult.invalidCount > 0
                    ? 'text-[#B91C1C] dark:text-[#EF4444]'
                    : 'text-[#5C5B57] dark:text-[#9A9890]'
                )}
              >
                {parseResult.invalidCount}
              </p>
            </div>
            <div className="p-3">
              <p className="editorial-kicker">Doublons détectés</p>
              <p
                className={cn(
                  'font-mono text-lg font-semibold mt-0.5',
                  parseResult.duplicateCount > 0
                    ? 'text-[#B45309] dark:text-[#F59E0B]'
                    : 'text-[#5C5B57] dark:text-[#9A9890]'
                )}
              >
                {parseResult.duplicateCount}
              </p>
            </div>
            <div className="p-3">
              <p className="editorial-kicker">Séparateur</p>
              <p className="font-mono text-sm font-semibold text-[#141413] dark:text-[#F2F0E8] mt-1">
                {parseResult.delimiter === ';' ? 'Point-virgule (;)' : 'Virgule (,)'}
              </p>
            </div>
          </div>

          {/* Auto-created Categories Banner */}
          {newCategoriesForSelectedRows.length > 0 && (
            <div className="rounded-md border border-[#141413]/20 dark:border-[#F2F0E8]/20 bg-[#FCFBF9] dark:bg-[#1E1E1B] p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-[#141413] dark:text-[#F2F0E8]">
                <Sparkles className="h-3.5 w-3.5" />
                Catégories créées automatiquement à l’import :
              </div>
              <div className="flex flex-wrap gap-1.5">
                {newCategoriesForSelectedRows.map((c) => (
                  <Badge key={`${c.type}:${c.name}`} tone="blue">
                    + {c.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Ignore Duplicates Checkbox */}
          {parseResult.duplicateCount > 0 && (
            <label className="flex items-center justify-between gap-3 rounded-md border border-[#B45309]/30 dark:border-[#F59E0B]/30 bg-[#B45309]/[0.06] dark:bg-[#F59E0B]/[0.1] px-3.5 py-2.5 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={ignoreDuplicates}
                  onChange={(e) => setIgnoreDuplicates(e.target.checked)}
                  className="h-4 w-4 accent-[#141413] dark:accent-[#F2F0E8]"
                />
                <span className="text-xs font-semibold text-[#141413] dark:text-[#F2F0E8]">
                  Ignorer les doublons détectés ({parseResult.duplicateCount} ligne
                  {parseResult.duplicateCount > 1 ? 's' : ''} correspondant à date +
                  montant + note)
                </span>
              </div>
            </label>
          )}

          {/* Preview Table */}
          <div className="rounded-md border border-[#E2E0D8] dark:border-[#2A2A27] overflow-hidden">
            <div className="max-h-72 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[#FCFBF9] dark:bg-[#141413] border-b border-[#E2E0D8] dark:border-[#2A2A27] font-mono text-[10px] uppercase tracking-[0.08em] text-[#5C5B57] dark:text-[#9A9890]">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-2">Date</th>
                    <th className="py-2 px-2">Catégorie</th>
                    <th className="py-2 px-2 text-right">Montant</th>
                    <th className="py-2 px-2">Note</th>
                    <th className="py-2 px-3 text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E0D8] dark:divide-[#2A2A27]">
                  {parseResult.rows.map((row) => {
                    const skippedDuplicate = row.isValid && row.isDuplicate && ignoreDuplicates;
                    return (
                      <tr
                        key={row.rowNumber}
                        className={cn(
                          !row.isValid &&
                            'bg-[#B91C1C]/[0.08] dark:bg-[#EF4444]/[0.12]',
                          skippedDuplicate && 'opacity-50'
                        )}
                      >
                        <td className="py-2 px-3 font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890]">
                          {row.rowNumber}
                        </td>
                        <td className="py-2 px-2 font-mono whitespace-nowrap">
                          {row.dateIso ? (
                            formatDateShort(row.dateIso)
                          ) : (
                            <span className="text-[#B91C1C] dark:text-[#EF4444] font-semibold">
                              {row.rawDate || '—'}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-[#141413] dark:text-[#F2F0E8]">
                              {row.categoryName}
                            </span>
                            {row.isValid && row.willCreateCategory && (
                              <Badge tone="blue" className="text-[9px] px-1.5 py-0">
                                NOUVELLE
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td
                          className={cn(
                            'py-2 px-2 font-mono text-right font-semibold whitespace-nowrap',
                            !row.amount
                              ? 'text-[#B91C1C] dark:text-[#EF4444]'
                              : row.type === 'INCOME'
                                ? 'text-[#15803D] dark:text-[#22C55E]'
                                : 'text-[#141413] dark:text-[#F2F0E8]'
                          )}
                        >
                          {row.amount !== null
                            ? row.type === 'INCOME'
                              ? formatCurrency(row.amount, currency, { showSign: true })
                              : formatCurrency(-row.amount, currency)
                            : 'Invalide'}
                        </td>
                        <td className="py-2 px-2 text-[#5C5B57] dark:text-[#9A9890] max-w-[160px] truncate">
                          {row.note ?? '—'}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          {!row.isValid ? (
                            <Badge tone="red" className="text-[9px]">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {row.errors[0]}
                            </Badge>
                          ) : row.isDuplicate ? (
                            <Badge tone="orange" className="text-[9px]">
                              {ignoreDuplicates ? 'DOUBLON IGNORÉ' : 'DOUBLON'}
                            </Badge>
                          ) : (
                            <Badge tone="green" className="text-[9px]">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              PRÊT
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {error && (
            <p className="font-mono text-xs font-semibold text-[#B91C1C] dark:text-[#EF4444]">
              {error}
            </p>
          )}

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-[#E2E0D8] dark:border-[#2A2A27]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setStep(1);
                setParseResult(null);
                setError(null);
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Changer de fichier
            </Button>

            <Button
              type="button"
              variant="success"
              loading={submitting}
              disabled={rowsToImport.length === 0}
              onClick={handleConfirmImport}
            >
              <Check className="h-4 w-4" />
              Confirmer l’importation ({rowsToImport.length} transaction
              {rowsToImport.length > 1 ? 's' : ''})
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
