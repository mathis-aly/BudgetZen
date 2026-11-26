'use client';

import React, { useState } from 'react';
import {
  Activity,
  Camera,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CategoryDTO,
  CustomIndexDTO,
  TrackedProductDTO,
  TransactionDTO,
  WealthAssetDTO,
  computeCompositeIndexValue,
  computeIndexVariations,
  formatDateShort,
  formatPercent,
  resolveLiveCompositeValues,
} from '@/core';
import {
  Badge,
  Button,
  Card,
  RollingNumber,
  SectionHeader,
  useTheme,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { NewIndexModal } from './NewIndexModal';
import { AddIndexPointModal } from './AddIndexPointModal';

export function CustomIndicesView({
  indices,
  trackedProducts,
  categories,
  transactions,
  wealthAssets,
  selectedMonthKey,
  onChanged,
}: {
  indices: CustomIndexDTO[];
  trackedProducts: TrackedProductDTO[];
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  wealthAssets: WealthAssetDTO[];
  selectedMonthKey: string;
  onChanged: (message: string) => Promise<void>;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [pointModalTarget, setPointModalTarget] = useState<{
    index: CustomIndexDTO;
    suggestedValue: number;
  } | null>(null);
  const [snapshottingId, setSnapshottingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSnapshotComposite = async (
    index: CustomIndexDTO,
    liveValue: number
  ) => {
    setSnapshottingId(index.id);
    try {
      const res = await fetch(`/api/custom-indices/${index.id}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: liveValue,
          recordedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error();
      await onChanged(
        `Point ${liveValue.toFixed(1).replace('.', ',')} pts figé sur « ${index.name} »`
      );
    } finally {
      setSnapshottingId(null);
    }
  };

  const handleDeleteIndex = async (index: CustomIndexDTO) => {
    setDeletingId(index.id);
    try {
      const res = await fetch(`/api/custom-indices/${index.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      await onChanged(`Indice « ${index.name} » supprimé`);
    } finally {
      setDeletingId(null);
    }
  };

  const formatHorizonPill = (val: number | null) => {
    if (val === null) return '—';
    return `${val > 0 ? '+' : ''}${formatPercent(val, 1)}`;
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Indices Personnalisés"
        subtitle="Créez vos propres baromètres base 100 (composites pondérés ou saisie libre)"
        action={
          <Button size="sm" onClick={() => setNewModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouvel Indice
          </Button>
        }
      />

      {indices.length === 0 ? (
        <Card className="p-10 text-center space-y-2.5">
          <Activity className="h-8 w-8 text-zinc-400 mx-auto" />
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            Aucun indice personnalisé créé
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            Assemblez un indice composite à partir de vos produits suivis, catégories de
            dépenses ou supports patrimoniaux, ou suivez un indicateur libre.
          </p>
          <div className="pt-2">
            <Button size="sm" onClick={() => setNewModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Créer mon premier indice
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {indices.map((idx) => {
            const liveComposite =
              idx.type === 'COMPOSITE' && idx.components.length > 0
                ? computeCompositeIndexValue(
                    idx.components,
                    resolveLiveCompositeValues({
                      index: idx,
                      trackedProducts,
                      categories,
                      transactions,
                      wealthAssets,
                      monthKey: selectedMonthKey,
                    }),
                    idx.baseValue
                  )
                : null;

            const currentVal = liveComposite
              ? liveComposite.value
              : idx.dataPoints.length > 0
                ? idx.dataPoints[idx.dataPoints.length - 1].value
                : idx.baseValue;

            const variations = computeIndexVariations(
              idx.dataPoints,
              currentVal,
              idx.baseValue
            );

            const isUp = variations.sinceCreationPercent > 0;
            const isDown = variations.sinceCreationPercent < 0;
            const strokeColor = isUp
              ? isDark
                ? '#F59E0B'
                : '#B45309'
              : isDown
                ? isDark
                  ? '#22C55E'
                  : '#15803D'
                : isDark
                  ? '#F2F0E8'
                  : '#141413';

            const chartData = variations.sortedDataPoints.map((pt) => ({
              dateLabel: formatDateShort(pt.recordedAt),
              value: pt.value,
            }));

            return (
              <Card key={idx.id} className="p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[16px] font-semibold text-zinc-900 dark:text-white truncate">
                          {idx.name}
                        </h3>
                        <Badge tone={idx.type === 'COMPOSITE' ? 'blue' : 'neutral'}>
                          {idx.type === 'COMPOSITE' ? (
                            <>
                              <Layers className="h-3 w-3" />
                              Composite
                            </>
                          ) : (
                            'Libre'
                          )}
                        </Badge>
                      </div>
                      {idx.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                          {idx.description}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={deletingId === idx.id}
                      onClick={() => handleDeleteIndex(idx)}
                      aria-label="Supprimer l'indice"
                      className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 shrink-0 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Hero Score + Overall Variation Badge */}
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-4xl font-normal tracking-tight text-[#141413] dark:text-[#F2F0E8]">
                        <RollingNumber
                          value={currentVal}
                          formatter={(v) => v.toFixed(1).replace('.', ',')}
                        />
                      </span>
                      <span className="font-mono text-xs font-semibold uppercase text-[#5C5B57] dark:text-[#9A9890]">
                        pts
                      </span>
                    </div>

                    <Badge
                      tone={isUp ? 'orange' : isDown ? 'green' : 'neutral'}
                      className="text-xs px-2.5 py-1 tabular-nums"
                    >
                      {isUp ? '+' : ''}
                      {formatPercent(variations.sinceCreationPercent, 1)} · base{' '}
                      {idx.baseValue}
                    </Badge>
                  </div>

                  {/* Multi-horizon Variations Strip (1M, 6M, 1A, Création) */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '1 mois', val: variations.oneMonthPercent },
                      { label: '6 mois', val: variations.sixMonthsPercent },
                      { label: '1 an', val: variations.oneYearPercent },
                      { label: 'Création', val: variations.sinceCreationPercent },
                    ].map((h) => (
                      <div
                        key={h.label}
                        className="rounded-xl bg-zinc-50 dark:bg-white/[0.04] px-2 py-2 text-center"
                      >
                        <p className="text-[10px] text-zinc-400">{h.label}</p>
                        <p
                          className={cn(
                            'text-xs font-bold tabular-nums mt-0.5',
                            h.val === null
                              ? 'text-zinc-400'
                              : h.val > 0
                                ? 'text-[#FF9500] dark:text-[#FF9F0A]'
                                : h.val < 0
                                  ? 'text-[#34C759] dark:text-[#30D158]'
                                  : 'text-zinc-700 dark:text-zinc-200'
                          )}
                        >
                          {formatHorizonPill(h.val)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Recharts Historical Curve */}
                  <div className="h-44 w-full">
                    {chartData.length >= 2 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={chartData}
                          margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="2 3"
                            vertical={false}
                            stroke={isDark ? '#2A2A27' : '#E2E0D8'}
                          />
                          <XAxis
                            dataKey="dateLabel"
                            axisLine={{ stroke: isDark ? '#2A2A27' : '#E2E0D8' }}
                            tickLine={false}
                            tick={{
                              fontSize: 10,
                              fontFamily: 'var(--font-mono)',
                              fill: isDark ? '#9A9890' : '#5C5B57',
                            }}
                          />
                          <YAxis
                            domain={['auto', 'auto']}
                            axisLine={false}
                            tickLine={false}
                            tick={{
                              fontSize: 10,
                              fontFamily: 'var(--font-mono)',
                              fill: isDark ? '#9A9890' : '#5C5B57',
                            }}
                          />
                          <ReferenceLine
                            y={idx.baseValue}
                            stroke={isDark ? '#2A2A27' : '#E2E0D8'}
                            strokeDasharray="3 3"
                          />
                          <Tooltip
                            formatter={(v: number) => [
                              `${v.toFixed(1).replace('.', ',')} pts`,
                              idx.name,
                            ]}
                            contentStyle={{
                              borderRadius: '4px',
                              border: isDark ? '1px solid #2A2A27' : '1px solid #E2E0D8',
                              backgroundColor: isDark ? '#181816' : '#FFFFFF',
                              color: isDark ? '#F2F0E8' : '#141413',
                              boxShadow: 'none',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke={strokeColor}
                            strokeWidth={2}
                            fill={strokeColor}
                            fillOpacity={0.07}
                            dot={{ r: 2.5, fill: strokeColor, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full rounded-2xl bg-zinc-50 dark:bg-white/[0.03] flex items-center justify-center text-xs text-zinc-400">
                        Enregistrez un 2e point pour tracer la courbe d’évolution.
                      </div>
                    )}
                  </div>

                  {/* Composite Components Breakdown */}
                  {liveComposite && liveComposite.componentBreakdown.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-black/[0.05] dark:border-white/[0.07]">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                        Composition pondérée (100 %)
                      </p>
                      {liveComposite.componentBreakdown.map((c) => (
                        <div
                          key={c.componentId}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-zinc-700 dark:text-zinc-300 truncate">
                            {c.label}{' '}
                            <span className="text-zinc-400 tabular-nums">
                              ({c.weightPercent}%)
                            </span>
                          </span>
                          <span
                            className={cn(
                              'font-semibold tabular-nums shrink-0',
                              c.componentVariationPercent > 0
                                ? 'text-[#FF9500] dark:text-[#FF9F0A]'
                                : c.componentVariationPercent < 0
                                  ? 'text-[#34C759] dark:text-[#30D158]'
                                  : 'text-zinc-500'
                            )}
                          >
                            {c.componentVariationPercent > 0 ? '+' : ''}
                            {formatPercent(c.componentVariationPercent, 1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer CTA */}
                <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between gap-2">
                  <span className="text-[11px] text-zinc-400">
                    {idx.dataPoints.length} point{idx.dataPoints.length > 1 ? 's' : ''}{' '}
                    historisé{idx.dataPoints.length > 1 ? 's' : ''}
                  </span>

                  {idx.type === 'COMPOSITE' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={snapshottingId === idx.id}
                      onClick={() => handleSnapshotComposite(idx, currentVal)}
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Enregistrer le relevé ({currentVal.toFixed(1).replace('.', ',')} pts)
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setPointModalTarget({
                          index: idx,
                          suggestedValue: currentVal,
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Saisir une valeur
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <NewIndexModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        trackedProducts={trackedProducts}
        categories={categories}
        transactions={transactions}
        wealthAssets={wealthAssets}
        onSaved={onChanged}
      />

      <AddIndexPointModal
        index={pointModalTarget?.index ?? null}
        suggestedValue={pointModalTarget?.suggestedValue ?? 100}
        onClose={() => setPointModalTarget(null)}
        onSaved={onChanged}
      />
    </div>
  );
}
