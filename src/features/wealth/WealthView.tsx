'use client';

import React, { useMemo, useState } from 'react';
import {
  Building2,
  Coins,
  Flame,
  History,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  WealthAssetCategory,
  WealthAssetDTO,
  calculateCashErosion,
  formatCurrency,
  formatDateShort,
  formatPercent,
  projectWealthGrowth,
} from '@/core';
import {
  Badge,
  Button,
  Card,
  RollingNumber,
  SectionHeader,
  useTheme,
} from '@/components/ui';
import { AssetFormModal } from './AssetFormModal';
import { UpdateValueModal } from './UpdateValueModal';

const CATEGORY_META: Record<
  WealthAssetCategory,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  SAVINGS: { label: 'Épargne', color: '#34C759', icon: PiggyBank },
  STOCKS: { label: 'Actions / ETF', color: '#007AFF', icon: TrendingUp },
  REAL_ESTATE: { label: 'Immobilier', color: '#FF9500', icon: Building2 },
  OTHER: { label: 'Autre', color: '#AF52DE', icon: Coins },
};

export function WealthView({
  assets,
  manualInflationRate,
  idleCheckingBalance,
  currency = 'EUR',
  onChanged,
  onOpenSettings,
}: {
  assets: WealthAssetDTO[];
  manualInflationRate: number;
  idleCheckingBalance: number;
  currency?: string;
  onChanged: (message: string) => Promise<void>;
  onOpenSettings: () => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [horizonYears, setHorizonYears] = useState(15);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<WealthAssetDTO | null>(null);
  const [updatingAsset, setUpdatingAsset] = useState<WealthAssetDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const projection = useMemo(
    () => projectWealthGrowth(assets, horizonYears, manualInflationRate),
    [assets, horizonYears, manualInflationRate]
  );

  const cashErosion = useMemo(
    () => calculateCashErosion(idleCheckingBalance, manualInflationRate),
    [idleCheckingBalance, manualInflationRate]
  );

  const handleDelete = async (asset: WealthAssetDTO) => {
    setDeletingId(asset.id);
    try {
      const res = await fetch(`/api/wealth/${asset.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await onChanged(`Support « ${asset.name} » supprimé`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Patrimoine & Projections"
        subtitle="Suivi manuel de vos enveloppes et simulation d'intérêts composés nette d'inflation"
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditingAsset(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Ajouter un support
          </Button>
        }
      />

      {/* 1. TOP KPI STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-1.5 editorial-kicker">
            <Landmark className="h-3 w-3 text-[#141413] dark:text-[#F2F0E8]" />
            Patrimoine placé
          </div>
          <p className="font-serif text-2xl sm:text-3xl font-normal tracking-tight text-[#141413] dark:text-[#F2F0E8] mt-1">
            <RollingNumber value={projection.initialCapital} currency={currency} />
          </p>
          <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5">
            {assets.length} support{assets.length > 1 ? 's' : ''} actif
            {assets.length > 1 ? 's' : ''}
          </p>
        </Card>

        <Card className="p-4">
          <p className="editorial-kicker">Versement programmé</p>
          <p className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-[#15803D] dark:text-[#22C55E] mt-1">
            {formatCurrency(projection.totalMonthlyContribution, currency)}
            <span className="text-xs font-normal text-[#5C5B57] dark:text-[#9A9890]"> /m</span>
          </p>
          <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5 tabular-nums">
            {formatCurrency(projection.totalMonthlyContribution * 12, currency)} / an
          </p>
        </Card>

        <Card className="p-4">
          <p className="editorial-kicker">Rendement moyen</p>
          <p className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1">
            {formatPercent(projection.weightedAnnualYield, 1)}
            <span className="text-xs font-normal text-[#5C5B57] dark:text-[#9A9890]"> /an</span>
          </p>
          <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5">
            Net réel :{' '}
            <strong className="text-[#141413] dark:text-[#F2F0E8] tabular-nums">
              {formatPercent(
                Math.max(0, projection.weightedAnnualYield - manualInflationRate),
                1
              )}
            </strong>
          </p>
        </Card>

        <Card
          interactive
          onClick={onOpenSettings}
          className="p-4 border-l-2 border-l-[#B45309] dark:border-l-[#F59E0B]"
        >
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B45309] dark:text-[#F59E0B]">
            <Flame className="h-3 w-3" />
            Érosion cash
          </div>
          <p className="font-mono text-xl sm:text-2xl font-semibold tabular-nums text-[#B45309] dark:text-[#F59E0B] mt-1">
            −{formatCurrency(cashErosion.annualLoss, currency)}
            <span className="text-xs font-normal opacity-80"> /an</span>
          </p>
          <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] mt-0.5">
            Inflation {formatPercent(manualInflationRate, 1)} · Ajuster →
          </p>
        </Card>
      </div>

      {/* 2. INTERACTIVE COMPOUND INTEREST & INFLATION CHART (1-30 YEARS) */}
      <Card className="p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-[16px] font-semibold text-zinc-900 dark:text-white">
              Projection patrimoniale à {horizonYears} ans
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Capital nominal vs pouvoir d’achat réel (inflation annuelle manuelle :{' '}
              <button
                type="button"
                onClick={onOpenSettings}
                className="font-semibold text-[#007AFF] dark:text-[#409CFF] hover:underline"
              >
                {formatPercent(manualInflationRate, 1)}
              </button>
              )
            </p>
          </div>

          {/* Horizon Slider (1 to 30 years) */}
          <div className="sm:w-64 rounded-2xl bg-zinc-100/90 dark:bg-white/[0.06] px-3.5 py-2.5 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-500 dark:text-zinc-400">
                Horizon de simulation
              </span>
              <span className="font-bold tabular-nums text-[#007AFF] dark:text-[#409CFF]">
                {horizonYears} an{horizonYears > 1 ? 's' : ''}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={horizonYears}
              onChange={(e) => setHorizonYears(Number(e.target.value))}
              aria-label="Horizon de projection en années"
              className="w-full accent-[#007AFF]"
            />
            <div className="flex justify-between text-[10px] text-zinc-400 tabular-nums">
              <span>1 an</span>
              <span>10 ans</span>
              <span>20 ans</span>
              <span>30 ans</span>
            </div>
          </div>
        </div>

        {/* Recharts Chart */}
        {assets.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center gap-2 rounded-2xl bg-zinc-50 dark:bg-white/[0.03]">
            <p className="text-sm font-medium text-zinc-500">
              Ajoutez au moins un support d’épargne ou d’investissement pour lancer la projection.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={projection.timeline}
                margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="2 3"
                  vertical={false}
                  stroke={isDark ? '#2A2A27' : '#E2E0D8'}
                />
                <XAxis
                  dataKey="calendarYear"
                  axisLine={{ stroke: isDark ? '#2A2A27' : '#E2E0D8' }}
                  tickLine={false}
                  tick={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    fill: isDark ? '#9A9890' : '#5C5B57',
                  }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  tick={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    fill: isDark ? '#9A9890' : '#5C5B57',
                  }}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${Math.round(v / 1000)} k€` : `${Math.round(v)}€`
                  }
                />
                <Tooltip
                  labelFormatter={(label) => `Année ${label}`}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      nominalValue: 'Capital nominal',
                      realValue: "Pouvoir d'achat réel",
                      totalContributed: 'Total versé',
                    };
                    return [formatCurrency(value, currency), labels[name] ?? name];
                  }}
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
                  dataKey="nominalValue"
                  stroke={isDark ? '#F2F0E8' : '#141413'}
                  strokeWidth={2}
                  fill={isDark ? '#F2F0E8' : '#141413'}
                  fillOpacity={0.05}
                />
                <Area
                  type="monotone"
                  dataKey="realValue"
                  stroke={isDark ? '#22C55E' : '#15803D'}
                  strokeWidth={2}
                  fill={isDark ? '#22C55E' : '#15803D'}
                  fillOpacity={0.08}
                />
                <Line
                  type="monotone"
                  dataKey="totalContributed"
                  stroke={isDark ? '#9A9890' : '#5C5B57'}
                  strokeWidth={1.25}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Chart Legend */}
        <div className="flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase tracking-[0.08em] text-[#5C5B57] dark:text-[#9A9890]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[1px] bg-[#141413] dark:bg-[#F2F0E8]" />
            Capital nominal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[1px] bg-[#15803D] dark:bg-[#22C55E]" />
            Pouvoir d’achat réel (net)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t border-dashed border-[#5C5B57] dark:border-[#9A9890]" />
            Cumul versé
          </span>
        </div>

        {/* Projection Numerical Summary Strip — Crisp Hairline Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 border border-[#E2E0D8] dark:border-[#2A2A27] rounded-md divide-y lg:divide-y-0 lg:divide-x divide-[#E2E0D8] dark:divide-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413]">
          <div className="p-3.5">
            <p className="editorial-kicker">Total versé</p>
            <p className="font-mono text-base font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1">
              {formatCurrency(projection.totalContributed, currency)}
            </p>
          </div>

          <div className="p-3.5">
            <p className="editorial-kicker">Intérêts composés</p>
            <p className="font-mono text-base font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1">
              +{formatCurrency(projection.totalInterestGenerated, currency)}
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890] tabular-nums">
              Nominal : {formatCurrency(projection.finalNominalValue, currency)}
            </p>
          </div>

          <div className="p-3.5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B45309] dark:text-[#F59E0B]">
              Perte inflation
            </p>
            <p className="font-mono text-base font-semibold tabular-nums text-[#B45309] dark:text-[#F59E0B] mt-1">
              −{formatCurrency(projection.totalInflationLoss, currency)}
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890]">
              Sur {horizonYears} ans
            </p>
          </div>

          <div className="p-3.5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#15803D] dark:text-[#22C55E]">
              Pouvoir d’achat réel
            </p>
            <p className="font-mono text-base font-bold tabular-nums text-[#15803D] dark:text-[#22C55E] mt-1">
              <RollingNumber value={projection.finalRealValue} currency={currency} />
            </p>
            <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890]">
              Euros constants
            </p>
          </div>
        </div>
      </Card>

      {/* 3. INVESTMENT ENVELOPES LIST WITH QUICK "ACTUALISER LA VALEUR" */}
      <section className="space-y-3">
        <SectionHeader
          title={`Vos supports d'épargne et d'investissement (${assets.length})`}
          subtitle="Cliquez sur « Actualiser » chaque mois pour historiser la progression réelle"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {assets.map((asset) => {
            const meta = CATEGORY_META[asset.category] ?? CATEGORY_META.OTHER;
            const Icon = meta.icon;
            const snaps = asset.snapshots ?? [];
            const firstSnap = snaps.length > 1 ? snaps[0] : null;
            const evolution = firstSnap ? asset.currentValue - firstSnap.value : null;

            return (
              <Card key={asset.id} className="p-4 space-y-3.5">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${meta.color}1A`,
                        color: meta.color,
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                        {asset.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge tone="neutral" className="text-[10px] px-2 py-0">
                          {meta.label}
                        </Badge>
                        <Badge tone="blue" className="text-[10px] px-2 py-0">
                          {formatPercent(asset.expectedAnnualYield, 1)} / an
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAsset(asset);
                        setFormOpen(true);
                      }}
                      aria-label="Modifier"
                      className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === asset.id}
                      onClick={() => handleDelete(asset)}
                      aria-label="Supprimer"
                      className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
                      {formatCurrency(asset.currentValue, currency)}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums mt-0.5">
                      +{formatCurrency(asset.monthlyContribution, currency)} / mois
                      {evolution !== null && (
                        <span
                          className={
                            evolution >= 0
                              ? ' ml-2 text-[#34C759] dark:text-[#30D158] font-semibold'
                              : ' ml-2 text-[#FF3B30] dark:text-[#FF453A] font-semibold'
                          }
                        >
                          ({formatCurrency(evolution, currency, { showSign: true })} suivis)
                        </span>
                      )}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setUpdatingAsset(asset)}
                    className="shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Actualiser la valeur
                  </Button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-black/[0.05] dark:border-white/[0.07]">
                  <span className="inline-flex items-center gap-1">
                    <History className="h-3 w-3" />
                    {snaps.length} relevé{snaps.length > 1 ? 's' : ''} historisé
                    {snaps.length > 1 ? 's' : ''}
                  </span>
                  <span>Mis à jour le {formatDateShort(asset.lastUpdated)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <AssetFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editingAsset={editingAsset}
        onSaved={onChanged}
      />

      <UpdateValueModal
        asset={updatingAsset}
        currency={currency}
        onClose={() => setUpdatingAsset(null)}
        onSaved={onChanged}
      />
    </div>
  );
}
