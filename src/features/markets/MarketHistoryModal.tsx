'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  MARKET_ASSET_META,
  type MarketHistoryPoint,
  type MarketHistoryResponse,
  type MarketQuoteDTO,
  type MarketRange,
  type MarketSymbol,
  buildFallbackHistory,
  formatMarketChangePercent,
  formatMarketPrice,
} from '@/core';
import { Badge, Modal, useTheme } from '@/components/ui';
import { cn } from '@/lib/cn';

const RANGE_OPTIONS: Array<{ id: MarketRange; label: string; title: string }> = [
  { id: '1d', label: '1J', title: 'Séance du jour' },
  { id: '5d', label: '1S', title: '5 jours' },
  { id: '1mo', label: '1M', title: '1 mois' },
  { id: '1y', label: '1A', title: '1 an' },
  { id: '5y', label: '5A', title: '5 ans' },
  { id: 'max', label: 'MAX', title: 'Historique maximum' },
];

function formatPointAxisLabel(isoDate: string, range: MarketRange): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  if (range === '1d') {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }
  if (range === '5d' || range === '1mo') {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    }).format(d);
  }
  if (range === '1y') {
    return new Intl.DateTimeFormat('fr-FR', {
      month: 'short',
      year: '2-digit',
    }).format(d);
  }
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
  }).format(d);
}

function formatTooltipDate(isoDate: string, range: MarketRange): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  if (range === '1d' || range === '5d') {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function MarketTooltip({
  active,
  payload,
  symbol,
  range,
}: {
  active?: boolean;
  payload?: Array<{ payload?: MarketHistoryPoint }>;
  symbol: MarketSymbol;
  range: MarketRange;
}) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="bg-[#FFFFFF] dark:bg-[#181816] border border-[#E2E0D8] dark:border-[#2A2A27] rounded-sm px-2.5 py-1.5 font-mono text-[11px] tabular-nums">
      <div className="text-[#5C5B57] dark:text-[#9A9890] text-[10px]">
        {formatTooltipDate(point.date, range)}
      </div>
      <div className="font-semibold text-[#141413] dark:text-[#F2F0E8] mt-0.5">
        {formatMarketPrice(point.close, symbol)}
      </div>
    </div>
  );
}

