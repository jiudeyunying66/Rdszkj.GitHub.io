'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  AlertTriangle,
  TrendingDown,
  Flame,
  CheckCircle2,
  Circle,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import { useMemo } from 'react';
import { useNews } from '@/lib/use-market-data';

interface Rule {
  id: string;
  macroType: string;
  trigger: string;
  adjustment: string;
  example: string;
  icon: string;
  // 动态激活状态
  isActive: boolean;
  activeReason?: string;
  matchedNews?: { title: string; sentiment: string }[];
}

const iconMap: Record<string, React.ReactNode> = {
  'trending-up': <TrendingUp className="h-5 w-5" />,
  'alert-triangle': <AlertTriangle className="h-5 w-5" />,
  'trending-down': <TrendingDown className="h-5 w-5" />,
  flame: <Flame className="h-5 w-5" />,
};

// 关键词匹配规则
const RULE_MATCHERS = [
  {
    id: 'r1',
    macroType: '政策利好',
    trigger: '产业扶持政策（如"国家投入1000亿支持AI"）',
    adjustment: '提高AI ETF加仓线（-3%→-2%）、止盈线（8%→10%）',
    example: '若AI ETF跌2%，触发一级加仓',
    icon: 'trending-up',
    keywords: {
      positive: ['扶持', '支持', '投入', '补贴', '减税', '政策利好', '产业政策', '发展规划', '战略'],
      etfs: ['ai', 'chip'],
    },
  },
  {
    id: 'r2',
    macroType: '地缘紧张',
    trigger: '重大地缘冲突（如"某国限制芯片出口"）',
    adjustment: '暂停所有ETF加仓、提前止盈（如芯片ETF涨5%卖出20%）',
    example: '避免恐慌中买入',
    icon: 'alert-triangle',
    keywords: {
      negative: ['管制', '制裁', '限制', '出口管制', '禁令', '地缘', '冲突', '贸易战'],
      etfs: ['chip'],
    },
  },
  {
    id: 'r3',
    macroType: '经济数据不及预期',
    trigger: 'PMI<50（经济下行）',
    adjustment: '降低定投金额（沪深300从500→300元/周）、增加备用金（10%→20%）',
    example: '减少资金投入',
    icon: 'trending-down',
    keywords: {
      negative: ['PMI', '不及预期', '下滑', '衰退', '下行', '荣枯线', 'GDP', 'CPI', '疲软'],
      etfs: ['csi300'],
    },
  },
  {
    id: 'r4',
    macroType: '市场情绪过热',
    trigger: '社交媒体情绪指数>80（过热）',
    adjustment: '提高AI ETF止盈比例（20%→30%）、暂停加仓',
    example: '锁定利润，避免高位买入',
    icon: 'flame',
    keywords: {
      positive: ['必涨', '暴涨', '牛市', '创新高', '历史新高', '热血', '疯狂', '跑步入场'],
      etfs: ['ai'],
    },
  },
];

export function StrategyRulesPanel() {
  const { data: newsData, isLoading } = useNews();

  const rules: Rule[] = useMemo(() => {
    if (!newsData) {
      return RULE_MATCHERS.map((r) => ({ ...r, isActive: false }));
    }
    const allNews = newsData.data;
    // 只看最近 7 天的新闻
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const recentNews = allNews.filter((n) => new Date(n.date) >= cutoff);

    return RULE_MATCHERS.map((r) => {
      const matched: { title: string; sentiment: string; date: string }[] = [];
      for (const n of recentNews) {
        const text = (n.title + ' ' + n.content).toLowerCase();
        const posMatch = (r.keywords.positive || []).some((k) => text.includes(k.toLowerCase()));
        const negMatch = (r.keywords.negative || []).some((k) => text.includes(k.toLowerCase()));
        if ((posMatch && n.sentiment === 'positive') || (negMatch && n.sentiment === 'negative')) {
          matched.push({ title: n.title, sentiment: n.sentiment, date: n.date });
        }
      }
      const isActive = matched.length > 0;
      return {
        id: r.id,
        macroType: r.macroType,
        trigger: r.trigger,
        adjustment: r.adjustment,
        example: r.example,
        icon: r.icon,
        isActive,
        activeReason: isActive
          ? `最近7天检测到 ${matched.length} 条相关新闻：${matched[0].title.slice(0, 40)}${matched[0].title.length > 40 ? '...' : ''}`
          : '最近7天未检测到相关新闻',
        matchedNews: matched.slice(0, 3),
      } as Rule;
    });
  }, [newsData]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 rounded-lg border border-border bg-card text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">正在分析真实新闻判断规则激活状态...</span>
      </div>
    );
  }

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div className="space-y-4">
      {/* 概述 */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-medium">策略动态调整规则引擎</span>
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3 text-down" /> {activeCount} 条激活
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Circle className="h-3 w-3" /> {rules.length - activeCount} 条待命
          </Badge>
          <span className="text-muted-foreground">
            基于真实财经新闻（最近7天）自动判断规则激活状态，调整加仓线、止盈线、定投金额等参数
          </span>
        </div>
      </div>

      {/* 规则卡片 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rules.map((r) => (
          <Card
            key={r.id}
            className={`border-border bg-card transition-colors ${
              r.isActive ? 'border-primary/40 ring-1 ring-primary/20' : 'opacity-75'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-md ${
                      r.isActive ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {iconMap[r.icon]}
                  </div>
                  <div>
                    <CardTitle className="text-sm">{r.macroType}</CardTitle>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      规则 ID: {r.id.toUpperCase()}
                    </div>
                  </div>
                </div>
                {r.isActive ? (
                  <Badge className="gap-1 bg-up/15 text-up hover:bg-up/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-up pulse-warn" /> 已激活
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <Circle className="h-3 w-3" /> 待命
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">触发条件</div>
                <div className="text-xs leading-relaxed text-foreground/90">{r.trigger}</div>
              </div>

              <div className="rounded-md border border-border/60 bg-background/40 p-2">
                <div className="mb-0.5 text-[10px] font-medium text-info">策略调整</div>
                <div className="text-xs leading-relaxed text-foreground/90">{r.adjustment}</div>
              </div>

              <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Lightbulb className="mt-0.5 h-3 w-3 flex-shrink-0 text-warn" />
                <span><span className="font-medium">示例：</span>{r.example}</span>
              </div>

              {r.isActive && r.activeReason && (
                <div className="rounded-md border border-up/30 bg-up/5 p-2">
                  <div className="mb-0.5 text-[10px] font-medium text-up">激活原因（基于真实新闻）</div>
                  <div className="text-xs leading-relaxed text-foreground/90">{r.activeReason}</div>
                  {r.matchedNews && r.matchedNews.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 border-t border-up/20 pt-1.5">
                      {r.matchedNews.map((n, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px]">
                          <Badge
                            variant="outline"
                            className="h-3.5 px-1 text-[9px]"
                            style={{
                              color: n.sentiment === 'positive' ? 'var(--up)' : 'var(--down)',
                              borderColor: n.sentiment === 'positive' ? 'var(--up)' : 'var(--down)',
                            }}
                          >
                            {n.sentiment === 'positive' ? '正' : '负'}
                          </Badge>
                          <span className="text-muted-foreground">{n.title.slice(0, 50)}{n.title.length > 50 ? '...' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
