import type {
  MarketHistoryPoint,
  MarketHistoryResponse,
  MarketQuoteDTO,
  MarketRange,
  MarketSymbol,
  MarketsSnapshotResponse,
} from './types';

export const MARKET_ASSET_META: Record<
  MarketSymbol,
  {
    label: string;
    shortLabel: string;
    unitCurrency: 'USD' | 'EUR';
    decimals: 4 | 2;
  }
> = {
  EURUSD: {
    label: 'EUR / USD',
    shortLabel: 'EUR/USD',
    unitCurrency: 'USD',
    decimals: 4,
  },
  GOLD: {
    label: 'OR (OZ / EUR)',
    shortLabel: 'XAU/EUR',
    unitCurrency: 'EUR',
    decimals: 2,
  },
  SILVER: {
    label: 'ARGENT (OZ / EUR)',
    shortLabel: 'XAG/EUR',
    unitCurrency: 'EUR',
    decimals: 2,
  },
};

export function roundToDecimals(value: number, decimals: number): number {
  const safe = Number.isFinite(value) ? value : 0;
  const factor = Math.pow(10, decimals);
  return Math.round((safe + Number.EPSILON) * factor) / factor;
}

export function parseMarketSymbol(
  raw: string | null | undefined
): MarketSymbol | null {
  if (!raw) return null;
  const norm = raw.trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (norm === 'EURUSD' || norm === 'EUR') return 'EURUSD';
  if (norm === 'GOLD' || norm === 'XAU' || norm === 'XAUEUR' || norm === 'OR') {
    return 'GOLD';
  }
  if (
    norm === 'SILVER' ||
    norm === 'XAG' ||
    norm === 'XAGEUR' ||
    norm === 'ARGENT'
  ) {
    return 'SILVER';
  }
  return null;
}

const VALID_RANGES = new Set<MarketRange>([
  '1d',
  '5d',
  '1mo',
  '1y',
  '5y',
  'max',
]);

export function parseMarketRange(raw: string | null | undefined): MarketRange {
  if (!raw) return '1y';
  const norm = raw.trim().toLowerCase() as MarketRange;
  return VALID_RANGES.has(norm) ? norm : '1y';
}

export function getYahooChartParams(range: MarketRange): {
  interval: string;
  range: string;
} {
  switch (range) {
    case '1d':
      return { interval: '15m', range: '1d' };
    case '5d':
      return { interval: '1h', range: '5d' };
    case '1mo':
      return { interval: '1d', range: '1mo' };
    case '1y':
      return { interval: '1d', range: '1y' };
    case '5y':
      return { interval: '1wk', range: '5y' };
    case 'max':
      return { interval: '1mo', range: 'max' };
  }
}

export function formatMarketPrice(value: number, symbol: MarketSymbol): string {
  const safe = Number.isFinite(value) ? value : 0;
  const meta = MARKET_ASSET_META[symbol];
  if (meta.decimals === 4) {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(roundToDecimals(safe, 4));
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundToDecimals(safe, 2));
}

export function formatMarketChangePercent(changePercent: number): string {
  const safe = Number.isFinite(changePercent) ? changePercent : 0;
  const rounded = roundToDecimals(safe, 2);
  const absStr = Math.abs(rounded).toFixed(2).replace('.', ',');
  if (rounded > 0) return `+${absStr} %`;
  if (rounded < 0) return `−${absStr} %`;
  return `0,00 %`;
}

export function convertMetalUsdQuoteToEur(params: {
  metalUsdPrice: number;
  metalUsdPrevClose: number;
  eurUsdPrice: number;
  eurUsdPrevClose: number;
  symbol: 'GOLD' | 'SILVER';
}): MarketQuoteDTO {
  const meta = MARKET_ASSET_META[params.symbol];
  const safeFx = params.eurUsdPrice > 0 ? params.eurUsdPrice : 1;
  const safePrevFx =
    params.eurUsdPrevClose > 0 ? params.eurUsdPrevClose : safeFx;

  const priceEur = roundToDecimals(
    Math.max(0, params.metalUsdPrice) / safeFx,
    meta.decimals
  );
  const rawPrevEur =
    params.metalUsdPrevClose > 0
      ? params.metalUsdPrevClose / safePrevFx
      : priceEur;
  const prevEur = roundToDecimals(Math.max(0, rawPrevEur), meta.decimals);
  const changePercent =
    prevEur > 0 ? roundToDecimals(((priceEur - prevEur) / prevEur) * 100, 2) : 0;

  return {
    symbol: params.symbol,
    label: meta.label,
    unitCurrency: meta.unitCurrency,
    decimals: meta.decimals,
    price: priceEur,
    previousClose: prevEur,
    changePercent,
  };
}

/**
 * Converts a USD-denominated series (e.g. Gold GC=F or Silver SI=F in USD/oz) into EUR
 * using the nearest prior EUR/USD quote timestamp, falling back to the spot rate.
 */
