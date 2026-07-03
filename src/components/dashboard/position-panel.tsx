'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, ChevronUp, ChevronDown, Minus, Target, Layers } from 'lucide-react';
import { SECURITY_BY_ID, DEFAULT_WATCHLIST, type SecurityInfo } from '@/lib/security-library';
import { useQuotes, useKlines } from '@/lib/use-market-data';
import { useUserConfig } from '@/lib/use-user-config';

function fmt(v: number, digits = 3) {
  return v.toFixed(digits);
}
function fmtMoney(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function ChangeCell({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const color = value > 0 ? 'var(--up)' : value < 0 ? 'var(--down)' : 'var(--flat)';
  const Icon = value > 0 ? ChevronUp : value < 0 ? ChevronDown : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 font-mono tnum" style={{ color }}>
      <Icon className="h-3 w-3" />
      {value > 0 ? '+' : ''}{value.toFixed(2)}{suffix}
    </span>
  );
}

export function PositionPanel() {
  const { config } = useUserConfig();
  const watchlist = config.watchlist || [];
  const { data: quoteData, isLoading: qLoading } = useQuotes(watchlist);
  const { data: klineData, isLoading: kLoading } = useKlines(watchlist);
  const [sortBy, setSortBy] = useState<'pnlPct' | 'todayChange' | 'value'>('pnlPct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  if (qLoading || kLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 rounded-lg border border-border bg-card text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">正在拉取真实行情与历史K线数据...</span>
      </div>
    );
  }

  if (!quoteData || !klineData) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-up/30 bg-up/5 text-up">
        <span className="text-sm">数据接口异常</span>
      </div>
    );
  }

  // 从 watchlist 动态构建持仓列表
  const securities = watchlist
    .map((id) => SECURITY_BY_ID[id])
    .filter(Boolean) as SecurityInfo[];

  // 合并行情 + 技术指标 + 用户配置
  const rows = securities.map((cfg) => {
    const q = quoteData.quotes.find((x) => x.id === cfg.id);
    const k = klineData.data.find((x) => x.id === cfg.id);
    const userPos = config.positions[cfg.id] || {
      shares: 0,
      costPrice: q?.currentPrice || 0,
      addLine1: -3,
      addLine2: -5,
      takeProfitLine: 10,
    };
    if (!q) return null;
    const userQuote = {
      ...q,
      shares: userPos.shares,
      marketValue: userPos.shares * q.currentPrice,
      costValue: userPos.shares * userPos.costPrice,
      pnl: userPos.shares * (q.currentPrice - userPos.costPrice),
      pnlPercent: userPos.costPrice > 0 ? ((q.currentPrice - userPos.costPrice) / userPos.costPrice) * 100 : 0,
    };
    return { cfg, quote: userQuote, kline: k, userPos };
  }).filter(Boolean) as any[];

  const sorted = [...rows].sort((a, b) => {
    let va = 0, vb = 0;
    if (sortBy === 'pnlPct') {
      va = a.quote.pnlPercent;
      vb = b.quote.pnlPercent;
    } else if (sortBy === 'todayChange') {
      va = a.quote.changePercent;
      vb = b.quote.changePercent;
    } else {
      va = a.quote.marketValue;
      vb = b.quote.marketValue;
    }
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const totalValue = rows.reduce((s, r) => s + r.quote.marketValue, 0);
  const totalCost = rows.reduce((s, r) => s + r.quote.costValue, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">持仓明细</h3>
          <Badge variant="secondary" className="text-[10px]">5 只 ETF · 真实行情</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>总市值 <span className="font-mono text-foreground tnum">¥{fmtMoney(totalValue)}</span></span>
          <span>总成本 <span className="font-mono text-foreground tnum">¥{fmtMoney(totalCost)}</span></span>
          <span>
            总盈亏{' '}
            <span className="font-mono tnum" style={{ color: totalPnl >= 0 ? 'var(--up)' : 'var(--down)' }}>
              {totalPnl >= 0 ? '+' : ''}{fmtMoney(totalPnl)} ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(3)}%)
            </span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs">ETF / 代码</TableHead>
              <TableHead className="text-xs">类型</TableHead>
              <TableHead className="text-right text-xs">持仓 / 目标</TableHead>
              <TableHead className="text-right text-xs">现价</TableHead>
              <TableHead className="text-right text-xs">成本</TableHead>
              <TableHead
                className="cursor-pointer text-right text-xs select-none"
                onClick={() => toggleSort('pnlPct')}
              >
                持仓盈亏 {sortBy === 'pnlPct' && (sortDir === 'desc' ? '↓' : '↑')}
              </TableHead>
              <TableHead
                className="cursor-pointer text-right text-xs select-none"
                onClick={() => toggleSort('todayChange')}
              >
                今日涨跌 {sortBy === 'todayChange' && (sortDir === 'desc' ? '↓' : '↑')}
              </TableHead>
              <TableHead className="text-right text-xs">量比</TableHead>
              <TableHead className="text-center text-xs">技术指标</TableHead>
              <TableHead
                className="cursor-pointer text-right text-xs select-none"
                onClick={() => toggleSort('value')}
              >
                市值 {sortBy === 'value' && (sortDir === 'desc' ? '↓' : '↑')}
              </TableHead>
              <TableHead className="text-center text-xs">加仓/止盈线</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(({ cfg, quote, kline, userPos }) => {
              const isCore = cfg.category === 'core';
              const aboveMa5 = kline ? quote.currentPrice > kline.indicators.ma5 : false;
              const aboveMa10 = kline ? quote.currentPrice > kline.indicators.ma10 : false;
              const ma5 = kline?.indicators.ma5 || 0;
              const ma10 = kline?.indicators.ma10 || 0;
              const ma20 = kline?.indicators.ma20 || 0;
              const macd = kline?.indicators.macd || 0;
              const kdjK = kline?.indicators.kdjK || 0;
              const kdjJ = kline?.indicators.kdjJ || 0;
              const rsi6 = kline?.indicators.rsi6 || 0;
              const trend = kline?.trend || 'flat';
              const trendColor = trend === 'up' ? 'var(--up)' : trend === 'down' ? 'var(--down)' : 'var(--flat)';
              const trendLabel = trend === 'up' ? '↑ 多头' : trend === 'down' ? '↓ 空头' : '→ 震荡';
              const volRatio = kline?.volumeRatio || 0;
              const volRatioColor = volRatio >= 1.5 ? 'var(--up)' : volRatio >= 1 ? 'var(--warn)' : 'var(--flat)';

              return (
                <TableRow key={cfg.id} className="border-border">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{cfg.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground tnum">{cfg.market}{cfg.code}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isCore ? (
                      <Badge className="bg-primary/15 text-primary hover:bg-primary/20">核心底仓</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-info">卫星</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono text-sm tnum">{userPos.shares}</div>
                    {userPos.targetShares && (
                      <div className="text-[10px] text-muted-foreground tnum">/ {userPos.targetShares}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono text-sm tnum" style={{ color: quote.change >= 0 ? 'var(--up)' : 'var(--down)' }}>
                      {fmt(quote.currentPrice)}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground tnum">
                      昨收 {fmt(quote.prevClose)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono text-sm text-muted-foreground tnum">{fmt(userPos.costPrice)}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono text-sm tnum" style={{ color: quote.pnl >= 0 ? 'var(--up)' : 'var(--down)' }}>
                      {quote.pnl >= 0 ? '+' : ''}{fmtMoney(quote.pnl)}
                    </div>
                    <div className="font-mono text-[10px] tnum" style={{ color: quote.pnl >= 0 ? 'var(--up)' : 'var(--down)' }}>
                      {fmtPct(quote.pnlPercent)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <ChangeCell value={quote.changePercent} />
                    <div className="font-mono text-[10px] text-muted-foreground tnum">
                      高 {fmt(quote.high)} / 低 {fmt(quote.low)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm tnum" style={{ color: volRatioColor }}>
                      {volRatio.toFixed(2)}
                    </span>
                    <div className="font-mono text-[10px] text-muted-foreground tnum">
                      量 {(quote.volume / 10000).toFixed(0)}万手
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-center gap-0.5 text-[10px]">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">MA5</span>
                              <span className="font-mono tnum" style={{ color: aboveMa5 ? 'var(--up)' : 'var(--down)' }}>
                                {aboveMa5 ? '↑' : '↓'}{fmt(ma5)}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div>5日均线: {fmt(ma5)}</div>
                            <div>10日均线: {fmt(ma10)}</div>
                            <div>20日均线: {fmt(ma20)}</div>
                            <div>MACD柱: {macd >= 0 ? '+' : ''}{fmt(macd, 4)}</div>
                            <div>KDJ: K={kdjK.toFixed(1)} J={kdjJ.toFixed(1)}</div>
                            <div>RSI6: {rsi6.toFixed(1)}</div>
                            <div className="mt-1 border-t border-border pt-1" style={{ color: trendColor }}>
                              趋势: {trendLabel}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">MA10</span>
                        <span className="font-mono tnum" style={{ color: aboveMa10 ? 'var(--up)' : 'var(--down)' }}>
                          {aboveMa10 ? '↑' : '↓'}{fmt(ma10)}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono text-sm tnum">¥{fmtMoney(quote.marketValue)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-center gap-0.5 text-[10px] text-muted-foreground">
                      <span>
                        加仓 <span className="font-mono text-info tnum">{userPos.addLine1}%/{userPos.addLine2}%</span>
                      </span>
                      <span>
                        止盈 <span className="font-mono text-warn tnum">+{userPos.takeProfitLine}%</span>
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// 沪深300补仓进度卡
export function Csi300ProgressCard() {
  const { config } = useUserConfig();
  const watchlist = config.watchlist || DEFAULT_WATCHLIST;
  const { data } = useQuotes(watchlist);
  const csi300 = data?.quotes.find((q) => q.id === 'csi300');
  const cfg = SECURITY_BY_ID['csi300'];
  const userPos = config.positions['csi300'];

  if (!csi300 || !userPos || !cfg) {
    return null; // 沪深300不在 watchlist 时不显示
  }

  const current = userPos.shares;
  const target = userPos.targetShares || 1000;
  const pct = Math.min(100, (current / target) * 100);
  const remaining = Math.max(0, target - current);
  const remainingAmount = remaining * csi300.currentPrice;
  const weeklyInvest = config.weeklyInvest;
  const weeksNeeded = weeklyInvest > 0 ? Math.ceil(remainingAmount / weeklyInvest) : 0;
  const marketValue = current * csi300.currentPrice;
  const pnl = current * (csi300.currentPrice - userPos.costPrice);
  const pnlPercent = userPos.costPrice > 0 ? ((csi300.currentPrice - userPos.costPrice) / userPos.costPrice) * 100 : 0;

  return (
    <div className="rounded-lg border border-primary/30 bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">沪深300ETF 核心底仓补仓进度</h3>
          <span className="font-mono text-xs text-muted-foreground tnum">
            现价 {fmt(csi300.currentPrice)}
          </span>
          <ChangeCell value={csi300.changePercent} />
        </div>
        <Badge className="bg-primary/15 text-primary hover:bg-primary/20">3个月目标</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="当前持仓" value={`${current}`} suffix="股" />
        <Stat label="目标持仓" value={`${target}`} suffix="股" />
        <Stat label="待补仓" value={`${remaining}`} suffix="股" color="var(--warn)" />
        <Stat label="待补金额" value={`¥${fmtMoney(remainingAmount)}`} color="var(--warn)" />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">补仓进度</span>
          <span className="font-mono tnum text-primary">{pct.toFixed(1)}%</span>
        </div>
        <Progress value={pct} className="h-2.5 bg-secondary" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>📅 周期：3个月</span>
        <span>💰 周定投：¥{weeklyInvest}/周</span>
        <span>⏱ 预计还需：<span className="text-foreground tnum">{weeksNeeded}</span> 周</span>
        <span>📊 现市值：<span className="text-foreground tnum">¥{fmtMoney(marketValue)}</span></span>
        <span>📈 持仓盈亏：<span style={{ color: pnl >= 0 ? 'var(--up)' : 'var(--down)' }} className="tnum">
          {pnl >= 0 ? '+' : ''}{fmtMoney(pnl)} ({fmtPct(pnlPercent)})
        </span></span>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix, color }: { label: string; value: string; suffix?: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-base font-semibold tnum" style={{ color: color || 'var(--foreground)' }}>
        {value}
        {suffix && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
