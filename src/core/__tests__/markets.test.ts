import { describe, expect, it } from 'vitest';
import {
  buildFallbackHistory,
  buildFallbackSnapshot,
  computeMarketHistoryStats,
  convertMetalUsdQuoteToEur,
  convertUsdSeriesToEur,
  formatMarketChangePercent,
  formatMarketPrice,
  getYahooChartParams,
  parseMarketRange,
  parseMarketSymbol,
} from '../markets';

describe('Markets & currencies pure helpers', () => {
  it('parses market symbols and ranges robustly', () => {
    expect(parseMarketSymbol('eurusd')).toBe('EURUSD');
    expect(parseMarketSymbol('EUR')).toBe('EURUSD');
    expect(parseMarketSymbol('GOLD')).toBe('GOLD');
    expect(parseMarketSymbol('xau')).toBe('GOLD');
    expect(parseMarketSymbol('argent')).toBe('SILVER');
    expect(parseMarketSymbol('XAG')).toBe('SILVER');
    expect(parseMarketSymbol('BTC')).toBeNull();

    expect(parseMarketRange('1d')).toBe('1d');
    expect(parseMarketRange('5Y')).toBe('5y');
    expect(parseMarketRange('max')).toBe('max');
    expect(parseMarketRange('invalid')).toBe('1y');
    expect(getYahooChartParams('5y')).toEqual({ interval: '1wk', range: '5y' });
  });

  it('formats EUR/USD with 4 decimals and metals in EUR with 2 decimals', () => {
    expect(formatMarketPrice(1.0845, 'EURUSD')).toBe('1,0845');
    // Accept standard French narrow no-break / non-breaking spaces in Intl currency output
    expect(formatMarketPrice(2415.2, 'GOLD').replace(/\s/g, ' ')).toBe(
      '2 415,20 €'
    );
    expect(formatMarketPrice(29.1, 'SILVER').replace(/\s/g, ' ')).toBe(
      '29,10 €'
    );
    expect(formatMarketChangePercent(0.75)).toBe('+0,75 %');
    expect(formatMarketChangePercent(-0.48)).toBe('−0,48 %');
    expect(formatMarketChangePercent(0)).toBe('0,00 %');
  });

  it('converts USD metal quotes and time series to EUR accurately', () => {
    const goldEur = convertMetalUsdQuoteToEur({
      symbol: 'GOLD',
      metalUsdPrice: 2700,
      metalUsdPrevClose: 2650,
      eurUsdPrice: 1.08,
      eurUsdPrevClose: 1.08,
    });
    expect(goldEur.price).toBe(2500);
    expect(goldEur.previousClose).toBe(2453.7);
    expect(goldEur.changePercent).toBe(1.89);

    const seriesEur = convertUsdSeriesToEur(
      [
        { timestamp: 100, date: '2026-11-01T00:00:00.000Z', close: 2200 },
        { timestamp: 200, date: '2026-11-02T00:00:00.000Z', close: 2220 },
      ],
      [
        { timestamp: 90, date: '2026-10-31T00:00:00.000Z', close: 1.1 },
        { timestamp: 200, date: '2026-11-02T00:00:00.000Z', close: 1.11 },
      ],
      1.08,
      2
    );
    expect(seriesEur.map((p) => p.close)).toEqual([2000, 2000]);

    const stats = computeMarketHistoryStats(
      [
        { timestamp: 1, date: '2026-11-01T00:00:00.000Z', close: 100 },
        { timestamp: 2, date: '2026-11-02T00:00:00.000Z', close: 125 },
        { timestamp: 3, date: '2026-11-03T00:00:00.000Z', close: 110 },
      ],
      2
    );
    expect(stats).toEqual({
      currentPrice: 110,
      high: 125,
      low: 100,
      changePercent: 10,
    });
  });

  it('builds consistent offline fallback snapshots and historical curves', () => {
    const snap = buildFallbackSnapshot(new Date('2026-11-26T12:00:00.000Z'));
    expect(snap.source).toBe('FALLBACK');
    expect(snap.quotes.EURUSD.price).toBe(1.0845);
    expect(snap.quotes.GOLD.price).toBe(2415.2);
    expect(snap.quotes.SILVER.price).toBe(29.1);

    const hist = buildFallbackHistory(
      'GOLD',
      '1y',
      new Date('2026-11-26T12:00:00.000Z')
    );
    expect(hist.points.length).toBe(52);
    expect(hist.currentPrice).toBe(2415.2);
    expect(hist.high).toBeGreaterThanOrEqual(hist.low);
  });
});
