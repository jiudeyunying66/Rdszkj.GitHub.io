'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, TrendingUp, Plus, ArrowRight, Trophy, AlertTriangle, Activity, Target, Lightbulb } from 'lucide-react';
import { useUserConfig } from '@/lib/use-user-config';
import { SECURITY_BY_ID } from '@/lib/security-library';
import { useQuery } from '@tanstack/react-query';

interface Recommendation {
  id: string;
  name: string;
  code: string;
  type: 'etf' | 'stock';
  category: string;
  currentPrice: number;
  changePercent: number;
  score: number;
  reasons: string[];
  action: 'buy' | 'hold' | 'add';
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  positionSize: string;
  horizon: string;
  signals: {
    technical?: string;
    policy?: string;
    capital?: string;
    sector?: string;
  };
}

interface RecommendResponse {
  total: number;
  recommendations: Recommendation[];
  newRecommendations: Recommendation[];
  replaceSuggestions: Array<{
    replaceId: string;
    replaceName: string;
    reason: string;
    candidates: Array<{ id: string; name: string; code: string; score: number; reasons: string[] }>;
  }>;
  addSuggestions: Array<{ id: string; name: string; code: string; score: number; action: string; reason: string }>;
  scannedCount: number;
  newsKeywordsMatched: string[];
}

function scoreColor(score: number) {
  if (score >= 80) return 'var(--up)';
  if (score >= 70) return 'var(--warn)';
  return 'var(--info)';
}

function actionStyle(action: string) {
  if (action === 'buy') return { color: 'var(--up)', label: '买入' };
  if (action === 'add') return { color: 'var(--warn)', label: '加仓' };
  return { color: 'var(--info)', label: '持有' };
}

