'use client';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import {
  Clock,
  AlertTriangle,
  Info,
  AlertOctagon,
  CheckCircle2,
  Hourglass,
  Radio,
  Loader2,
} from 'lucide-react';
import { useMemo } from 'react';
import { useQuotes, useKlines, useNews } from '@/lib/use-market-data';
import { ETF_CONFIGS } from '@/lib/etf-config';
import { useUserConfig } from '@/lib/use-user-config';

interface LiveEvent {
  id: string;
  triggerTime: string;
  triggerPoint: string;
  level: 'info' | 'warn' | 'critical';
  title: string;
  content: string;
  relatedEtfs?: string[];
  suggestions?: string[];
}

function levelStyle(l: 'info' | 'warn' | 'critical') {
  if (l === 'critical') return { color: 'var(--up)', border: 'var(--up)', bg: 'rgba(239,68,68,0.06)' };
  if (l === 'warn') return { color: 'var(--warn)', border: 'var(--warn)', bg: 'rgba(245,158,11,0.06)' };
  return { color: 'var(--info)', border: 'var(--info)', bg: 'rgba(56,189,248,0.06)' };
}

// 基于真实数据生成盘中异常事件
function useLiveEvents(): LiveEvent[] {
  const { data: quoteData } = useQuotes();
  const { data: klineData } = useKlines();
  const { data: newsData } = useNews();
  const { config } = useUserConfig();

  return useMemo(() => {
    if (!quoteData) return [];
    const events: LiveEvent[] = [];

    // 辅助函数：从用户配置获取加仓线/止盈线
    const getLines = (id: string) => {
      const pos = config.positions[id];
      return {
        addLine1: pos?.addLine1 ?? -3,
        addLine2: pos?.addLine2 ?? -5,
        takeProfitLine: pos?.takeProfitLine ?? 10,
      };
    };

    // 1. 市场异常事件（涨跌幅超阈值）
    for (const q of quoteData.quotes) {
      const cfg = ETF_CONFIGS.find((e) => e.id === q.id) || { id: q.id, name: q.name || q.id, code: q.code || '' } as any;
      const lines = getLines(q.id);
      const absChange = Math.abs(q.changePercent);
      if (absChange >= 4) {
        // 重大异常
        events.push({
          id: `mkt-${q.id}-${q.timestamp}`,
          triggerTime: q.timestamp.slice(8, 10) + ':' + q.timestamp.slice(10, 12),
          triggerPoint: '盘中实时监测',
          level: 'critical',
          title: `${cfg.name} ${q.changePercent >= 0 ? '涨' : '跌'} ${absChange.toFixed(2)}%`,
          content: `${cfg.name}(${cfg.code}) 现价 ${q.currentPrice.toFixed(3)} 元，${q.changePercent >= 0 ? '涨' : '跌'}幅 ${absChange.toFixed(2)}%，成交量 ${(q.volume / 10000).toFixed(0)} 万手，振幅 ${q.amplitude.toFixed(2)}%。已突破 4% 重大波动阈值。`,
          relatedEtfs: [q.id],
          suggestions: q.changePercent >= 0
            ? [`涨幅接近 5%，关注止盈线 +${lines.takeProfitLine}%`, `当前持仓盈亏 ${q.pnl >= 0 ? '+' : ''}${q.pnl.toFixed(2)} 元 (${q.pnlPercent.toFixed(2)}%)`]
            : [`跌幅较大，关注一级加仓线 ${lines.addLine1}%`, `若持续下跌至 ${lines.addLine2}%，触发二级加仓`],
        });
      } else if (absChange >= 2) {
        events.push({
          id: `mkt-${q.id}-${q.timestamp}`,
          triggerTime: q.timestamp.slice(8, 10) + ':' + q.timestamp.slice(10, 12),
          triggerPoint: '盘中实时监测',
          level: 'warn',
          title: `${cfg.name} ${q.changePercent >= 0 ? '涨' : '跌'} ${absChange.toFixed(2)}%`,
          content: `${cfg.name}(${cfg.code}) 现价 ${q.currentPrice.toFixed(3)} 元，${q.changePercent >= 0 ? '涨' : '跌'}幅 ${absChange.toFixed(2)}%，成交量 ${(q.volume / 10000).toFixed(0)} 万手。`,
          relatedEtfs: [q.id],
          suggestions: [`关注波动，${q.changePercent >= 0 ? '止盈' : '加仓'}线 ${q.changePercent >= 0 ? '+' + lines.takeProfitLine : lines.addLine1}%`],
        });
      }
    }

    // 2. 技术指标信号
    if (klineData) {
      for (const k of klineData.data) {
        const cfg = ETF_CONFIGS.find((e) => e.id === k.id) || { id: k.id, name: k.name || k.id, code: '' } as any;
        const lines = getLines(k.id);
        // KDJ 超买/超卖
        if (k.indicators.kdjJ > 100) {
          events.push({
            id: `tech-overbought-${k.id}`,
            triggerTime: '盘中',
            triggerPoint: '技术指标监测',
            level: 'warn',
            title: `${cfg.name} KDJ.J=${k.indicators.kdjJ.toFixed(1)} 超买`,
            content: `${cfg.name} KDJ 指标 J 值为 ${k.indicators.kdjJ.toFixed(1)}，超过 100 进入超买区域，短期有回调风险。RSI6=${k.indicators.rsi6.toFixed(1)}。`,
            relatedEtfs: [k.id],
            suggestions: [`关注止盈机会`, `若 J 值回落跌破 100，可能短期见顶`],
          });
        } else if (k.indicators.kdjJ < 0) {
          events.push({
            id: `tech-oversold-${k.id}`,
            triggerTime: '盘中',
            triggerPoint: '技术指标监测',
            level: 'info',
            title: `${cfg.name} KDJ.J=${k.indicators.kdjJ.toFixed(1)} 超卖`,
            content: `${cfg.name} KDJ 指标 J 值为 ${k.indicators.kdjJ.toFixed(1)}，低于 0 进入超卖区域，短期可能反弹。RSI6=${k.indicators.rsi6.toFixed(1)}。`,
            relatedEtfs: [k.id],
            suggestions: [`关注一级加仓线 ${lines.addLine1}%`, `超卖反弹可分批建仓`],
          });
        }
        // MACD 死叉/金叉
        if (k.indicators.macd < 0 && k.indicators.dif < k.indicators.dea) {
          events.push({
            id: `tech-macd-down-${k.id}`,
            triggerTime: '盘中',
            triggerPoint: '技术指标监测',
            level: 'info',
            title: `${cfg.name} MACD 空头排列`,
            content: `${cfg.name} MACD 柱 ${k.indicators.macd.toFixed(4)}，DIF(${k.indicators.dif.toFixed(4)}) < DEA(${k.indicators.dea.toFixed(4)})，空头排列。`,
            relatedEtfs: [k.id],
          });
        }
      }
    }

    // 3. 高影响宏观新闻
    if (newsData) {
      const highNews = newsData.data
        .filter((n) => n.impact === 'high' && n.relatedEtfs.length > 0)
        .slice(0, 5);
      for (const n of highNews) {
        events.push({
          id: `news-${n.id}`,
          triggerTime: n.date.slice(11, 16) || '盘中',
          triggerPoint: '宏观信息监测',
          level: n.sentiment === 'negative' ? 'critical' : n.sentiment === 'positive' ? 'info' : 'warn',
          title: n.title,
          content: n.content.slice(0, 200),
          relatedEtfs: n.relatedEtfs,
          suggestions: n.sentiment === 'negative'
            ? ['关注相关ETF风险', '若持有可考虑减仓或对冲']
            : n.sentiment === 'positive'
            ? ['关注相关ETF加仓机会', '结合技术面判断入场点']
            : ['持续关注事件进展'],
        });
      }
    }

    // 按时间倒序
    return events.sort((a, b) => (b.triggerTime > a.triggerTime ? 1 : -1));
  }, [quoteData, klineData, newsData, config]);
}

