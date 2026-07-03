'use client';

import { useEffect, useState } from 'react';
import { Activity, Radio, ShieldCheck, TrendingUp } from 'lucide-react';
import { NotificationCenter } from '@/components/dashboard/notification-center';
import { SettingsPanel } from '@/components/dashboard/settings-panel';

export function DashboardHeader({ alertCount = 0 }: { alertCount?: number }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    const initial = setTimeout(() => setNow(new Date()), 0);
    return () => {
      clearInterval(t);
      clearTimeout(initial);
    };
  }, []);

  const timeStr = now
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    : '----/--/-- --:--:--';

  const hourMin = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const day = now ? now.getDay() : 0;
  let sessionLabel = '休市';
  let sessionColor = 'var(--flat)';
  if (day >= 1 && day <= 5) {
    if (hourMin >= 570 && hourMin < 690) {
      sessionLabel = '早盘';
      sessionColor = 'var(--up)';
    } else if (hourMin >= 690 && hourMin < 780) {
      sessionLabel = '午休';
      sessionColor = 'var(--flat)';
    } else if (hourMin >= 780 && hourMin < 890) {
      sessionLabel = '午盘';
      sessionColor = 'var(--up)';
    } else if (hourMin >= 890 && hourMin < 900) {
      sessionLabel = '收盘前';
      sessionColor = 'var(--warn)';
    } else if (hourMin >= 900 && hourMin < 990) {
      sessionLabel = '盘后';
      sessionColor = 'var(--info)';
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-semibold leading-tight text-foreground lg:text-lg">
              市场数据监测系统
            </h1>
            <p className="text-[10px] text-muted-foreground lg:text-xs">
              基于多维信息与自动化监测 · v4.0 · 真实数据
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <div
            className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5"
            style={{ color: sessionColor }}
          >
            <Radio className="h-3.5 w-3.5 pulse-warn" />
            <span className="text-xs font-medium tnum">{sessionLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-info" />
            <span className="tnum">5/5 ETF 实时监测</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-down" />
            <span>ARIMA+LSTM · SSE 推送</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="font-mono text-xs text-muted-foreground tnum lg:text-sm">{timeStr}</div>
            <div className="text-[10px] text-muted-foreground/70">UTC+8 · Asia/Shanghai</div>
          </div>
          {/* 参数设置 */}
          <SettingsPanel />
          {/* 微信通知中心 */}
          <NotificationCenter />
        </div>
      </div>
    </header>
  );
}