export function RecommendPanel() {
  const { config, addToWatchlist } = useUserConfig();
  const watchlist = config.watchlist || [];
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<RecommendResponse>({
    queryKey: ['recommend', watchlist.join(',')],
    queryFn: async () => {
      const r = await fetch(`/api/recommend?watchlist=${encodeURIComponent(watchlist.join(','))}&limit=20`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`接口失败: ${r.status}`);
      return r.json();
    },
    staleTime: 60 * 60 * 1000, // 1 小时
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const handleAdd = (id: string) => {
    addToWatchlist(id);
    setAddedIds((prev) => new Set(prev).add(id));
  };

  return (
    <div className="space-y-4">
      {/* 说明 */}
      <div className="rounded-lg border border-info/30 bg-info/5 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-info" />
            <span className="font-medium">智能选股推荐</span>
          </div>
          <span className="text-muted-foreground">
            扫描全市场 {data?.scannedCount || 50}+ 证券（ETF + 个股），多维度评分
          </span>
          <Badge variant="outline" className="text-[10px]">每小时刷新</Badge>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded border border-border/60 bg-card/40 p-2 text-[10px]">
            <span className="text-info">技术面</span>：多头排列/超卖反弹/KDJ/RSI
          </div>
          <div className="rounded border border-border/60 bg-card/40 p-2 text-[10px]">
            <span className="text-up">政策面</span>：新闻关键词匹配板块
          </div>
          <div className="rounded border border-border/60 bg-card/40 p-2 text-[10px]">
            <span className="text-warn">资金面</span>：量比放大/资金关注
          </div>
          <div className="rounded border border-border/60 bg-card/40 p-2 text-[10px]">
            <span className="text-chart-5">板块轮动</span>：近20日板块强弱
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {data ? `共扫描 ${data.scannedCount} 只 · 推荐 ${data.total} 只 · 命中关键词：${data.newsKeywordsMatched.join('、') || '无'}` : '加载中...'}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1"
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
          重新扫描
        </Button>
      </div>

      {isLoading && (
        <div className="flex h-64 items-center justify-center gap-2 rounded-lg border border-border bg-card text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">正在扫描全市场证券（约需 30-60 秒）...</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-lg border border-up/30 bg-up/5 p-3 text-sm text-up">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          扫描失败：{(error as Error)?.message}
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* 替换建议 */}
          {data.replaceSuggestions.length > 0 && (
            <Card className="border-warn/40 bg-warn/5">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warn" />
                  <CardTitle className="text-sm">替换建议</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {data.replaceSuggestions.map((rs) => (
                  <div key={rs.replaceId} className="rounded-md border border-warn/30 bg-card/60 p-3">
                    <div className="text-xs">
                      <span className="text-warn font-medium">建议替换：</span>
                      <span className="ml-1 font-medium">{rs.replaceName}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{rs.reason}</div>
                    <div className="mt-2 space-y-1.5">
                      <div className="text-[10px] text-muted-foreground">替换候选：</div>
                      {rs.candidates.map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded border border-border/60 bg-background/40 p-2">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-3 w-3" style={{ color: scoreColor(c.score) }} />
                            <div>
                              <div className="text-xs font-medium">{c.name} <span className="font-mono text-[9px] text-muted-foreground">{c.code}</span></div>
                              <div className="text-[9px] text-muted-foreground">{c.reasons.join('；').slice(0, 60)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px]" style={{ color: scoreColor(c.score), borderColor: scoreColor(c.score) }}>
                              {c.score}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 gap-1 px-2 text-[10px]"
                              onClick={() => handleAdd(c.id)}
                              disabled={addedIds.has(c.id) || watchlist.includes(c.id)}
                            >
                              <Plus className="h-2.5 w-2.5" />
                              {addedIds.has(c.id) ? '已添加' : watchlist.includes(c.id) ? '已在监测' : '加入监测'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 加入建议 */}
          {data.addSuggestions.length > 0 && (
            <Card className="border-info/40 bg-info/5">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-info" />
                  <CardTitle className="text-sm">建议增加监测</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {data.addSuggestions.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded border border-border/60 bg-background/40 p-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">{r.name}</span>
                          <Badge variant="outline" className="text-[9px] font-mono">{r.code}</Badge>
                          <Badge variant="outline" className="text-[9px]" style={{ color: scoreColor(r.score), borderColor: scoreColor(r.score) }}>
                            {r.score}
                          </Badge>
                        </div>
                        <div className="mt-0.5 text-[9px] text-muted-foreground truncate">{r.reason}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-1 h-6 flex-shrink-0 gap-1 px-2 text-[10px]"
                        onClick={() => handleAdd(r.id)}
                        disabled={addedIds.has(r.id)}
                      >
                        <Plus className="h-2.5 w-2.5" />
                        {addedIds.has(r.id) ? '已加' : '加'}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 完整推荐列表 */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-warn" />
                  <CardTitle className="text-sm">完整推荐列表（按评分排序）</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[10px]">{data.total} 只</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.recommendations.map((r, idx) => {
                  const inWatchlist = watchlist.includes(r.id);
                  const added = addedIds.has(r.id);
                  const actStyle = actionStyle(r.action);
                  return (
                    <div key={r.id} className="rounded-md border border-border/60 bg-background/30 p-3 hover:border-primary/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md" style={{ background: `${scoreColor(r.score)}20`, color: scoreColor(r.score) }}>
                            <span className="font-mono text-xs font-bold tnum">{r.score}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium">{r.name}</span>
                              <Badge variant="outline" className="text-[9px] font-mono">{r.code}</Badge>
                              <Badge variant="secondary" className="text-[9px]">{r.category}</Badge>
                              <Badge variant="outline" className="text-[9px]" style={{ color: r.type === 'etf' ? 'var(--info)' : 'var(--chart-5)' }}>
                                {r.type === 'etf' ? 'ETF' : '个股'}
                              </Badge>
                              <Badge variant="outline" className="text-[9px]" style={{ color: actStyle.color, borderColor: actStyle.color }}>
                                {actStyle.label}
                              </Badge>
                              {inWatchlist && (
                                <Badge variant="outline" className="text-[9px] border-down/40 text-down">
                                  已在监测
                                </Badge>
                              )}
                            </div>
                            {/* 推荐理由 */}
                            <div className="mt-1.5 space-y-0.5">
                              {r.reasons.map((reason, i) => (
                                <div key={i} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                                  <Lightbulb className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 text-warn" />
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>
                            {/* 操作建议 */}
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                              <span className="text-muted-foreground">入场：<span className="font-mono text-foreground tnum">{r.entryPrice}</span></span>
                              <span className="text-muted-foreground">止损：<span className="font-mono text-down tnum">{r.stopLossPrice} (-7%)</span></span>
                              <span className="text-muted-foreground">目标：<span className="font-mono text-up tnum">{r.targetPrice} (+10%)</span></span>
                              <span className="text-muted-foreground">仓位：<span className="text-foreground">{r.positionSize}</span></span>
                              <span className="text-muted-foreground">周期：<span className="text-foreground">{r.horizon}</span></span>
                            </div>
                          </div>
                        </div>
                        {!inWatchlist && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 flex-shrink-0 gap-1 px-2 text-[10px]"
                            onClick={() => handleAdd(r.id)}
                            disabled={added}
                          >
                            <Plus className="h-3 w-3" />
                            {added ? '已添加' : '加入监测'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
