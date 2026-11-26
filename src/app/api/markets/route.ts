import { NextRequest, NextResponse } from 'next/server';
import {
  MARKET_ASSET_META,
  type MarketHistoryPoint,
  type MarketHistoryResponse,
  type MarketQuoteDTO,
  type MarketRange,
  type MarketSymbol,
  type MarketsSnapshotResponse,
  buildFallbackHistory,
  buildFallbackSnapshot,
  computeMarketHistoryStats,
  convertMetalUsdQuoteToEur,
  convertUsdSeriesToEur,
  getYahooChartParams,
  parseMarketRange,
  parseMarketSymbol,
  roundToDecimals,
} from '@/core';

const CACHE_TTL_MS = 60_000;

interface ParsedYahooChart {
  price: number;
  previousClose: number;
  points: MarketHistoryPoint[];
}

let snapshotCache: { data: MarketsSnapshotResponse; cachedAt: number } | null =
  null;
const historyCache = new Map<
  string,
  { data: MarketHistoryResponse; cachedAt: number }
>();

async function fetchYahooChart(
  ticker: string,
  interval: string,
  range: string
): Promise<ParsedYahooChart | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        Accept: 'application/json',
      },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
          };
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              close?: Array<number | null>;
            }>;
          };
        }>;
      };
    };

    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const rawTimestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
    const rawCloses = result.indicators?.quote?.[0]?.close ?? [];
    const points: MarketHistoryPoint[] = [];

    for (let i = 0; i < rawTimestamps.length; i += 1) {
      const ts = rawTimestamps[i];
      const closeVal = rawCloses[i];
      if (
        typeof ts === 'number' &&
        Number.isFinite(ts) &&
        typeof closeVal === 'number' &&
        Number.isFinite(closeVal) &&
        closeVal > 0
      ) {
        points.push({
          timestamp: ts,
          date: new Date(ts * 1000).toISOString(),
          close: closeVal,
        });
      }
    }

    const metaPrice = result.meta?.regularMarketPrice;
    const price =
      typeof metaPrice === 'number' && Number.isFinite(metaPrice) && metaPrice > 0
        ? metaPrice
        : points.length > 0
          ? points[points.length - 1].close
          : 0;

    if (price <= 0) return null;

    const rawPrev =
      result.meta?.previousClose ??
      result.meta?.chartPreviousClose ??
      (points.length > 1 ? points[0].close : price);
    const previousClose =
      typeof rawPrev === 'number' && Number.isFinite(rawPrev) && rawPrev > 0
        ? rawPrev
        : price;

    return { price, previousClose, points };
  } catch {
    return null;
  }
}

async function fetchYahooWithFallbackTickers(
  tickers: string[],
  interval: string,
  range: string
): Promise<ParsedYahooChart | null> {
  for (const ticker of tickers) {
    const parsed = await fetchYahooChart(ticker, interval, range);
    if (parsed) return parsed;
  }
  return null;
}

async function fetchFrankfurterEurUsd(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.frankfurter.app/latest?from=EUR&to=USD',
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { rates?: { USD?: number } };
    const usd = json?.rates?.USD;
    return typeof usd === 'number' && Number.isFinite(usd) && usd > 0
      ? usd
      : null;
  } catch {
    return null;
  }
}

async function buildLiveSnapshot(): Promise<MarketsSnapshotResponse> {
  const [eurYahoo, goldUsdYahoo, silverUsdYahoo] = await Promise.all([
    fetchYahooChart('EURUSD=X', '1d', '5d'),
    fetchYahooWithFallbackTickers(['GC=F', 'XAUUSD=X'], '1d', '5d'),
    fetchYahooWithFallbackTickers(['SI=F', 'XAGUSD=X'], '1d', '5d'),
  ]);

  let fxPrice = eurYahoo?.price ?? null;
  let fxPrev = eurYahoo?.previousClose ?? null;
  let fxIsLive = Boolean(eurYahoo);

  if (fxPrice === null) {
    const ecbUsd = await fetchFrankfurterEurUsd();
    if (ecbUsd !== null) {
      fxPrice = ecbUsd;
      fxPrev = ecbUsd;
      fxIsLive = true;
    }
  }

  const fallbackSnapshot = snapshotCache?.data ?? buildFallbackSnapshot();
  const safeFxPrice = fxPrice ?? fallbackSnapshot.quotes.EURUSD.price;
  const safeFxPrev = fxPrev ?? fallbackSnapshot.quotes.EURUSD.previousClose;

  const roundedFx = roundToDecimals(safeFxPrice, 4);
  const roundedFxPrev = roundToDecimals(safeFxPrev, 4);
  const eurChange =
    roundedFxPrev > 0
      ? roundToDecimals(((roundedFx - roundedFxPrev) / roundedFxPrev) * 100, 2)
      : 0;

  const eurQuote: MarketQuoteDTO = fxIsLive
    ? {
        symbol: 'EURUSD',
        label: MARKET_ASSET_META.EURUSD.label,
        unitCurrency: 'USD',
        decimals: 4,
        price: roundedFx,
        previousClose: roundedFxPrev,
        changePercent: eurChange,
      }
    : { ...fallbackSnapshot.quotes.EURUSD };

  const goldQuote: MarketQuoteDTO = goldUsdYahoo
    ? convertMetalUsdQuoteToEur({
        symbol: 'GOLD',
        metalUsdPrice: goldUsdYahoo.price,
        metalUsdPrevClose: goldUsdYahoo.previousClose,
        eurUsdPrice: safeFxPrice,
        eurUsdPrevClose: safeFxPrev,
      })
    : { ...fallbackSnapshot.quotes.GOLD };

  const silverQuote: MarketQuoteDTO = silverUsdYahoo
    ? convertMetalUsdQuoteToEur({
        symbol: 'SILVER',
        metalUsdPrice: silverUsdYahoo.price,
        metalUsdPrevClose: silverUsdYahoo.previousClose,
        eurUsdPrice: safeFxPrice,
        eurUsdPrevClose: safeFxPrev,
      })
    : { ...fallbackSnapshot.quotes.SILVER };

  const liveCount =
    (fxIsLive ? 1 : 0) + (goldUsdYahoo ? 1 : 0) + (silverUsdYahoo ? 1 : 0);

  const source: MarketsSnapshotResponse['source'] =
    liveCount === 3 ? 'LIVE' : liveCount > 0 ? 'MIXED' : 'FALLBACK';

  return {
    quotes: {
      EURUSD: eurQuote,
      GOLD: goldQuote,
      SILVER: silverQuote,
    },
    updatedAt: new Date().toISOString(),
    source,
    warning:
      source === 'LIVE'
        ? null
        : source === 'MIXED'
          ? 'Certaines cotations utilisent une valeur de secours.'
          : 'Flux marchés externe inaccessible — valeurs indicatives affichées.',
  };
}

