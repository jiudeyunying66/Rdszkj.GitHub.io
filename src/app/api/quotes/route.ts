// 实时行情接口 - 基于用户 watchlist 拉取行情
import { NextRequest, NextResponse } from 'next/server';
import iconv from 'iconv-lite';
import { SECURITY_LIBRARY, SECURITY_BY_ID, DEFAULT_WATCHLIST } from '@/lib/security-library';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface QuoteData {
  id: string;
  code: string;
  name: string;
  currentPrice: number;
  prevClose: number;
  openPrice: number;
  high: number;
  low: number;
  volume: number;       // 成交量（手）
  amount: number;       // 成交额（元）
  change: number;       // 涨跌额
  changePercent: number; // 涨跌幅 %
  timestamp: string;
  amplitude: number;    // 振幅%
  // 衍生数据 - 基于持仓
  shares: number;
  marketValue: number;
  costValue: number;
  pnl: number;
  pnlPercent: number;
}

const cfgMap = Object.fromEntries(SECURITY_LIBRARY.map((e) => [e.id, e]));

export async function GET(request: NextRequest) {
  try {
    // 从 query 参数读取用户 watchlist（逗号分隔的 id），默认 5 只
    const url = new URL(request.url);
    const watchlistParam = url.searchParams.get('ids');
    const watchlist = watchlistParam
      ? watchlistParam.split(',').filter(Boolean)
      : DEFAULT_WATCHLIST;

    const securities = watchlist
      .map((id) => SECURITY_BY_ID[id])
      .filter(Boolean);

    if (securities.length === 0) {
      return NextResponse.json(
        { error: 'watchlist 为空或所有 id 无效' },
        { status: 400 }
      );
    }

    const codes = securities.map((e) => `${e.market}${e.code}`).join(',');
    const url2 = `https://qt.gtimg.cn/q=${codes}`;

    const resp = await fetch(url2, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://gu.qq.com/',
      },
      cache: 'no-store',
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: `上游响应失败: ${resp.status}` },
        { status: 502 }
      );
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    const text = iconv.decode(buf, 'gbk');

    const result: QuoteData[] = [];
    const lines = text.trim().split('\n');

    for (const line of lines) {
      const m = line.match(/^v_(\w+)="(.+)";?$/);
      if (!m) continue;
      const data = m[2];
      const parts = data.split('~');
      if (parts.length < 35) continue;

      const code = parts[2];
      const cfg = securities.find((e) => e.code === code);
      if (!cfg) continue;

      const currentPrice = parseFloat(parts[3]) || 0;
      const prevClose = parseFloat(parts[4]) || 0;
      const openPrice = parseFloat(parts[5]) || 0;
      const volume = parseInt(parts[6]) || 0;
      const high = parseFloat(parts[33]) || 0;
      const low = parseFloat(parts[34]) || 0;
      const change = parseFloat(parts[31]) || 0;
      const changePercent = parseFloat(parts[32]) || 0;
      const amount = parseFloat(parts[37]) || 0;
      const amplitude = prevClose > 0 ? ((high - low) / prevClose) * 100 : 0;

      result.push({
        id: cfg.id,
        code: cfg.code,
        name: cfg.fullName,
        currentPrice,
        prevClose,
        openPrice,
        high,
        low,
        volume,
        amount,
        change,
        changePercent,
        timestamp: parts[30] || '',
        amplitude: Number(amplitude.toFixed(2)),
        shares: 0, // 不再由 API 返回，由前端从 useUserConfig 读取
        marketValue: 0,
        costValue: 0,
        pnl: 0,
        pnlPercent: 0,
      });
    }

    // 组合级 KPI（基于默认持仓，前端会基于用户配置重算）
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      quotes: result,
      summary: {
        totalAssets: 0,
        totalMarketValue: 0,
        totalCost: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
        cashReserve: 0,
        positionRatio: 0,
        todayPnl: 0,
        todayPnlPercent: 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
