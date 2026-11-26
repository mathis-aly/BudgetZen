'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LineChart as LineChartIcon, RefreshCw } from 'lucide-react';
import {
  MARKET_ASSET_META,
  type MarketSymbol,
  type MarketsSnapshotResponse,
  buildFallbackSnapshot,
  formatMarketChangePercent,
  formatMarketPrice,
} from '@/core';
import { cn } from '@/lib/cn';
import { MarketHistoryModal } from './MarketHistoryModal';

const MARKET_ORDER: MarketSymbol[] = ['EURUSD', 'GOLD', 'SILVER'];
const REFRESH_INTERVAL_MS = 60_000;

export function MarketTickerBar() {
  const [snapshot, setSnapshot] = useState<MarketsSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<MarketSymbol | null>(
    null
  );

  const loadSnapshot = useCallback(async (forceRefresh: boolean = false) => {
    if (forceRefresh) setRefreshing(true);
    try {
      const url = forceRefresh ? '/api/markets?refresh=1' : '/api/markets';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as MarketsSnapshotResponse;
      setSnapshot(data);
    } catch {
      setSnapshot((prev) => prev ?? buildFallbackSnapshot());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot(false);

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadSnapshot(false);
      }
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [loadSnapshot]);

  const activeData = snapshot ?? buildFallbackSnapshot();
  const timeLabel = (() => {
    const d = new Date(activeData.updatedAt);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  })();

  return (
    <>
      <section
        aria-label="Ruban marchés et devises"
        className="border-y border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FCFBF9] dark:bg-[#141413]"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E2E0D8] dark:divide-[#2A2A27]">
          {MARKET_ORDER.map((sym, idx) => {
            const quote = activeData.quotes[sym];
            const meta = MARKET_ASSET_META[sym];
            const isUp = quote.changePercent >= 0;

            return (
              <div
                key={sym}
                className="px-3.5 py-2.5 flex items-center justify-between gap-2.5 min-w-0"
              >
                <div className="min-w-0 flex items-baseline gap-2.5 flex-wrap">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5C5B57] dark:text-[#9A9890] whitespace-nowrap">
                    {meta.label}
                  </span>

                  <span
                    className={cn(
                      'font-mono text-sm font-semibold tabular-nums text-[#141413] dark:text-[#F2F0E8] whitespace-nowrap',
                      loading && !snapshot && 'opacity-50'
                    )}
                  >
                    {formatMarketPrice(quote.price, sym)}
                  </span>

                  <span
                    className={cn(
                      'font-mono text-[11px] font-semibold tabular-nums whitespace-nowrap px-1.5 py-0.5 border rounded-[2px]',
                      isUp
                        ? 'text-[#15803D] border-[#15803D]/25 bg-[#15803D]/[0.06] dark:text-[#22C55E] dark:border-[#22C55E]/30 dark:bg-[#22C55E]/[0.1]'
                        : 'text-[#B91C1C] border-[#B91C1C]/25 bg-[#B91C1C]/[0.06] dark:text-[#EF4444] dark:border-[#EF4444]/30 dark:bg-[#EF4444]/[0.1]'
                    )}
                  >
                    {formatMarketChangePercent(quote.changePercent)}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {idx === MARKET_ORDER.length - 1 && timeLabel && (
                    <span
                      title={
                        activeData.source === 'LIVE'
                          ? 'Cotations temps réel (Yahoo Finance)'
                          : activeData.warning || 'Cotations indicatives'
                      }
                      className="hidden xl:inline-block font-mono text-[9px] uppercase tracking-wider text-[#5C5B57] dark:text-[#9A9890] mr-1 tabular-nums"
                    >
                      {activeData.source === 'LIVE' ? 'LIVE' : 'IND.'} ·{' '}
                      {timeLabel}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => void loadSnapshot(true)}
                    disabled={refreshing}
                    title="Actualiser les cours"
                    aria-label={`Actualiser ${meta.label}`}
                    className="h-7 w-7 rounded-[2px] border border-transparent hover:border-[#E2E0D8] dark:hover:border-[#2A2A27] flex items-center justify-center text-[#5C5B57] dark:text-[#9A9890] hover:text-[#141413] dark:hover:text-[#F2F0E8] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw
                      className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSymbol(sym)}
                    title={`Voir l'historique ${meta.label}`}
                    aria-label={`Ouvrir le graphique historique ${meta.label}`}
                    className="h-7 w-7 rounded-[2px] border border-[#E2E0D8] dark:border-[#2A2A27] bg-[#FFFFFF] dark:bg-[#181816] hover:border-[#141413] dark:hover:border-[#F2F0E8] flex items-center justify-center text-[#141413] dark:text-[#F2F0E8] transition-colors"
                  >
                    <LineChartIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <MarketHistoryModal
        symbol={selectedSymbol}
        initialQuote={
          selectedSymbol ? activeData.quotes[selectedSymbol] : null
        }
        onClose={() => setSelectedSymbol(null)}
      />
    </>
  );
}