async function buildLiveHistory(
  symbol: MarketSymbol,
  range: MarketRange
): Promise<MarketHistoryResponse> {
  const { interval, range: yahooRange } = getYahooChartParams(range);
  const meta = MARKET_ASSET_META[symbol];

  if (symbol === 'EURUSD') {
    const eurChart = await fetchYahooChart('EURUSD=X', interval, yahooRange);
    if (!eurChart || eurChart.points.length === 0) {
      return (
        historyCache.get(`${symbol}:${range}`)?.data ??
        buildFallbackHistory(symbol, range)
      );
    }

    const points = eurChart.points.map((p) => ({
      ...p,
      close: roundToDecimals(p.close, 4),
    }));
    const stats = computeMarketHistoryStats(points, 4);

    return {
      symbol,
      label: meta.label,
      range,
      unitCurrency: meta.unitCurrency,
      decimals: 4,
      currentPrice: stats.currentPrice,
      changePercent: stats.changePercent,
      high: stats.high,
      low: stats.low,
      points,
      updatedAt: new Date().toISOString(),
      source: 'LIVE',
      warning: null,
    };
  }

  const tickers =
    symbol === 'GOLD' ? ['GC=F', 'XAUUSD=X'] : ['SI=F', 'XAGUSD=X'];

  const [metalChart, eurChart] = await Promise.all([
    fetchYahooWithFallbackTickers(tickers, interval, yahooRange),
    fetchYahooChart('EURUSD=X', interval, yahooRange),
  ]);

  if (!metalChart || metalChart.points.length === 0) {
    return (
      historyCache.get(`${symbol}:${range}`)?.data ??
      buildFallbackHistory(symbol, range)
    );
  }

  const fallbackFx =
    eurChart?.price ??
    snapshotCache?.data.quotes.EURUSD.price ??
    (await fetchFrankfurterEurUsd()) ??
    1.0845;

  const points = convertUsdSeriesToEur(
    metalChart.points,
    eurChart?.points ?? [],
    fallbackFx,
    2
  );

  if (points.length === 0) {
    return buildFallbackHistory(symbol, range);
  }

  const stats = computeMarketHistoryStats(points, 2);

  return {
    symbol,
    label: meta.label,
    range,
    unitCurrency: meta.unitCurrency,
    decimals: 2,
    currentPrice: stats.currentPrice,
    changePercent: stats.changePercent,
    high: stats.high,
    low: stats.low,
    points,
    updatedAt: new Date().toISOString(),
    source: 'LIVE',
    warning: null,
  };
}

export async function GET(request: NextRequest) {
  const symbolParam = request.nextUrl.searchParams.get('symbol');
  const rangeParam = request.nextUrl.searchParams.get('range');
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';
  const nowMs = Date.now();

  if (symbolParam !== null) {
    const symbol = parseMarketSymbol(symbolParam);
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbole de marché non reconnu (EURUSD, GOLD, SILVER).' },
        { status: 400 }
      );
    }

    const range = parseMarketRange(rangeParam);
    const cacheKey = `${symbol}:${range}`;
    const cached = historyCache.get(cacheKey);
    if (
      !forceRefresh &&
      cached &&
      nowMs - cached.cachedAt < CACHE_TTL_MS &&
      cached.data.source === 'LIVE'
    ) {
      return NextResponse.json(cached.data);
    }

    const history = await buildLiveHistory(symbol, range);
    if (history.source === 'LIVE') {
      historyCache.set(cacheKey, { data: history, cachedAt: nowMs });
    }
    return NextResponse.json(history);
  }

  if (
    !forceRefresh &&
    snapshotCache &&
    nowMs - snapshotCache.cachedAt < CACHE_TTL_MS &&
    snapshotCache.data.source !== 'FALLBACK'
  ) {
    return NextResponse.json(snapshotCache.data);
  }

  const snapshot = await buildLiveSnapshot();
  if (snapshot.source !== 'FALLBACK') {
    snapshotCache = { data: snapshot, cachedAt: nowMs };
  }
  return NextResponse.json(snapshot);
}
