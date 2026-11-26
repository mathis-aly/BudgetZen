'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  ShoppingBasket,
  Store,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  TrackedProductDTO,
  calculateBasketInflationIndex,
  formatCurrency,
  formatDateShort,
  formatPercent,
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
import { PriceEntryModal } from './PriceEntryModal';
import { ProductFormModal } from './ProductFormModal';

export function PriceTrackerView({
  products,
  manualInflationRate,
  currency = 'EUR',
  onChanged,
}: {
  products: TrackedProductDTO[];
  manualInflationRate: number;
  currency?: string;
  onChanged: (message: string) => Promise<void>;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    () => products[0]?.id ?? null
  );
  const [entryModalProduct, setEntryModalProduct] =
    useState<TrackedProductDTO | null>(null);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<TrackedProductDTO | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const basket = useMemo(
    () => calculateBasketInflationIndex(products),
    [products]
  );

  // Collect distinct stores previously typed by the user for fast chips
  const recentStores = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      for (const e of p.entries) {
        if (e.store) set.add(e.store);
      }
    }
    return Array.from(set);
  }, [products]);

  const entryModalLatestPrice = useMemo(() => {
    if (!entryModalProduct) return 0;
    const found = basket.items.find((i) => i.product.id === entryModalProduct.id);
    return found?.stats.latestPrice ?? 0;
  }, [entryModalProduct, basket.items]);

  const handleDeleteProduct = async (product: TrackedProductDTO) => {
    setDeletingId(product.id);
    try {
      const res = await fetch(`/api/price-tracker/${product.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      if (expandedProductId === product.id) setExpandedProductId(null);
      await onChanged(`Produit « ${product.name} » supprimé`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    setDeletingId(entryId);
    try {
      const res = await fetch(`/api/price-tracker/entries/${entryId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      await onChanged('Relevé de prix supprimé');
    } finally {
      setDeletingId(null);
    }
  };

  const basketRising = basket.averageInflationPercent > 0;
  const basketFalling = basket.averageInflationPercent < 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Suivi des Prix & Panier Témoin"
        subtitle="Mesurez l'inflation réelle de vos produits du quotidien au fil de vos relevés"
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditingProduct(null);
              setProductFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Ajouter un produit
          </Button>
        }
      />

      {/* 1. HERO GLOBAL BASKET INFLATION INDEX CARD */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="editorial-kicker">
              Indice d’inflation du panier témoin
            </p>

            <div className="flex items-baseline gap-3 mt-2">
              <p
                className={cn(
                  'font-serif text-4xl sm:text-5xl font-normal tracking-tight tabular-nums',
                  basketRising
                    ? 'text-[#B91C1C] dark:text-[#EF4444]'
                    : basketFalling
                      ? 'text-[#15803D] dark:text-[#22C55E]'
                      : 'text-[#141413] dark:text-[#F2F0E8]'
                )}
              >
                {basket.comparableCount > 0 ? (
                  <RollingNumber
                    value={basket.averageInflationPercent}
                    formatter={(v) =>
                      `${v > 0 ? '+' : ''}${formatPercent(v, 1)}`
                    }
                  />
                ) : (
                  '—'
                )}
              </p>
              {basket.comparableCount > 0 && (
                <span className="font-mono text-[11px] text-[#5C5B57] dark:text-[#9A9890]">
                  vs hypothèse manuelle {formatPercent(manualInflationRate, 1)}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Moyenne des variations constatées sur {basket.comparableCount} produit
              {basket.comparableCount > 1 ? 's' : ''} comparé
              {basket.comparableCount > 1 ? 's' : ''} (sur 12 mois max)
            </p>
          </div>

          {/* Summary KPI Pills */}
          <div className="grid grid-cols-3 gap-2 sm:w-72 shrink-0">
            <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] p-3 text-center">
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                En hausse
              </p>
              <p className="text-lg font-bold tabular-nums text-[#FF3B30] dark:text-[#FF453A] mt-0.5">
                {basket.productsRisingCount}
              </p>
            </div>
            <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] p-3 text-center">
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                En baisse
              </p>
              <p className="text-lg font-bold tabular-nums text-[#34C759] dark:text-[#30D158] mt-0.5">
                {basket.productsFallingCount}
              </p>
            </div>
            <div className="rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] p-3 text-center">
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                Alertes
              </p>
              <p className="text-lg font-bold tabular-nums text-[#FF9500] dark:text-[#FF9F0A] mt-0.5">
                {basket.alertTriggeredCount}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. TRACKED PRODUCTS LIST WITH CLICK-TO-EXPAND RECHARTS CURVE */}
      <section className="space-y-3">
        <SectionHeader
          title={`Produits suivis (${basket.trackedCount})`}
          subtitle="Touchez un produit pour afficher son graphique d'évolution tarifaire"
        />

        {basket.items.length === 0 ? (
          <Card className="p-10 text-center space-y-2">
            <ShoppingBasket className="h-8 w-8 text-zinc-400 mx-auto" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              Votre panier témoin est vide
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Ajoutez vos produits courants (huile, café, carburant, œufs…) pour mesurer
              leur évolution réelle.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {basket.items.map(({ product, stats, isAlertTriggered }) => {
              const isExpanded = expandedProductId === product.id;
              const isRising = stats.deltaPercent > 0;
              const isFalling = stats.deltaPercent < 0;
              const strokeColor = isRising
                ? isDark
                  ? '#EF4444'
                  : '#B91C1C'
                : isFalling
                  ? isDark
                    ? '#22C55E'
                    : '#15803D'
                  : isDark
                    ? '#F2F0E8'
                    : '#141413';

              const chartData = stats.sortedEntries.map((entry) => ({
                id: entry.id,
                dateLabel: formatDateShort(entry.recordedAt),
                price: entry.price,
                store: entry.store,
              }));

              return (
                <Card
                  key={product.id}
                  padded={false}
                  className={cn(
                    'overflow-hidden transition-all',
                    isAlertTriggered &&
                      'border-[#FF3B30]/25 dark:border-[#FF453A]/30'
                  )}
                >
                  {/* Main clickable row */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedProductId((curr) =>
                        curr === product.id ? null : product.id
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedProductId((curr) =>
                          curr === product.id ? null : product.id
                        );
                      }
                    }}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/70 dark:hover:bg-white/[0.025] cursor-pointer transition-colors"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'h-10 w-10 rounded-2xl flex items-center justify-center shrink-0',
                          isRising
                            ? 'bg-[#FF3B30]/12 text-[#FF3B30] dark:bg-[#FF453A]/18 dark:text-[#FF453A]'
                            : isFalling
                              ? 'bg-[#34C759]/12 text-[#1E8E3E] dark:bg-[#30D158]/18 dark:text-[#30D158]'
                              : 'bg-[#007AFF]/12 text-[#007AFF] dark:bg-[#0A84FF]/18 dark:text-[#409CFF]'
                        )}
                      >
                        {isRising ? (
                          <TrendingUp className="h-5 w-5" />
                        ) : isFalling ? (
                          <TrendingDown className="h-5 w-5" />
                        ) : (
                          <ShoppingBasket className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                            {product.name}
                          </p>
                          <span className="text-[11px] font-medium text-zinc-400">
                            · {product.unit}
                          </span>
                          {isAlertTriggered && (
                            <Badge tone="red" className="text-[10px] px-2 py-0">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              Seuil +{formatPercent(product.targetAlertPercent, 0)}
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                          {stats.entryCount > 0 ? (
                            <>
                              Moy. {formatCurrency(stats.averagePrice, currency)}
                              {stats.latestStore ? ` · ${stats.latestStore}` : ''}
                              {stats.latestDate
                                ? ` · ${formatDateShort(stats.latestDate)}`
                                : ''}
                            </>
                          ) : (
                            'Aucun relevé enregistré'
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right Side: Latest Price + Variation Badge + Quick CTA */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="text-left sm:text-right">
                          <p className="text-base font-bold tabular-nums text-zinc-900 dark:text-white">
                            {stats.entryCount > 0
                              ? formatCurrency(stats.latestPrice, currency)
                              : '—'}
                          </p>
                          {stats.hasComparison && (
                            <p
                              className={cn(
                                'text-[11px] font-semibold tabular-nums',
                                isRising
                                  ? 'text-[#FF3B30] dark:text-[#FF453A]'
                                  : isFalling
                                    ? 'text-[#34C759] dark:text-[#30D158]'
                                    : 'text-zinc-400'
                              )}
                            >
                              {formatCurrency(stats.deltaAmount, currency, {
                                showSign: true,
                              })}
                            </p>
                          )}
                        </div>

                        {stats.hasComparison ? (
                          <Badge
                            tone={isRising ? 'red' : isFalling ? 'green' : 'neutral'}
                            className="tabular-nums text-xs px-2.5 py-1"
                          >
                            {isRising ? '+' : ''}
                            {formatPercent(stats.deltaPercent, 1)}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">1 relevé</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEntryModalProduct(product);
                          }}
                          className="h-8 px-2.5 text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Relever un prix
                        </Button>

                        <span className="h-7 w-7 rounded-full flex items-center justify-center text-zinc-400">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail Panel: Recharts Evolution Curve + History */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-3 border-t border-black/[0.05] dark:border-white/[0.08] bg-zinc-50/50 dark:bg-white/[0.015] space-y-4 animate-fade-in">
                      {/* Stats Strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="rounded-xl bg-white dark:bg-[#2C2C2E]/70 border border-black/[0.04] dark:border-white/[0.06] p-2.5">
                          <p className="text-[10px] text-zinc-400">
                            Prix de référence
                          </p>
                          <p className="text-xs font-bold tabular-nums text-zinc-900 dark:text-white mt-0.5">
                            {stats.entryCount > 0
                              ? formatCurrency(stats.baselinePrice, currency)
                              : '—'}
                          </p>
                          {stats.baselineDate && (
                            <p className="text-[10px] text-zinc-400">
                              {formatDateShort(stats.baselineDate)}
                            </p>
                          )}
                        </div>
                        <div className="rounded-xl bg-white dark:bg-[#2C2C2E]/70 border border-black/[0.04] dark:border-white/[0.06] p-2.5">
                          <p className="text-[10px] text-zinc-400">Prix moyen</p>
                          <p className="text-xs font-bold tabular-nums text-zinc-900 dark:text-white mt-0.5">
                            {stats.entryCount > 0
                              ? formatCurrency(stats.averagePrice, currency)
                              : '—'}
                          </p>
                          <p className="text-[10px] text-zinc-400">
                            {stats.entryCount} relevé{stats.entryCount > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white dark:bg-[#2C2C2E]/70 border border-black/[0.04] dark:border-white/[0.06] p-2.5">
                          <p className="text-[10px] text-zinc-400">Min / Max</p>
                          <p className="text-xs font-bold tabular-nums text-zinc-900 dark:text-white mt-0.5">
                            {stats.entryCount > 0
                              ? `${formatCurrency(stats.minPrice, currency)} – ${formatCurrency(
                                  stats.maxPrice,
                                  currency
                                )}`
                              : '—'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white dark:bg-[#2C2C2E]/70 border border-black/[0.04] dark:border-white/[0.06] p-2.5">
                          <p className="text-[10px] text-zinc-400">Seuil d’alerte</p>
                          <p className="text-xs font-bold tabular-nums text-zinc-900 dark:text-white mt-0.5">
                            +{formatPercent(product.targetAlertPercent, 1)}
                          </p>
                        </div>
                      </div>

                      {/* Mini Recharts Price Evolution Curve */}
                      {chartData.length >= 2 ? (
                        <div className="h-44 w-full rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.04] dark:border-white/[0.07] p-3">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={chartData}
                              margin={{ top: 8, right: 10, left: -12, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient
                                  id={`grad-${product.id}`}
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor={strokeColor}
                                    stopOpacity={0.22}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor={strokeColor}
                                    stopOpacity={0.01}
                                  />
                                </linearGradient>
                              </defs>
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
                                tickFormatter={(v: number) => `${v.toFixed(2)}€`}
                              />
                              <Tooltip
                                formatter={(value: number) => [
                                  formatCurrency(value, currency),
                                  'Prix relevé',
                                ]}
                                labelFormatter={(label, payload) => {
                                  const store = payload?.[0]?.payload?.store;
                                  return store ? `${label} · ${store}` : String(label);
                                }}
                                contentStyle={{
                                  borderRadius: '4px',
                                  border: isDark
                                    ? '1px solid #2A2A27'
                                    : '1px solid #E2E0D8',
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
                                dataKey="price"
                                stroke={strokeColor}
                                strokeWidth={2.4}
                                fill={`url(#grad-${product.id})`}
                                dot={{ r: 3.5, fill: strokeColor, strokeWidth: 0 }}
                                activeDot={{ r: 5 }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.04] dark:border-white/[0.07] p-5 text-center text-xs text-zinc-500">
                          Ajoutez au moins 2 relevés de prix pour visualiser la courbe
                          d’évolution.
                        </div>
                      )}

                      {/* Recorded Entries History + Product Actions */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                            Historique des relevés
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingProduct(product);
                                setProductFormOpen(true);
                              }}
                              className="h-7 px-2 text-[11px]"
                            >
                              <Pencil className="h-3 w-3" />
                              Modifier produit
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              loading={deletingId === product.id}
                              onClick={() => handleDeleteProduct(product)}
                              className="h-7 px-2 text-[11px]"
                            >
                              <Trash2 className="h-3 w-3" />
                              Supprimer
                            </Button>
                          </div>
                        </div>

                        {stats.sortedEntries.length > 0 && (
                          <div className="rounded-xl bg-white dark:bg-[#1C1C1E] border border-black/[0.04] dark:border-white/[0.07] divide-y divide-black/[0.05] dark:divide-white/[0.07]">
                            {[...stats.sortedEntries].reverse().map((entry) => (
                              <div
                                key={entry.id}
                                className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-medium text-zinc-700 dark:text-zinc-200 tabular-nums">
                                    {formatDateShort(entry.recordedAt)}
                                  </span>
                                  {entry.store && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 truncate">
                                      <Store className="h-3 w-3 shrink-0" />
                                      {entry.store}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-bold tabular-nums text-zinc-900 dark:text-white">
                                    {formatCurrency(entry.price, currency)}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={deletingId === entry.id}
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    aria-label="Supprimer ce relevé"
                                    className="h-6 w-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 disabled:opacity-40"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <PriceEntryModal
        product={entryModalProduct}
        latestPrice={entryModalLatestPrice}
        recentStores={recentStores}
        currency={currency}
        onClose={() => setEntryModalProduct(null)}
        onSaved={onChanged}
      />

      <ProductFormModal
        open={productFormOpen}
        onClose={() => setProductFormOpen(false)}
        editingProduct={editingProduct}
        onSaved={onChanged}
      />
    </div>
  );
}
