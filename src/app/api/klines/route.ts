// 历史 K线接口 - 基于用户 watchlist 拉取，计算 MA5/MA10/MACD/KDJ
import { NextRequest, NextResponse } from 'next/server';
import { SECURITY_LIBRARY, SECURITY_BY_ID, DEFAULT_WATCHLIST } from '@/lib/security-library';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // 缓存 5 分钟

interface KlineItem {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface TechIndicators {
  ma5: number;
  ma10: number;
  ma20: number;
  macd: number;       // DIF - DEA (柱)
  dif: number;        // DIF
  dea: number;        // DEA
  kdjK: number;
  kdjD: number;
  kdjJ: number;
  rsi6: number;
  rsi12: number;
}

interface KlineResult {
  id: string;
  code: string;
  name: string;
  currentPrice: number;
  klines: KlineItem[];
  indicators: TechIndicators;
  trend: 'up' | 'down' | 'flat';
  // 近期统计
  recent5Change: number;
  recent20Change: number;
  recentVolumeAvg: number; // 近20日均量
  volumeRatio: number;     // 量比
}

// 计算 SMA
function sma(values: number[], period: number): number {
  if (values.length < period) return values.reduce((s, v) => s + v, 0) / values.length;
  const slice = values.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

// 计算 EMA
function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let e = values[0];
  for (let i = 1; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
  }
  return e;
}

// 计算 MACD (12, 26, 9)
function calcMacd(closes: number[]): { dif: number; dea: number; macd: number } {
  if (closes.length < 26) return { dif: 0, dea: 0, macd: 0 };
  const ema12 = ema(closes.slice(-26), 12);
  const ema26 = ema(closes.slice(-26), 26);
  const dif = ema12 - ema26;
  // 计算 DEA：需要历史 DIF 序列
  const difs: number[] = [];
  for (let i = 26; i <= closes.length; i++) {
    const sub = closes.slice(0, i);
    if (sub.length < 26) continue;
    const e12 = ema(sub.slice(-Math.min(sub.length, 50)), 12);
    const e26 = ema(sub.slice(-Math.min(sub.length, 50)), 26);
    difs.push(e12 - e26);
  }
  const dea = ema(difs.slice(-Math.min(difs.length, 50)), 9);
  return { dif, dea, macd: (dif - dea) * 2 };
}

// 计算 KDJ (9, 3, 3)
function calcKdj(klines: KlineItem[]): { k: number; d: number; j: number } {
  if (klines.length < 9) return { k: 50, d: 50, j: 50 };
  // 取最近 9 日的 RSV
  const recent = klines.slice(-9);
  const high9 = Math.max(...recent.map((k) => k.high));
  const low9 = Math.min(...recent.map((k) => k.low));
  const close = recent[recent.length - 1].close;
  const rsv = high9 > low9 ? ((close - low9) / (high9 - low9)) * 100 : 50;

  // 简化：用最近多日 RSV 序列迭代 K、D
  let k = 50, d = 50;
  for (let i = 9; i <= klines.length; i++) {
    const sub = klines.slice(0, i).slice(-9);
    if (sub.length < 9) continue;
    const h = Math.max(...sub.map((x) => x.high));
    const l = Math.min(...sub.map((x) => x.low));
    const c = sub[sub.length - 1].close;
    const r = h > l ? ((c - l) / (h - l)) * 100 : 50;
    k = (2 / 3) * k + (1 / 3) * r;
    d = (2 / 3) * d + (1 / 3) * k;
  }
  const j = 3 * k - 2 * d;
  return { k: Number(k.toFixed(2)), d: Number(d.toFixed(2)), j: Number(j.toFixed(2)) };
}

// 计算 RSI
function calcRsi(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

async function fetchKlines(code: string, market: string): Promise<KlineItem[]> {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${market}${code},day,,,120,qfq`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://gu.qq.com/',
    },
    cache: 'no-store',
  });
  if (!resp.ok) throw new Error(`K线接口失败: ${resp.status}`);
  const data = await resp.json();
  // 部分 ETF 较新，没有前复权数据，需要降级用 day 字段
  const key = `${market}${code}`;
  const entry = data?.data?.[key];
  const arr = entry?.qfqday || entry?.day || [];
  return arr.map((k: any[]) => ({
    date: k[0],
    open: parseFloat(k[1]),
    close: parseFloat(k[2]),
    high: parseFloat(k[3]),
    low: parseFloat(k[4]),
    volume: parseFloat(k[5]) || 0,
  }));
}

export async function GET(request: NextRequest) {
  try {
    // 从 query 参数读取用户 watchlist
    const url = new URL(request.url);
    const watchlistParam = url.searchParams.get('ids');
    const watchlist = watchlistParam
      ? watchlistParam.split(',').filter(Boolean)
      : DEFAULT_WATCHLIST;

    const securities = watchlist.map((id) => SECURITY_BY_ID[id]).filter(Boolean);

    const results = await Promise.all(
      securities.map(async (cfg) => {
        try {
          const klines = await fetchKlines(cfg.code, cfg.market);
          if (klines.length === 0) {
            return {
              id: cfg.id,
              code: cfg.code,
              name: cfg.fullName,
              currentPrice: 0,
              klines: [],
              indicators: { ma5: 0, ma10: 0, ma20: 0, macd: 0, dif: 0, dea: 0, kdjK: 50, kdjD: 50, kdjJ: 50, rsi6: 50, rsi12: 50 },
              trend: 'flat' as const,
              recent5Change: 0,
              recent20Change: 0,
              recentVolumeAvg: 0,
              volumeRatio: 0,
              error: '无数据',
            };
          }

          const closes = klines.map((k) => k.close);
          const currentPrice = closes[closes.length - 1];
          const ma5 = sma(closes, 5);
          const ma10 = sma(closes, 10);
          const ma20 = sma(closes, 20);
          const { dif, dea, macd } = calcMacd(closes);
          const { k: kdjK, d: kdjD, j: kdjJ } = calcKdj(klines);
          const rsi6 = calcRsi(closes, 6);
          const rsi12 = calcRsi(closes, 12);

          // 趋势判断
          let trend: 'up' | 'down' | 'flat' = 'flat';
          if (currentPrice > ma5 && ma5 > ma10 && dif > dea) trend = 'up';
          else if (currentPrice < ma5 && ma5 < ma10 && dif < dea) trend = 'down';

          // 近期涨跌
          const recent5Change = klines.length >= 6
            ? ((currentPrice - klines[klines.length - 6].close) / klines[klines.length - 6].close) * 100
            : 0;
          const recent20Change = klines.length >= 21
            ? ((currentPrice - klines[klines.length - 21].close) / klines[klines.length - 21].close) * 100
            : 0;

          // 量比
          const recentVolumeAvg = klines.slice(-21, -1).reduce((s, k) => s + k.volume, 0) / Math.min(20, klines.length - 1);
          const todayVolume = klines[klines.length - 1].volume;
          const volumeRatio = recentVolumeAvg > 0 ? todayVolume / recentVolumeAvg : 0;

          return {
            id: cfg.id,
            code: cfg.code,
            name: cfg.fullName,
            currentPrice: Number(currentPrice.toFixed(3)),
            klines: klines.slice(-60).map((k) => ({
              ...k,
              close: Number(k.close.toFixed(3)),
              open: Number(k.open.toFixed(3)),
              high: Number(k.high.toFixed(3)),
              low: Number(k.low.toFixed(3)),
            })),
            indicators: {
              ma5: Number(ma5.toFixed(3)),
              ma10: Number(ma10.toFixed(3)),
              ma20: Number(ma20.toFixed(3)),
              macd: Number(macd.toFixed(4)),
              dif: Number(dif.toFixed(4)),
              dea: Number(dea.toFixed(4)),
              kdjK, kdjD, kdjJ,
              rsi6, rsi12,
            },
            trend,
            recent5Change: Number(recent5Change.toFixed(2)),
            recent20Change: Number(recent20Change.toFixed(2)),
            recentVolumeAvg: Math.round(recentVolumeAvg),
            volumeRatio: Number(volumeRatio.toFixed(2)),
          } as KlineResult;
        } catch (err: any) {
          return {
            id: cfg.id,
            code: cfg.code,
            name: cfg.fullName,
            currentPrice: 0,
            klines: [],
            indicators: { ma5: 0, ma10: 0, ma20: 0, macd: 0, dif: 0, dea: 0, kdjK: 50, kdjD: 50, kdjJ: 50, rsi6: 50, rsi12: 50 },
            trend: 'flat' as const,
            recent5Change: 0,
            recent20Change: 0,
            recentVolumeAvg: 0,
            volumeRatio: 0,
            error: err?.message || '未知错误',
          };
        }
      })
    );

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      data: results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