export function MarketHistoryModal({
  symbol,
  initialQuote,
  onClose,
}: {
  symbol: MarketSymbol | null;
  initialQuote?: MarketQuoteDTO | null;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [range, setRange] = useState<MarketRange>('1y');
  const [history, setHistory] = useState<MarketHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setRange('1y');
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    const controller = new AbortController();
    setLoading(true);

    fetch(
      `/api/markets?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`,
      { signal: controller.signal, cache: 'no-store' }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return (await res.json()) as MarketHistoryResponse;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setHistory(data);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setHistory(buildFallbackHistory(symbol, range));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [symbol, range]);

  const activeSymbol: MarketSymbol = symbol ?? 'EURUSD';
  const meta = MARKET_ASSET_META[activeSymbol];

  const yDomain = useMemo<[number, number]>(() => {
    const pts = history?.points ?? [];
    if (pts.length === 0) return [0, 1];
    let min = history?.low ?? pts[0].close;
    let max = history?.high ?? pts[0].close;
    if (min === max) {
      const margin = min * 0.02 || 0.01;
      return [min - margin, max + margin];
    }
    const pad = (max - min) * 0.12;
    return [min - pad, max + pad];
  }, [history]);

  if (!symbol) return null;

  const displayCurrent = history?.currentPrice ?? initialQuote?.price ?? 0;
  const displayChange =
    history?.changePercent ?? initialQuote?.changePercent ?? 0;
  const isUp = displayChange >= 0;

  return (
    <Modal
      open={Boolean(symbol)}
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={`${meta.label} · Historique de marché`}
      subtitle={`Cotation ${meta.shortLabel} · Sélecteur multi-horizons`}
    >
      <div className="space-y-4">
        {/* Range Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label="Horizon de l'actif"
            className="inline-flex rounded-sm border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413] divide-x divide-[#E2E0D8] dark:divide-[#2A2A27]"
          >
            {RANGE_OPTIONS.map((opt) => {
              const active = range === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={opt.title}
                  onClick={() => setRange(opt.id)}
                  className={cn(
                    'px-2.5 sm:px-3 py-1.5 font-mono text-[11px] font-semibold tabular-nums transition-colors',
                    active
                      ? 'bg-[#141413] text-[#F7F6F2] dark:bg-[#F2F0E8] dark:text-[#111110]'
                      : 'text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8]'
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {loading && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#5C5B57] dark:text-[#9A9890]">
                Chargement…
              </span>
            )}
            <Badge tone={history?.source === 'LIVE' ? 'green' : 'neutral'}>
              {history?.source === 'LIVE' ? 'LIVE' : 'INDICATIF'}
            </Badge>
          </div>
        </div>

        {/* 3-Column KPI Hairline Strip */}
        <div className="grid grid-cols-3 rounded-sm border border-[#E2E0D8] dark:border-[#2A2A27] divide-x divide-[#E2E0D8] dark:divide-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413]">
          <div className="p-3">
            <span className="editorial-kicker block">Cours actuel</span>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-sm sm:text-base font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8]">
                {formatMarketPrice(displayCurrent, symbol)}
              </span>
              <span
                className={cn(
                  'font-mono text-[11px] font-semibold tabular-nums',
                  isUp
                    ? 'text-[#15803D] dark:text-[#22C55E]'
                    : 'text-[#B91C1C] dark:text-[#EF4444]'
                )}
              >
                {formatMarketChangePercent(displayChange)}
              </span>
            </div>
          </div>

          <div className="p-3">
            <span className="editorial-kicker block">Plus haut période</span>
            <span className="font-mono text-sm sm:text-base font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1 block">
              {history ? formatMarketPrice(history.high, symbol) : '—'}
            </span>
          </div>

          <div className="p-3">
            <span className="editorial-kicker block">Plus bas période</span>
            <span className="font-mono text-sm sm:text-base font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] mt-1 block">
              {history ? formatMarketPrice(history.low, symbol) : '—'}
            </span>
          </div>
        </div>

        {/* High-Precision Recharts Line Chart (Zero Gradients) */}
        <div className="h-[260px] w-full rounded-sm border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FFFFFF] dark:bg-[#181816] p-3">
          {history && history.points.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={history.points}
                margin={{ top: 8, right: 8, bottom: 2, left: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="2 3"
                  stroke={isDark ? '#2A2A27' : '#E2E0D8'}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val: string) =>
                    formatPointAxisLabel(val, range)
                  }
                  minTickGap={28}
                  tickLine={false}
                  axisLine={{ stroke: isDark ? '#2A2A27' : '#E2E0D8' }}
                  tick={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fill: isDark ? '#9A9890' : '#5C5B57',
                  }}
                />
                <YAxis
                  domain={yDomain}
                  width={symbol === 'EURUSD' ? 58 : 74}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: number) =>
                    symbol === 'EURUSD'
                      ? val.toFixed(4).replace('.', ',')
                      : `${Math.round(val)} €`
                  }
                  tick={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fill: isDark ? '#9A9890' : '#5C5B57',
                  }}
                />
                <Tooltip
                  content={<MarketTooltip symbol={symbol} range={range} />}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={isDark ? '#F2F0E8' : '#141413'}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{
                    r: 3.5,
                    strokeWidth: 1.5,
                    stroke: '#B45309',
                    fill: isDark ? '#181816' : '#FFFFFF',
                  }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center font-mono text-xs text-[#5C5B57] dark:text-[#9A9890]">
              Chargement des cotations historiques…
            </div>
          )}
        </div>

        {history?.warning && (
          <p className="font-mono text-[10px] text-[#5C5B57] dark:text-[#9A9890]">
            {history.warning}
          </p>
        )}
      </div>
    </Modal>
  );
}
