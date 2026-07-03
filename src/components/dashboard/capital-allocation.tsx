'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { PieChart as PieIcon, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useQuotes } from '@/lib/use-market-data';
import { useUserConfig } from '@/lib/use-user-config';
import { SECURITY_BY_ID, DEFAULT_WATCHLIST } from '@/lib/security-library';

function fmtMoney(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CapitalAllocationPanel() {
  const { config } = useUserConfig();
  const watchlist = config.watchlist || DEFAULT_WATCHLIST;
  const { data, isLoading } = useQuotes(watchlist);
  const [activeIdx, setActiveIdx] = useState<number | undefined>(undefined);

  const allocation = useMemo(() => {
    if (!data) return [];
    // 基于用户配置计算持仓市值
    let coreValue = 0;
    let satelliteValue = 0;
    for (const q of data.quotes) {
      const pos = config.positions[q.id];
      if (!pos) continue;
      const value = pos.shares * q.currentPrice;
      if (q.id === 'csi300') {
        coreValue += value;
      } else {
        satelliteValue += value;
      }
    }
    const cash = config.cashReserve;
    const total = coreValue + satelliteValue + cash;
    if (total <= 0) return [];
    return [
      {
        category: '核心底仓',
        amount: Number(coreValue.toFixed(2)),
        percentage: Number(((coreValue / total) * 100).toFixed(1)),
        color: 'var(--chart-1)',
        description: '沪深300ETF 目标1000股 / 占比≥40%',
      },
      {
        category: '卫星仓位',
        amount: Number(satelliteValue.toFixed(2)),
        percentage: Number(((satelliteValue / total) * 100).toFixed(1)),
        color: 'var(--chart-4)',
        description: 'AI / 芯片 / 电池 / 机器人 攒筹码为主',
      },
      {
        category: '备用金',
        amount: cash,
        percentage: Number(((cash / total) * 100).toFixed(1)),
        color: 'var(--chart-3)',
        description: `账户预留 ¥${fmtMoney(cash)}，确保加仓/定投有资金`,
      },
    ];
  }, [data, config]);

  if (isLoading || !data) {
    return (
      <div className="flex h-48 items-center justify-center gap-2 rounded-lg border border-border bg-card text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">加载资金分配...</span>
      </div>
    );
  }

  if (allocation.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
        <span className="text-sm">暂无持仓数据，请在参数设置中配置持仓数量</span>
      </div>
    );
  }

  const total = allocation.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieIcon className="h-4 w-4 text-info" />
          <h3 className="text-sm font-semibold">资金分配</h3>
        </div>
        <span className="text-[10px] text-muted-foreground">基于真实持仓市值</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="relative h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={allocation}
                dataKey="amount"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                activeIndex={activeIdx}
                activeShape={renderActiveShape}
                onMouseEnter={(_, i) => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(undefined)}
              >
                {allocation.map((d, i) => (
                  <Cell key={i} fill={d.color} stroke="var(--card)" strokeWidth={1.5} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[10px] text-muted-foreground">总资产</div>
            <div className="font-mono text-sm font-semibold tnum">¥{fmtMoney(total)}</div>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-2.5">
          {allocation.map((d, i) => (
            <div
              key={i}
              className="cursor-pointer rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-background/40"
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(undefined)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                  <span className="text-xs font-medium">{d.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs tnum text-muted-foreground">¥{fmtMoney(d.amount)}</span>
                  <span className="font-mono text-sm font-semibold tnum" style={{ color: d.color }}>
                    {d.percentage}%
                  </span>
                </div>
              </div>
              <div className="mt-0.5 pl-4.5 text-[10px] text-muted-foreground">{d.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}