export function convertUsdSeriesToEur(
  usdPoints: MarketHistoryPoint[],
  eurUsdPoints: MarketHistoryPoint[],
  fallbackEurUsdRate: number,
  decimals: 4 | 2 = 2
): MarketHistoryPoint[] {
  const safeFallback = fallbackEurUsdRate > 0 ? fallbackEurUsdRate : 1;
  if (usdPoints.length === 0) return [];

  const sortedFx = [...eurUsdPoints]
    .filter((p) => p.close > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  let fxIdx = 0;
  return usdPoints
    .filter((p) => Number.isFinite(p.close) && p.close > 0)
    .map((point) => {
      while (
        fxIdx + 1 < sortedFx.length &&
        sortedFx[fxIdx + 1].timestamp <= point.timestamp
      ) {
        fxIdx += 1;
      }

      const fxRate =
        sortedFx.length > 0 && sortedFx[fxIdx].close > 0
          ? sortedFx[fxIdx].close
          : safeFallback;

      return {
        timestamp: point.timestamp,
        date: point.date,
        close: roundToDecimals(point.close / fxRate, decimals),
      };
    });
}

export function computeMarketHistoryStats(
  points: MarketHistoryPoint[],
  decimals: 4 | 2
): {
  currentPrice: number;
  high: number;
  low: number;
  changePercent: number;
} {
  if (points.length === 0) {
    return { currentPrice: 0, high: 0, low: 0, changePercent: 0 };
  }

  let high = -Infinity;
  let low = Infinity;
  for (const pt of points) {
    if (pt.close > high) high = pt.close;
    if (pt.close < low) low = pt.close;
  }

  const first = points[0].close;
  const last = points[points.length - 1].close;
  const changePercent =
    first > 0 ? roundToDecimals(((last - first) / first) * 100, 2) : 0;

  return {
    currentPrice: roundToDecimals(last, decimals),
    high: roundToDecimals(high, decimals),
    low: roundToDecimals(low, decimals),
    changePercent,
  };
}

const FALLBACK_BASE_QUOTES: Record<MarketSymbol, MarketQuoteDTO> = {
  EURUSD: {
    symbol: 'EURUSD',
    label: MARKET_ASSET_META.EURUSD.label,
    unitCurrency: 'USD',
    decimals: 4,
    price: 1.0845,
    previousClose: 1.0819,
    changePercent: 0.24,
  },
  GOLD: {
    symbol: 'GOLD',
    label: MARKET_ASSET_META.GOLD.label,
    unitCurrency: 'EUR',
    decimals: 2,
    price: 2415.2,
    previousClose: 2398.4,
    changePercent: 0.7,
  },
  SILVER: {
    symbol: 'SILVER',
    label: MARKET_ASSET_META.SILVER.label,
    unitCurrency: 'EUR',
    decimals: 2,
    price: 29.1,
    previousClose: 29.24,
    changePercent: -0.48,
  },
};

export function buildFallbackSnapshot(
  now: Date = new Date(),
  warning?: string | null
): MarketsSnapshotResponse {
  return {
    quotes: {
      EURUSD: { ...FALLBACK_BASE_QUOTES.EURUSD },
      GOLD: { ...FALLBACK_BASE_QUOTES.GOLD },
      SILVER: { ...FALLBACK_BASE_QUOTES.SILVER },
    },
    updatedAt: now.toISOString(),
    source: 'FALLBACK',
    warning:
      warning ??
      'Cotations indicatives (service de marché externe temporairement indisponible).',
  };
}

export function buildFallbackHistory(
  symbol: MarketSymbol,
  range: MarketRange,
  now: Date = new Date(),
  warning?: string | null
): MarketHistoryResponse {
  const meta = MARKET_ASSET_META[symbol];
  const base = FALLBACK_BASE_QUOTES[symbol];

  const config: Record<
    MarketRange,
    { count: number; stepMs: number; amp: number; drift: number }
  > = {
    '1d': { count: 24, stepMs: 30 * 60 * 1000, amp: 0.004, drift: 0.002 },
    '5d': { count: 30, stepMs: 4 * 60 * 60 * 1000, amp: 0.011, drift: 0.008 },
    '1mo': { count: 22, stepMs: 24 * 60 * 60 * 1000, amp: 0.024, drift: 0.018 },
    '1y': { count: 52, stepMs: 7 * 24 * 60 * 60 * 1000, amp: 0.05, drift: 0.14 },
    '5y': { count: 60, stepMs: 30 * 24 * 60 * 60 * 1000, amp: 0.08, drift: 0.35 },
    max: { count: 80, stepMs: 90 * 24 * 60 * 60 * 1000, amp: 0.11, drift: 0.55 },
  };

  const cfg = config[range];
  const driftFactor = symbol === 'EURUSD' ? cfg.drift * 0.15 : cfg.drift;
  const ampFactor = symbol === 'EURUSD' ? cfg.amp * 0.45 : cfg.amp;
  const phaseShift = symbol === 'GOLD' ? 0.6 : symbol === 'SILVER' ? 1.4 : 2.1;

  const points: MarketHistoryPoint[] = [];
  const endMs = now.getTime();
  const startPrice = base.price / (1 + driftFactor);

  for (let i = 0; i < cfg.count; i += 1) {
    const progress = cfg.count > 1 ? i / (cfg.count - 1) : 1;
    const tsMs = endMs - (cfg.count - 1 - i) * cfg.stepMs;
    const wave =
      Math.sin(progress * Math.PI * 3.5 + phaseShift) * ampFactor * (1 - progress * 0.35);
    const interpolated =
      i === cfg.count - 1
        ? base.price
        : startPrice * (1 + driftFactor * progress + wave);

    points.push({
      timestamp: Math.floor(tsMs / 1000),
      date: new Date(tsMs).toISOString(),
      close: roundToDecimals(interpolated, meta.decimals),
    });
  }

  const stats = computeMarketHistoryStats(points, meta.decimals);
  return {
    symbol,
    label: meta.label,
    range,
    unitCurrency: meta.unitCurrency,
    decimals: meta.decimals,
    currentPrice: stats.currentPrice,
    changePercent: stats.changePercent,
    high: stats.high,
    low: stats.low,
    points,
    updatedAt: now.toISOString(),
    source: 'FALLBACK',
    warning:
      warning ??
      'Série indicative (données de marché externes temporairement inaccessibles).',
  };
}
