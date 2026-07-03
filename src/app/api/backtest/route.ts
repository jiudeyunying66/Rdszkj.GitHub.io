// 历史回测接口 - 基于用户 watchlist 拉取，计算 MA5/MA10/MACD/KDJ
import { NextRequest, NextResponse } from 'next/server';
import { SECURITY_LIBRARY, SECURITY_BY_ID, DEFAULT_WATCHLIST } from '@/lib/security-library';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface KlineItem {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface BacktestConfig {
  initialCapital: number;
  cashReserve: number;
  positions: Record<string, {
    shares: number;
    costPrice: number;
    addLine1: number;
    addLine2: number;
    takeProfitLine: number;
    weeklyInvest?: number;
  }>;
  startDate?: string;
  endDate?: string;
}

// 策略变体配置（用于多策略对比）
interface StrategyVariant {
  id: string;
  name: string;
  description: string;
  addLine1Override?: number;
  addLine2Override?: number;
  takeProfitLineOverride?: number;
  enableAddPosition?: boolean;
  enableTakeProfit?: boolean;
  enableWeeklyInvest?: boolean;
}

interface BacktestTrade {
  date: string;
  etfId: string;
  etfName: string;
  type: 'buy' | 'sell';
  shares: number;
  price: number;
  amount: number;
  reason: string;
  pnl?: number;
}

interface BacktestResult {
  config: BacktestConfig;
  trades: BacktestTrade[];
  // 时间序列
  equityCurve: { date: string; total: number; benchmark: number; strategy: number }[];
  // 统计
  stats: {
    initialValue: number;
    finalValue: number;
    totalReturn: number;        // 总收益率 %
    annualReturn: number;       // 年化收益率 %
    benchmarkReturn: number;    // 基准收益率 %
    excessReturn: number;       // 超额收益 %
    maxDrawdown: number;        // 最大回撤 %
    maxDrawdownDate: string;
    sharpeRatio: number;        // 夏普比率
    volatility: number;         // 年化波动率 %
    winRate: number;            // 胜率 %
    totalTrades: number;
    buyTrades: number;
    sellTrades: number;
    tradingDays: number;
  };
  // 每ETF统计
  perEtf: Array<{
    etfId: string;
    etfName: string;
    trades: number;
    buyCount: number;
    sellCount: number;
    finalShares: number;
    avgCost: number;
    pnl: number;
    pnlPercent: number;
  }>;
  timestamp: string;
}

async function fetchKlines(code: string, market: string, days: number = 250): Promise<KlineItem[]> {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${market}${code},day,,,${days + 30},qfq`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://gu.qq.com/',
    },
    cache: 'no-store',
  });
  if (!resp.ok) throw new Error(`K线接口失败: ${resp.status}`);
  const data = await resp.json();
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

// 计算技术指标
function calcMa(closes: number[], period: number): number {
  if (closes.length < period) return closes.reduce((s, v) => s + v, 0) / closes.length;
  return closes.slice(-period).reduce((s, v) => s + v, 0) / period;
}

function calcKdjJ(klines: KlineItem[], idx: number, period: number = 9): number {
  if (idx < period) return 50;
  const recent = klines.slice(Math.max(0, idx - period + 1), idx + 1);
  const high = Math.max(...recent.map((k) => k.high));
  const low = Math.min(...recent.map((k) => k.low));
  const close = klines[idx].close;
  return high > low ? ((close - low) / (high - low)) * 100 : 50;
}

// 执行回测（支持策略变体）
async function runBacktest(config: BacktestConfig, variant?: StrategyVariant): Promise<BacktestResult> {
  // 应用策略变体覆盖
  const effectiveConfig: BacktestConfig = {
    ...config,
    positions: Object.fromEntries(
      Object.entries(config.positions).map(([id, p]) => [
        id,
        {
          ...p,
          addLine1: variant?.addLine1Override ?? p.addLine1,
          addLine2: variant?.addLine2Override ?? p.addLine2,
          takeProfitLine: variant?.takeProfitLineOverride ?? p.takeProfitLine,
        },
      ])
    ),
  };

  const enableAddPosition = variant?.enableAddPosition !== false;
  const enableTakeProfit = variant?.enableTakeProfit !== false;
  const enableWeeklyInvest = variant?.enableWeeklyInvest !== false;

  // 1. 拉取所有持仓的 K 线（基于 watchlist）
  const watchlist = Object.keys(effectiveConfig.positions);
  const klineData: Record<string, KlineItem[]> = {};
  await Promise.all(
    watchlist.map(async (id) => {
      const cfg = SECURITY_BY_ID[id];
      if (!cfg) return;
      try {
        klineData[id] = await fetchKlines(cfg.code, cfg.market, 250);
      } catch (e) {
        klineData[id] = [];
      }
    })
  );

  // 2. 取所有持仓共有的日期
  const allDates: string[] = [];
  for (const id in klineData) {
    if (klineData[id].length === 0) continue;
    if (allDates.length === 0) {
      allDates.push(...klineData[id].map((k) => k.date));
    } else {
      const set = new Set(klineData[id].map((k) => k.date));
      // 保留交集
      for (let i = allDates.length - 1; i >= 0; i--) {
        if (!set.has(allDates[i])) allDates.splice(i, 1);
      }
    }
  }
  allDates.sort();
  // 截取最近 180 个交易日
  const recentDates = allDates.slice(-180);

  // 3. 初始化账户状态
  const state: Record<string, {
    shares: number;
    costPrice: number;
    cashInvested: number;
  }> = {};

  for (const id of watchlist) {
    const cfg = SECURITY_BY_ID[id];
    if (!cfg) continue;
    const p = effectiveConfig.positions[id];
    if (p) {
      // 初始持仓按起始日开盘价计入
      const startK = klineData[id]?.find((k) => k.date === recentDates[0]);
      const startPrice = startK?.open || p.costPrice;
      state[id] = {
        shares: p.shares,
        costPrice: p.costPrice,
        cashInvested: p.shares * p.costPrice,
      };
    }
  }

  let cash = config.initialCapital - Object.values(state).reduce((s, x) => s + x.cashInvested, 0);
  // 现金储备单独扣除（不参与策略）
  const usableCash = Math.max(0, cash - config.cashReserve);

  const trades: BacktestTrade[] = [];
  const equityCurve: BacktestResult['equityCurve'] = [];
  let benchmarkInitial = 0;
  let strategyInitial = 0;

  // 4. 逐日遍历
  recentDates.forEach((date, dateIdx) => {
    // 每周一加仓（沪深300定投）
    const dayOfWeek = new Date(date).getDay();
    const isWeeklyInvest = dayOfWeek === 1; // 周一

    watchlist.forEach((id) => {
      const cfg = SECURITY_BY_ID[id];
      if (!cfg) return;
      const klines = klineData[id];
      if (!klines) return;
      const idx = klines.findIndex((k) => k.date === date);
      if (idx < 0) return;
      const k = klines[idx];
      const pos = effectiveConfig.positions[id];
      if (!pos) return;
      const st = state[id];
      if (!st) return;

      // 计算技术指标
      const closes = klines.slice(Math.max(0, idx - 30), idx + 1).map((x) => x.close);
      const ma5 = calcMa(closes, 5);
      const ma10 = calcMa(closes, 10);
      const kdjJ = calcKdjJ(klines, idx);

      // 持仓盈亏 %
      const pnlPercent = st.costPrice > 0 ? ((k.close - st.costPrice) / st.costPrice) * 100 : 0;

      // === 策略规则 ===
      // 规则1：止盈 - 达到止盈线卖出整百股
      if (pnlPercent >= pos.takeProfitLine && st.shares >= 100) {
        const sellShares = Math.floor(st.shares / 100) * 100; // 卖出整百股
        if (sellShares > 0) {
          const sellAmount = sellShares * k.close;
          cash += sellAmount;
          const pnl = (k.close - st.costPrice) * sellShares;
          trades.push({
            date, etfId: cfg.id, etfName: cfg.name,
            type: 'sell', shares: sellShares, price: k.close, amount: sellAmount,
            reason: `止盈 +${pos.takeProfitLine}%（实际 ${pnlPercent.toFixed(2)}%）`,
            pnl,
          });
          st.shares -= sellShares;
          if (st.shares === 0) {
            st.costPrice = 0;
            st.cashInvested = 0;
          }
        }
      }

      // 规则2：加仓 - 跌破一级加仓线，买入100股
      if (pnlPercent <= pos.addLine1 && usableCash >= k.close * 100) {
        const buyShares = pnlPercent <= pos.addLine2 ? 200 : 100; // 二级加仓线双倍
        const buyAmount = buyShares * k.close;
        if (cash >= buyAmount) {
          // 更新成本
          const newTotalShares = st.shares + buyShares;
          const newTotalCost = st.costPrice * st.shares + buyAmount;
          st.costPrice = newTotalShares > 0 ? newTotalCost / newTotalShares : k.close;
          st.shares = newTotalShares;
          st.cashInvested += buyAmount;
          cash -= buyAmount;
          trades.push({
            date, etfId: cfg.id, etfName: cfg.name,
            type: 'buy', shares: buyShares, price: k.close, amount: buyAmount,
            reason: pnlPercent <= pos.addLine2
              ? `二级加仓线 ${pos.addLine2}%（实际 ${pnlPercent.toFixed(2)}%）`
              : `一级加仓线 ${pos.addLine1}%（实际 ${pnlPercent.toFixed(2)}%）`,
          });
        }
      }

      // 规则3：沪深300 周一定投
      if (cfg.id === 'csi300' && isWeeklyInvest && pos.weeklyInvest && pos.weeklyInvest > 0) {
        const buyShares = Math.floor(pos.weeklyInvest / k.close);
        if (buyShares > 0 && cash >= buyShares * k.close) {
          const buyAmount = buyShares * k.close;
          const newTotalShares = st.shares + buyShares;
          const newTotalCost = st.costPrice * st.shares + buyAmount;
          st.costPrice = newTotalShares > 0 ? newTotalCost / newTotalShares : k.close;
          st.shares = newTotalShares;
          st.cashInvested += buyAmount;
          cash -= buyAmount;
          trades.push({
            date, etfId: cfg.id, etfName: cfg.name,
            type: 'buy', shares: buyShares, price: k.close, amount: buyAmount,
            reason: `周一定投 ¥${pos.weeklyInvest}`,
          });
        }
      }
    });

    // 计算当日总资产
    let totalPositionValue = 0;
    watchlist.forEach((id) => {
      const klines = klineData[id];
      if (!klines) return;
      const k = klines.find((x) => x.date === date);
      if (!k) return;
      totalPositionValue += (state[id]?.shares || 0) * k.close;
    });
    const total = totalPositionValue + cash;

    // 基准：等权持有初始仓位不变（buy & hold）
    let benchmarkValue = 0;
    watchlist.forEach((id) => {
      const klines = klineData[id];
      if (!klines) return;
      const k = klines.find((x) => x.date === date);
      if (!k) return;
      const initShares = effectiveConfig.positions[id]?.shares || 0;
      benchmarkValue += initShares * k.close;
    });

    if (dateIdx === 0) {
      benchmarkInitial = benchmarkValue + effectiveConfig.initialCapital - Object.values(state).reduce((s, x) => s + x.cashInvested, 0);
      strategyInitial = total;
    }

    equityCurve.push({
      date,
      total,
      benchmark: benchmarkValue + (effectiveConfig.initialCapital - Object.values(state).reduce((s, x) => s + x.cashInvested, 0)),
      strategy: total,
    });
  });

  // 5. 计算统计
  const initialValue = strategyInitial;
  const finalValue = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].total : initialValue;
  const totalReturn = initialValue > 0 ? ((finalValue - initialValue) / initialValue) * 100 : 0;
  const tradingDays = equityCurve.length;
  const annualReturn = tradingDays > 0 ? (Math.pow(finalValue / initialValue, 252 / tradingDays) - 1) * 100 : 0;

  const benchmarkFinal = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].benchmark : benchmarkInitial;
  const benchmarkReturn = benchmarkInitial > 0 ? ((benchmarkFinal - benchmarkInitial) / benchmarkInitial) * 100 : 0;
  const excessReturn = totalReturn - benchmarkReturn;

  // 最大回撤
  let maxDrawdown = 0;
  let maxDrawdownDate = '';
  let peak = -Infinity;
  equityCurve.forEach((p) => {
    if (p.total > peak) peak = p.total;
    const dd = peak > 0 ? ((peak - p.total) / peak) * 100 : 0;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      maxDrawdownDate = p.date;
    }
  });

  // 日收益率序列
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i - 1].total > 0) {
      dailyReturns.push((equityCurve[i].total - equityCurve[i - 1].total) / equityCurve[i - 1].total);
    }
  }
  const avgReturn = dailyReturns.reduce((s, r) => s + r, 0) / (dailyReturns.length || 1);
  const variance = dailyReturns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (dailyReturns.length || 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  const sharpeRatio = volatility > 0 ? (annualReturn - 3) / volatility : 0; // 无风险利率3%

  // 胜率（卖出盈利次数 / 总卖出次数）
  const sellTrades = trades.filter((t) => t.type === 'sell');
  const winTrades = sellTrades.filter((t) => (t.pnl || 0) > 0);
  const winRate = sellTrades.length > 0 ? (winTrades.length / sellTrades.length) * 100 : 0;

  // 每ETF统计
  const perEtf = watchlist.map((id) => {
    const cfg = SECURITY_BY_ID[id];
    if (!cfg) return null;
    const etfTrades = trades.filter((t) => t.etfId === id);
    const klines = klineData[id];
    const lastK = klines?.[klines.length - 1];
    const finalShares = state[id]?.shares || 0;
    const avgCost = state[id]?.costPrice || 0;
    const pnl = finalShares > 0 && lastK ? (lastK.close - avgCost) * finalShares : 0;
    const pnlPercent = avgCost > 0 ? ((lastK?.close || 0) - avgCost) / avgCost * 100 : 0;
    return {
      etfId: id,
      etfName: cfg.name,
      trades: etfTrades.length,
      buyCount: etfTrades.filter((t) => t.type === 'buy').length,
      sellCount: etfTrades.filter((t) => t.type === 'sell').length,
      finalShares,
      avgCost,
      pnl,
      pnlPercent,
    };
  }).filter(Boolean) as any[];

  return {
    config,
    trades,
    equityCurve: equityCurve.filter((_, i) => i % 3 === 0 || i === equityCurve.length - 1), // 每3天采样一次
    stats: {
      initialValue: Number(initialValue.toFixed(2)),
      finalValue: Number(finalValue.toFixed(2)),
      totalReturn: Number(totalReturn.toFixed(2)),
      annualReturn: Number(annualReturn.toFixed(2)),
      benchmarkReturn: Number(benchmarkReturn.toFixed(2)),
      excessReturn: Number(excessReturn.toFixed(2)),
      maxDrawdown: Number(maxDrawdown.toFixed(2)),
      maxDrawdownDate,
      sharpeRatio: Number(sharpeRatio.toFixed(2)),
      volatility: Number(volatility.toFixed(2)),
      winRate: Number(winRate.toFixed(1)),
      totalTrades: trades.length,
      buyTrades: trades.filter((t) => t.type === 'buy').length,
      sellTrades: trades.filter((t) => t.type === 'sell').length,
      tradingDays,
    },
    perEtf,
    timestamp: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config: BacktestConfig = {
      initialCapital: body.initialCapital || 10000,
      cashReserve: body.cashReserve || 500,
      positions: body.positions || {},
    };

    if (Object.keys(config.positions).length === 0) {
      return NextResponse.json({ error: '缺少持仓配置' }, { status: 400 });
    }

    // 对比模式：body.compare === true 时跑 4 组策略对比
    if (body.compare === true) {
      const variants: StrategyVariant[] = [
        {
          id: 'conservative',
          name: '保守策略',
          description: '加仓 -3%/-5%，止盈 +8%',
          addLine1Override: -3, addLine2Override: -5, takeProfitLineOverride: 8,
        },
        {
          id: 'baseline',
          name: '基准策略（当前）',
          description: '使用用户当前参数',
        },
        {
          id: 'aggressive',
          name: '激进策略',
          description: '加仓 -1%/-3%，止盈 +15%',
          addLine1Override: -1, addLine2Override: -3, takeProfitLineOverride: 15,
        },
        {
          id: 'dca_only',
          name: '只定投不加仓',
          description: '仅周定投，不触发加仓/止盈',
          enableAddPosition: false, enableTakeProfit: false, enableWeeklyInvest: true,
        },
      ];

      const results = await Promise.all(
        variants.map(async (v) => {
          const r = await runBacktest(config, v);
          return {
            variantId: v.id,
            variantName: v.name,
            description: v.description,
            stats: r.stats,
            equityCurve: r.equityCurve.map((p) => ({ date: p.date, [v.id]: p.total })),
          };
        })
      );

      // 合并净值曲线
      const mergedCurve: any[] = [];
      const dates = results[0]?.equityCurve.map((p) => p.date) || [];
      dates.forEach((date, i) => {
        const row: any = { date };
        results.forEach((r) => {
          row[r.variantId] = r.equityCurve[i]?.[r.variantId] || 0;
        });
        mergedCurve.push(row);
      });

      // 找最优策略（按夏普比率）
      const best = results.reduce((best, r) =>
        r.stats.sharpeRatio > best.stats.sharpeRatio ? r : best, results[0]);

      return NextResponse.json({
        mode: 'compare',
        variants: results.map((r) => ({
          variantId: r.variantId,
          variantName: r.variantName,
          description: r.description,
          stats: r.stats,
        })),
        equityCurve: mergedCurve,
        best: {
          variantId: best.variantId,
          variantName: best.variantName,
          reason: `夏普比率最高 (${best.stats.sharpeRatio.toFixed(2)})`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 单策略模式
    const result = await runBacktest(config);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[backtest] 失败:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    usage: 'POST /api/backtest with {initialCapital, cashReserve, positions: {etfId: {shares, costPrice, addLine1, addLine2, takeProfitLine, weeklyInvest}}}',
    strategy: '止盈线卖出整百股 + 加仓线买入100/200股 + 沪深300周一定投',
    benchmark: '等权持有初始仓位不变（buy & hold）',
  });
}