export function MonitoringTimeline() {
  const { data: quoteData, isLoading } = useQuotes();
  const events = useLiveEvents();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 rounded-lg border border-border bg-card text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">正在加载实时监测数据...</span>
      </div>
    );
  }

  // 监测点状态（基于当前时间）
  const now = new Date();
  const hourMin = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay();
  const isTradingDay = day >= 1 && day <= 5;
  const isTradingTime = isTradingDay && ((hourMin >= 570 && hourMin < 690) || (hourMin >= 780 && hourMin < 900));

  const monitorPoints = [
    { time: '10:30', desc: '开盘后监测', done: hourMin >= 630, active: hourMin >= 570 && hourMin < 630 },
    { time: '14:00', desc: '午盘后监测', done: hourMin >= 840, active: hourMin >= 780 && hourMin < 840 },
    { time: '14:30', desc: '收盘前监测', done: hourMin >= 870, active: hourMin >= 840 && hourMin < 870 },
    { time: '14:50', desc: '收盘前总结', done: hourMin >= 890, active: hourMin >= 870 && hourMin < 890 },
    { time: '16:30', desc: '盘后复盘', done: hourMin >= 990, active: hourMin >= 900 && hourMin < 990 },
    { time: '周末 10:00/16:00', desc: '非工作日宏观', done: false, active: !isTradingDay },
  ];

  return (
    <div className="space-y-4">
      {/* 实时状态条 */}
      {quoteData && (
        <div className="rounded-lg border border-info/30 bg-info/5 p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span className="flex items-center gap-1.5 text-foreground">
              <Radio className={`h-3.5 w-3.5 ${isTradingTime ? 'text-up pulse-warn' : 'text-muted-foreground'}`} />
              <span className="font-medium">{isTradingTime ? '盘中实时监测中' : isTradingDay ? '盘后/盘前' : '非交易日'}</span>
            </span>
            <span className="text-muted-foreground">
              最新数据时间：<span className="font-mono text-foreground tnum">{quoteData.timestamp.slice(11, 19)}</span>
            </span>
            <span className="text-muted-foreground">
              今日异常事件：<span className="font-mono text-up tnum">{events.length}</span> 条
            </span>
            <Badge variant="outline" className="border-info/40 text-info">
              数据源：腾讯财经 + 东方财富
            </Badge>
          </div>
        </div>
      )}

      {/* 监测点时间轴 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-info" />
          <h3 className="text-sm font-semibold">今日监测点时间轴</h3>
        </div>
        <div className="flex overflow-x-auto pb-2 no-scrollbar">
          {monitorPoints.map((p, i) => (
            <div key={i} className="flex items-center">
              <div className="flex min-w-[120px] flex-col items-center gap-1.5 px-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                    p.done
                      ? 'border-down bg-down/15 text-down'
                      : p.active
                      ? 'border-warn bg-warn/15 text-warn pulse-warn'
                      : 'border-border bg-secondary text-muted-foreground'
                  }`}
                >
                  {p.done ? <CheckCircle2 className="h-4 w-4" /> : p.active ? <Radio className="h-4 w-4" /> : <Hourglass className="h-4 w-4" />}
                </div>
                <div className="text-center">
                  <div className={`font-mono text-xs tnum ${p.active || p.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {p.time}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{p.desc}</div>
                </div>
              </div>
              {i < monitorPoints.length - 1 && (
                <div className={`h-0.5 w-8 ${p.done ? 'bg-down/40' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 事件流 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warn" />
            <h3 className="text-sm font-semibold">实时监测事件流</h3>
            <Badge variant="secondary" className="text-[10px]">{events.length} 条</Badge>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-up" /> 重大</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warn" /> 警告</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-info" /> 信息</span>
          </div>
        </div>

        <ScrollArea className="h-[560px] pr-3">
          <div className="space-y-3">
            {events.length === 0 && (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                <CheckCircle2 className="mr-2 h-4 w-4 text-down" />
                暂无异常事件，市场运行平稳
              </div>
            )}
            {events.map((e) => {
              const ls = levelStyle(e.level);
              return (
                <div
                  key={e.id}
                  className="relative rounded-md border border-border p-3"
                  style={{ background: ls.bg, borderColor: `${ls.border}30` }}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-7 min-w-[64px] items-center justify-center rounded-md font-mono text-xs font-semibold tnum"
                        style={{ background: `${ls.border}20`, color: ls.color }}
                      >
                        {e.triggerTime}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Radio className="h-3 w-3" />
                        {e.triggerPoint}
                      </div>
                    </div>
                    <Badge variant="outline" className="gap-1 border-warn/40 text-warn">
                      <Radio className="h-3 w-3 pulse-warn" /> 实时
                    </Badge>
                  </div>

                  <div className="mt-2 flex items-start gap-2">
                    {e.level === 'critical' && <AlertOctagon className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: ls.color }} />}
                    {e.level === 'warn' && <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: ls.color }} />}
                    {e.level === 'info' && <Info className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: ls.color }} />}
                    <h4 className="text-sm font-medium leading-snug">{e.title}</h4>
                  </div>

                  <p className="mt-1 pl-6 text-xs leading-relaxed text-muted-foreground">{e.content}</p>

                  {e.relatedEtfs && e.relatedEtfs.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                      <span className="text-[10px] text-muted-foreground">关联：</span>
                      {e.relatedEtfs.map((eid) => (
                        <Badge key={eid} variant="secondary" className="text-[10px]">
                          {ETF_CONFIGS.find((x) => x.id === eid)?.name || eid}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {e.suggestions && e.suggestions.length > 0 && (
                    <div className="mt-2 rounded-md border border-border/60 bg-card/60 p-2 pl-6">
                      <div className="mb-1 text-[10px] font-medium text-warn">操作建议（仅分析，不执行）</div>
                      <ul className="space-y-0.5">
                        {e.suggestions.map((s, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/90">
                            <span className="mt-0.5 text-warn">→</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
