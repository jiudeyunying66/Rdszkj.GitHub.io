'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, TrendingUp, TrendingDown, Trophy, AlertTriangle, Activity, Target, GitCompare } from 'lucide-react';
import { useUserConfig } from '@/lib/use-user-config';
import { SECURITY_BY_ID, DEFAULT_WATCHLIST } from '@/lib/security-library';

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
  trades: BacktestTrade[];
  equityCurve: { date: string; total: number; benchmark: number; strategy: number }[];
  stats: {
    initialValue: number;
    finalValue: number;
    totalReturn: number;
    annualReturn: number;
    benchmarkReturn: number;
    excessReturn: number;
    maxDrawdown: number;
    maxDrawdownDate: string;
    sharpeRatio: number;
    volatility: number;
    winRate: number;
    totalTrades: number;
    buyTrades: number;
    sellTrades: number;
    tradingDays: number;
  };
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

function fmtMoney(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function BacktestPanel() {
  const { config } = useUserConfig();
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [compareResult, setCompareResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'single' | 'compare'>('single');

  const buildPositions = () => {
    const positions: any = {};
    const watchlist = config.watchlist || DEFAULT_WATCHLIST;
    watchlist.forEach((id) => {
      const p = config.positions[id];
      if (p) {
        positions[id] = {
          shares: p.shares,
          costPrice: p.costPrice,
          addLine1: p.addLine1,
          addLine2: p.addLine2,
          takeProfitLine: p.takeProfitLine,
          weeklyInvest: id === 'csi300' ? config.weeklyInvest : undefined,
        };
      }
    });
    return positions;
  };

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    try {
      const positions = buildPositions();
      const initialCapital = Object.values(config.positions).reduce(
        (s: number, p: any) => s + p.shares * p.costPrice, 0
      ) + config.cashReserve + 1000;

      const r = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialCapital,
          cashReserve: config.cashReserve,
          positions,
          compare: mode === 'compare',
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: '回测失败' }));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const data = await r.json();
      if (mode === 'compare') {
        setCompareResult(data);
        setResult(null);
      } else {
        setResult(data);
        setCompareResult(null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 说明 */}
      <div className="rounded-lg border border-info/30 bg-info/5 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-foreground">
            <Activity className="h-3.5 w-3.5 text-info" />
            <span className="font-medium">历史回测</span>
          </div>
          <span className="text-muted-foreground">
            基于过去 180 个交易日真实K线，模拟策略规则运行，对比等权持有基准
          </span>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded border border-border/60 bg-card/40 p-2 text-[10px]">
            <span className="text-up">止盈规则</span>：持仓盈亏达止盈线 → 卖出整百股
          </div>
          <div className="rounded border border-border/60 bg-card/40 p-2 text-[10px]">
            <span className="text-down">加仓规则</span>：跌破一级线买100股 / 二级线买200股
          </div>
          <div className="rounded border border-border/60 bg-card/40 p-2 text-[10px]">
            <span className="text-primary">定投规则</span>：沪深300ETF 周一定投 ¥{config.weeklyInvest}
          </div>
        </div>
      </div>

      {/* 运行按钮 + 模式切换 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-border p-0.5">
          <button
            onClick={() => setMode('single')}
            className={`rounded px-3 py-1 text-xs ${mode === 'single' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            单策略回测
          </button>
          <button
            onClick={() => setMode('compare')}
            className={`flex items-center gap-1 rounded px-3 py-1 text-xs ${mode === 'compare' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            <GitCompare className="h-3 w-3" /> 4 策略对比
          </button>
        </div>
        <Button onClick={runBacktest} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {loading ? '回测运行中...' : mode === 'compare' ? '运行策略对比' : '运行历史回测'}
        </Button>
        <span className="text-xs text-muted-foreground">
          回测区间：最近 180 个交易日 · 基准：等权持有不变
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-up/30 bg-up/5 p-3 text-sm text-up">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          回测失败：{error}
        </div>
      )}

      {/* 对比模式结果 */}
      {compareResult && mode === 'compare' && !loading && (
        <>
          {/* 最优策略提示 */}
          <div className="rounded-lg border border-down/40 bg-down/5 p-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-down" />
              <span className="text-sm font-medium text-down">推荐策略：{compareResult.best.variantName}</span>
              <Badge variant="outline" className="text-[10px] text-down border-down/40">
                {compareResult.best.reason}
              </Badge>
            </div>
          </div>

          {/* 对比表 */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <GitCompare className="h-4 w-4" /> 4 策略横向对比
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 text-left">策略</th>
                      <th className="py-2 text-left">描述</th>
                      <th className="py-2 text-right">总收益</th>
                      <th className="py-2 text-right">年化</th>
                      <th className="py-2 text-right">夏普</th>
                      <th className="py-2 text-right">最大回撤</th>
                      <th className="py-2 text-right">胜率</th>
                      <th className="py-2 text-right">交易</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareResult.variants.map((v: any) => {
                      const isBest = v.variantId === compareResult.best.variantId;
                      return (
                        <tr key={v.variantId} className={`border-b border-border/40 ${isBest ? 'bg-down/5' : ''}`}>
                          <td className="py-2">
                            <div className="flex items-center gap-1.5">
                              {isBest && <Trophy className="h-3 w-3 text-down" />}
                              <span className="font-medium">{v.variantName}</span>
                            </div>
                          </td>
                          <td className="py-2 text-muted-foreground">{v.description}</td>
                          <td className="py-2 text-right font-mono tnum" style={{ color: v.stats.totalReturn >= 0 ? 'var(--up)' : 'var(--down)' }}>
                            {v.stats.totalReturn >= 0 ? '+' : ''}{v.stats.totalReturn.toFixed(2)}%
                          </td>
                          <td className="py-2 text-right font-mono tnum" style={{ color: v.stats.annualReturn >= 0 ? 'var(--up)' : 'var(--down)' }}>
                            {v.stats.annualReturn >= 0 ? '+' : ''}{v.stats.annualReturn.toFixed(2)}%
                          </td>
                          <td className="py-2 text-right font-mono tnum" style={{ color: v.stats.sharpeRatio >= 1 ? 'var(--up)' : v.stats.sharpeRatio >= 0 ? 'var(--warn)' : 'var(--down)' }}>
                            {v.stats.sharpeRatio.toFixed(2)}
                          </td>
                          <td className="py-2 text-right font-mono tnum text-down">{v.stats.maxDrawdown.toFixed(2)}%</td>
                          <td className="py-2 text-right font-mono tnum">{v.stats.winRate.toFixed(0)}%</td>
                          <td className="py-2 text-right font-mono tnum">{v.stats.totalTrades}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 4 策略净值曲线 */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">4 策略净值曲线对比</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={compareResult.equityCurve} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} stroke="var(--border)" tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} stroke="var(--border)" width={60} tickFormatter={(v) => `¥${(v / 1000).toFixed(1)}k`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                      labelStyle={{ color: 'var(--foreground)' }}
                      formatter={(value: number, name: string) => [`¥${fmtMoney(value)}`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="conservative" name="保守" stroke="var(--info)" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="baseline" name="基准" stroke="var(--primary)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="aggressive" name="激进" stroke="var(--up)" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="dca_only" name="只定投" stroke="var(--flat)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {result && !compareResult && !loading && (
        <>
          {/* 核心统计 */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <StatCard
              label="策略总收益"
              value={`${result.stats.totalReturn >= 0 ? '+' : ''}${result.stats.totalReturn.toFixed(2)}%`}
              sub={`¥${fmtMoney(result.stats.initialValue)} → ¥${fmtMoney(result.stats.finalValue)}`}
              color={result.stats.totalReturn >= 0 ? 'var(--up)' : 'var(--down)'}
              icon={result.stats.totalReturn >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            />
            <StatCard
              label="年化收益"
              value={`${result.stats.annualReturn >= 0 ? '+' : ''}${result.stats.annualReturn.toFixed(2)}%`}
              sub={`年化波动率 ${result.stats.volatility.toFixed(2)}%`}
              color={result.stats.annualReturn >= 0 ? 'var(--up)' : 'var(--down)'}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <StatCard
              label="基准收益"
              value={`${result.stats.benchmarkReturn >= 0 ? '+' : ''}${result.stats.benchmarkReturn.toFixed(2)}%`}
              sub="等权持有不变"
              color={result.stats.benchmarkReturn >= 0 ? 'var(--up)' : 'var(--down)'}
              icon={<Target className="h-4 w-4" />}
            />
            <StatCard
              label="超额收益"
              value={`${result.stats.excessReturn >= 0 ? '+' : ''}${result.stats.excessReturn.toFixed(2)}%`}
              sub="策略 - 基准"
              color={result.stats.excessReturn >= 0 ? 'var(--up)' : 'var(--down)'}
              icon={<Trophy className="h-4 w-4" />}
            />
            <StatCard
              label="夏普比率"
              value={result.stats.sharpeRatio.toFixed(2)}
              sub={`最大回撤 ${result.stats.maxDrawdown.toFixed(2)}%`}
              color={result.stats.sharpeRatio >= 1 ? 'var(--up)' : result.stats.sharpeRatio >= 0 ? 'var(--warn)' : 'var(--down)'}
              icon={<Activity className="h-4 w-4" />}
            />
            <StatCard
              label="交易次数"
              value={`${result.stats.totalTrades}`}
              sub={`买${result.stats.buyTrades}/卖${result.stats.sellTrades} · 胜率${result.stats.winRate.toFixed(0)}%`}
              color="var(--info)"
              icon={<Activity className="h-4 w-4" />}
            />
          </div>

          {/* 净值曲线 */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">策略净值 vs 基准净值（180日）</CardTitle>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-primary" /> 策略净值
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-flat" /> 基准（持有不变）
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.equityCurve} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} stroke="var(--border)" tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} stroke="var(--border)" width={60} tickFormatter={(v) => `¥${(v / 1000).toFixed(1)}k`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                      labelStyle={{ color: 'var(--foreground)' }}
                      formatter={(value: number, name: string) => [`¥${fmtMoney(value)}`, name === 'strategy' ? '策略' : '基准']}
                    />
                    <ReferenceLine y={result.stats.initialValue} stroke="var(--flat)" strokeDasharray="2 2" />
                    <Line type="monotone" dataKey="strategy" stroke="var(--primary)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="benchmark" stroke="var(--flat)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* 每 ETF 统计 */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">各 ETF 回测统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.perEtf} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="etfName" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} stroke="var(--border)" />
                    <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} stroke="var(--border)" width={50} tickFormatter={(v) => `${v.toFixed(0)}`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                      labelStyle={{ color: 'var(--foreground)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="buyCount" name="买入次数" fill="var(--down)" />
                    <Bar dataKey="sellCount" name="卖出次数" fill="var(--up)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 表格 */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-1.5 text-left">ETF</th>
                      <th className="py-1.5 text-right">交易次数</th>
                      <th className="py-1.5 text-right">买/卖</th>
                      <th className="py-1.5 text-right">最终持仓</th>
                      <th className="py-1.5 text-right">平均成本</th>
                      <th className="py-1.5 text-right">盈亏</th>
                      <th className="py-1.5 text-right">盈亏%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.perEtf.map((p) => (
                      <tr key={p.etfId} className="border-b border-border/40">
                        <td className="py-1.5 text-left font-medium">{p.etfName}</td>
                        <td className="py-1.5 text-right font-mono tnum">{p.trades}</td>
                        <td className="py-1.5 text-right font-mono tnum">
                          <span className="text-down">{p.buyCount}</span> / <span className="text-up">{p.sellCount}</span>
                        </td>
                        <td className="py-1.5 text-right font-mono tnum">{p.finalShares}</td>
                        <td className="py-1.5 text-right font-mono tnum text-muted-foreground">{p.avgCost.toFixed(3)}</td>
                        <td className="py-1.5 text-right font-mono tnum" style={{ color: p.pnl >= 0 ? 'var(--up)' : 'var(--down)' }}>
                          {p.pnl >= 0 ? '+' : ''}{fmtMoney(p.pnl)}
                        </td>
                        <td className="py-1.5 text-right font-mono tnum" style={{ color: p.pnlPercent >= 0 ? 'var(--up)' : 'var(--down)' }}>
                          {p.pnlPercent >= 0 ? '+' : ''}{p.pnlPercent.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 交易明细 */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">交易明细（最近 30 条）</CardTitle>
                <Badge variant="secondary" className="text-[10px]">共 {result.trades.length} 笔</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-1.5 text-left">日期</th>
                      <th className="py-1.5 text-left">ETF</th>
                      <th className="py-1.5 text-center">类型</th>
                      <th className="py-1.5 text-right">数量</th>
                      <th className="py-1.5 text-right">价格</th>
                      <th className="py-1.5 text-right">金额</th>
                      <th className="py-1.5 text-right">盈亏</th>
                      <th className="py-1.5 text-left">原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(-30).reverse().map((t, i) => (
                      <tr key={i} className="border-b border-border/40">
                        <td className="py-1.5 font-mono tnum text-muted-foreground">{t.date}</td>
                        <td className="py-1.5">{t.etfName}</td>
                        <td className="py-1.5 text-center">
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            style={{ color: t.type === 'buy' ? 'var(--down)' : 'var(--up)', borderColor: t.type === 'buy' ? 'var(--down)' : 'var(--up)' }}
                          >
                            {t.type === 'buy' ? '买入' : '卖出'}
                          </Badge>
                        </td>
                        <td className="py-1.5 text-right font-mono tnum">{t.shares}</td>
                        <td className="py-1.5 text-right font-mono tnum">{t.price.toFixed(3)}</td>
                        <td className="py-1.5 text-right font-mono tnum">¥{fmtMoney(t.amount)}</td>
                        <td className="py-1.5 text-right font-mono tnum" style={{ color: (t.pnl || 0) >= 0 ? 'var(--up)' : 'var(--down)' }}>
                          {t.pnl !== undefined ? `${t.pnl >= 0 ? '+' : ''}${fmtMoney(t.pnl)}` : '-'}
                        </td>
                        <td className="py-1.5 text-muted-foreground text-[10px]">{t.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  label, value, sub, color, icon,
}: {
  label: string; value: string; sub: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="mt-1.5 font-mono text-lg font-semibold tnum" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground tnum">{sub}</div>
    </div>
  );
}
