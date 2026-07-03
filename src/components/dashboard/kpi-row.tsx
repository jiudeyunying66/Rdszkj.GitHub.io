'use client';

import { Wallet, TrendingUp, TrendingDown, PieChart, Banknote, AlertTriangle, Loader2, Wifi, WifiOff, Calculator } from 'lucide-react';
import { useQuotes } from '@/lib/use-market-data';
import { useUserConfig } from '@/lib/use-user-config';

function formatMoney(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function KpiRow() {
  const { config, loaded } = useUserConfig();
  const watchlist = config.watchlist;
  const { data, isLoading, isError, isFetching } = useQuotes(watchlist);

  if (isLoading || !loaded) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">正在加载用户配置与行情数据...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-up/30 bg-up/5 p-8 text-up">
        <WifiOff className="h-4 w-4" />
        <span className="text-sm">行情接口异常，请稍后重试</span>
      </div>
    );
  }

  // ===== 基于用户配置精确计算 =====
  // 1. 持仓市值 = Σ(持仓数 × 现价)
  const totalMarketValue = data.quotes.reduce((s, q) => {
    const userPos = config.positions[q.id];
    return s + (userPos ? userPos.shares * q.currentPrice : 0);
  }, 0);

  // 2. 持仓成本 = Σ(持仓数 × 成本价) —— 这是初始投入资金
  const totalCost = data.quotes.reduce((s, q) => {
    const userPos = config.positions[q.id];
    return s + (userPos ? userPos.costPrice * userPos.shares : 0);
  }, 0);

  // 3. 账户现金（备用金）—— 用户配置的预留现金
  const accountCash = config.cashReserve;

  // 4. 总资产 = 持仓市值 + 账户现金
  const totalAssets = totalMarketValue + accountCash;

  // 5. 累计盈亏 = 持仓市值 - 持仓成本（与账户现金无关）
  const totalPnl = totalMarketValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // 6. 今日盈亏 = Σ(今日涨跌额 × 持仓数)
  const todayPnl = data.quotes.reduce((s, q) => {
    const userPos = config.positions[q.id];
    return s + (userPos ? q.change * userPos.shares : 0);
  }, 0);

  // 7. 今日盈亏百分比 = 今日盈亏 / 昨日总市值
  const totalPrevValue = data.quotes.reduce((s, q) => {
    const userPos = config.positions[q.id];
    return s + (userPos ? q.prevClose * userPos.shares : 0);
  }, 0);
  const todayPnlPercent = totalPrevValue > 0 ? (todayPnl / totalPrevValue) * 100 : 0;

  // 8. 仓位占比 = 持仓市值 / 总资产
  const positionRatio = totalAssets > 0 ? (totalMarketValue / totalAssets) * 100 : 0;

  // 9. 今日异常预警数
  const todayAlerts = data.quotes.filter((q) => {
    const userPos = config.positions[q.id];
    return userPos && Math.abs(q.changePercent) >= 2;
  }).length;

  const pnlPositive = totalPnl >= 0;
  const todayPositive = todayPnl >= 0;

  return (
    <>
      {/* 数据源状态 */}
      <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        {isFetching ? (
          <><Loader2 className="h-3 w-3 animate-spin text-info" /> 更新中</>
        ) : (
          <><Wifi className="h-3 w-3 text-down" /> 实时</>
        )}
        <span>·</span>
        <span>数据源：腾讯财经 · 5s 刷新</span>
        <span>·</span>
        <span className="font-mono tnum">{data.timestamp.slice(11, 19)}</span>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {/* 总资产 = 持仓市值 + 账户现金 */}
        <KpiCard
          label="总资产"
          value={`¥${formatMoney(totalAssets)}`}
          sub={`持仓 ¥${formatMoney(totalMarketValue)} + 现金 ¥${formatMoney(accountCash)}`}
          icon={<Wallet className="h-4 w-4" />}
          color="var(--foreground)"
        />
        {/* 累计盈亏 = 持仓市值 - 持仓成本 */}
        <KpiCard
          label="累计盈亏"
          value={`${pnlPositive ? '+' : ''}${formatMoney(totalPnl)}`}
          sub={`基于成本 ¥${formatMoney(totalCost)} (${pnlPositive ? '+' : ''}${totalPnlPercent.toFixed(3)}%)`}
          icon={pnlPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          color={pnlPositive ? 'var(--up)' : 'var(--down)'}
        />
        {/* 今日盈亏 */}
        <KpiCard
          label="今日盈亏"
          value={`${todayPositive ? '+' : ''}${formatMoney(todayPnl)}`}
          sub={`基于昨收 ¥${formatMoney(totalPrevValue)} (${todayPositive ? '+' : ''}${todayPnlPercent.toFixed(3)}%)`}
          icon={todayPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          color={todayPositive ? 'var(--up)' : 'var(--down)'}
        />
        {/* 仓位占比 */}
        <KpiCard
          label="仓位占比"
          value={`${positionRatio.toFixed(1)}%`}
          sub={`现金占比 ${(100 - positionRatio).toFixed(1)}%`}
          icon={<PieChart className="h-4 w-4" />}
          color="var(--info)"
        />
        {/* 账户现金 */}
        <KpiCard
          label="账户现金"
          value={`¥${formatMoney(accountCash)}`}
          sub="可在参数设置中调整"
          icon={<Banknote className="h-4 w-4" />}
          color="var(--warn)"
        />
        {/* 今日异常 */}
        <KpiCard
          label="今日异常"
          value={`${todayAlerts}`}
          sub={`|涨跌|≥2% 触发 ${todayAlerts} 只`}
          icon={<AlertTriangle className="h-4 w-4" />}
          color={todayAlerts > 0 ? 'var(--up)' : 'var(--flat)'}
        />
      </div>

      {/* 计算公式说明（透明可审计） */}
      <details className="rounded-md border border-border/60 bg-card/40 p-2 text-[10px] text-muted-foreground">
        <summary className="flex cursor-pointer items-center gap-1.5">
          <Calculator className="h-3 w-3" />
          <span>计算公式（点击展开验证）</span>
        </summary>
        <div className="mt-2 space-y-1 font-mono">
          <div>• 持仓市值 = Σ(持仓数 × 现价) = ¥{formatMoney(totalMarketValue)}</div>
          <div>• 持仓成本 = Σ(持仓数 × 成本价) = ¥{formatMoney(totalCost)}</div>
          <div>• 账户现金 = 用户配置的备用金 = ¥{formatMoney(accountCash)}</div>
          <div>• <span className="text-foreground">总资产 = 持仓市值 + 账户现金 = ¥{formatMoney(totalMarketValue)} + ¥{formatMoney(accountCash)} = ¥{formatMoney(totalAssets)}</span></div>
          <div>• <span className="text-foreground">累计盈亏 = 持仓市值 - 持仓成本 = ¥{formatMoney(totalMarketValue)} - ¥{formatMoney(totalCost)} = {pnlPositive ? '+' : ''}¥{formatMoney(totalPnl)}</span></div>
          <div>• 今日盈亏 = Σ(今日涨跌额 × 持仓数) = {todayPositive ? '+' : ''}¥{formatMoney(todayPnl)}</div>
        </div>
      </details>
    </>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-border/80 lg:p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="mt-2 font-mono text-xl font-semibold tnum lg:text-2xl" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground tnum lg:text-xs">{sub}</div>
    </div>
  );
}
