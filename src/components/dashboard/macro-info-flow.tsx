'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, ExternalLink, Filter, Clock, ShieldCheck, Wifi, Landmark, Newspaper, Factory, Globe, Building2 } from 'lucide-react';
import { useNews } from '@/lib/use-market-data';
import { ETF_CONFIGS } from '@/lib/etf-config';

const AUTHORITY_LABEL_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  official: { label: '官方权威', icon: <Landmark className="h-3.5 w-3.5" />, color: 'var(--up)' },
  media: { label: '财经媒体', icon: <Newspaper className="h-3.5 w-3.5" />, color: 'var(--info)' },
  industry: { label: '行业研究', icon: <Factory className="h-3.5 w-3.5" />, color: 'var(--chart-5)' },
  geopolitical: { label: '地缘监测', icon: <Globe className="h-3.5 w-3.5" />, color: 'var(--warn)' },
  sentiment: { label: '舆情情绪', icon: <Newspaper className="h-3.5 w-3.5" />, color: 'var(--flat)' },
};

interface GovNewsItem {
  id: string;
  title: string;
  content: string;
  date: string;
  source: string;
  sourceType: 'official' | 'geopolitical';
  sourceWeight: number;
  url: string;
  relatedEtfs: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  impact: 'high' | 'medium' | 'low';
}

// 政府源 hook
function useGovNews() {
  return useQuery<{ timestamp: string; total: number; bySource: any; data: GovNewsItem[] }>({
    queryKey: ['gov-news'],
    queryFn: async () => {
      const r = await fetch('/api/gov-news', { cache: 'no-store' });
      if (!r.ok) throw new Error(`政府源接口失败: ${r.status}`);
      return r.json();
    },
    refetchInterval: 15 * 60 * 1000,
    retry: 1,
  });
}

function timeAgo(dateStr: string) {
  if (!dateStr) return '';
  const now = new Date();
  const t = new Date(dateStr);
  if (isNaN(t.getTime())) return dateStr.slice(0, 16);
  const min = Math.floor((now.getTime() - t.getTime()) / 60000);
  if (min < 60) return `${min}分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

function sentimentColor(s: string) {
  if (s === 'positive') return 'var(--up)';
  if (s === 'negative') return 'var(--down)';
  return 'var(--flat)';
}
function sentimentLabel(s: string) {
  if (s === 'positive') return '正面';
  if (s === 'negative') return '负面';
  return '中性';
}
function impactColor(i: string) {
  if (i === 'high') return 'var(--up)';
  if (i === 'medium') return 'var(--warn)';
  return 'var(--info)';
}
function impactLabel(i: string) {
  if (i === 'high') return '高影响';
  if (i === 'medium') return '中影响';
  return '低影响';
}

function etfName(id: string) {
  return ETF_CONFIGS.find((e) => e.id === id)?.name || id;
}

function NewsCard({ info, isGov }: { info: any; isGov?: boolean }) {
  const authLevel = isGov ? info.sourceType : info.authorityLevel;
  const authSource = isGov ? info.source : info.authoritySource;
  const weight = isGov ? info.sourceWeight : info.authorityWeight;
  const authInfo = AUTHORITY_LABEL_MAP[authLevel] || AUTHORITY_LABEL_MAP.media;
  const isHighWeight = weight >= 60;
  return (
    <Card className="border-border bg-card transition-colors hover:border-primary/40">
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md"
              style={{ background: `${authInfo.color}20`, color: authInfo.color }}
            >
              {authInfo.icon}
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-up">{authSource}</span>
                <Badge variant="outline" className="h-4 px-1.5 text-[10px]" style={{ color: authInfo.color, borderColor: `${authInfo.color}40` }}>
                  {authInfo.label}
                </Badge>
                {isGov && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-primary/40 text-primary">
                    <Building2 className="h-2.5 w-2.5 mr-0.5" />官网直连
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {timeAgo(info.date)}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">权重</span>
              <span
                className="font-mono text-xs font-semibold tnum"
                style={{ color: isHighWeight ? 'var(--up)' : 'var(--flat)' }}
              >
                {weight}%
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <h4 className="text-sm font-medium leading-snug">{info.title}</h4>
        {info.content && info.content !== info.title && (
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">{info.content}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Badge
            variant="outline"
            className="gap-1 text-[10px]"
            style={{ color: sentimentColor(info.sentiment), borderColor: `${sentimentColor(info.sentiment)}40` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: sentimentColor(info.sentiment) }} />
            {sentimentLabel(info.sentiment)} ({info.sentimentScore > 0 ? '+' : ''}{info.sentimentScore.toFixed(2)})
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px]"
            style={{ color: impactColor(info.impact), borderColor: `${impactColor(info.impact)}40` }}
          >
            {impactLabel(info.impact)}
          </Badge>
          {info.relatedEtfs.map((eid: string) => (
            <Badge key={eid} variant="secondary" className="text-[10px]">
              {etfName(eid)}
            </Badge>
          ))}
          {info.url && (
            <a
              href={info.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-[10px] text-info hover:underline"
            >
              查看原文 <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MacroInfoFlow() {
  const { data, isLoading, isFetching } = useNews();
  const { data: govData, isLoading: govLoading } = useGovNews();
  const [dataSource, setDataSource] = useState<'all' | 'gov' | 'media'>('all');
  const [filter, setFilter] = useState<'all' | 'official' | 'high' | 'related'>('all');

  // 合并政府源 + 媒体源
  const allNews = useMemo(() => {
    const mediaList = (data?.data || []).map((n: any) => ({ ...n, _source: 'media' }));
    const govList = (govData?.data || []).map((n: any) => ({ ...n, _source: 'gov' }));
    let combined: any[] = [];
    if (dataSource === 'all' || dataSource === 'gov') combined.push(...govList);
    if (dataSource === 'all' || dataSource === 'media') combined.push(...mediaList);
    // 按时间倒序
    combined.sort((a, b) => (b.date > a.date ? 1 : -1));
    return combined;
  }, [data, govData, dataSource]);

  const filtered = useMemo(() => {
    if (filter === 'all') return allNews;
    return allNews.filter((n: any) => {
      const isOfficial = n._source === 'gov' || n.authorityLevel === 'official';
      const isHigh = n.impact === 'high';
      const isRelated = n.relatedEtfs && n.relatedEtfs.length > 0;
      if (filter === 'official') return isOfficial;
      if (filter === 'high') return isHigh;
      if (filter === 'related') return isRelated;
      return true;
    });
  }, [allNews, filter]);

  if (isLoading || govLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 rounded-lg border border-border bg-card text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">正在拉取央行/证监会官网 + 财经媒体...</span>
      </div>
    );
  }

  const govCount = govData?.total || 0;
  const mediaCount = data?.total || 0;
  const totalCount = govCount + mediaCount;
  const highImpactCount = allNews.filter((n: any) => n.impact === 'high').length;
  const relatedCount = allNews.filter((n: any) => n.relatedEtfs?.length > 0).length;
  const positiveCount = allNews.filter((n: any) => n.sentiment === 'positive').length;
  const negativeCount = allNews.filter((n: any) => n.sentiment === 'negative').length;

  return (
    <div className="space-y-3">
      {/* 权威源说明 */}
      <div className="rounded-lg border border-info/30 bg-info/5 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-info" />
            <span className="font-medium">多源权威信息</span>
          </div>
          <span className="text-muted-foreground">
            <Building2 className="inline h-3 w-3 text-primary" /> 央行/证监会官网直连 (90%)
            <span className="mx-2">·</span>
            <Globe className="inline h-3 w-3 text-warn" /> CSIS 地缘 (50%)
            <span className="mx-2">·</span>
            <Newspaper className="inline h-3 w-3 text-info" /> 东方财富搜索 (70%)
          </span>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <div className="rounded-md border border-border bg-card p-2 text-center">
          <div className="text-[10px] text-muted-foreground">总条数</div>
          <div className="font-mono text-lg font-semibold tnum text-foreground">{totalCount}</div>
        </div>
        <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-center">
          <div className="text-[10px] text-primary">官网直连</div>
          <div className="font-mono text-lg font-semibold tnum text-primary">{govCount}</div>
        </div>
        <div className="rounded-md border border-up/30 bg-up/5 p-2 text-center">
          <div className="text-[10px] text-up">高影响</div>
          <div className="font-mono text-lg font-semibold tnum text-up">{highImpactCount}</div>
        </div>
        <div className="rounded-md border border-down/30 bg-down/5 p-2 text-center">
          <div className="text-[10px] text-down">关联持仓</div>
          <div className="font-mono text-lg font-semibold tnum text-down">{relatedCount}</div>
        </div>
        <div className="rounded-md border border-border bg-card p-2 text-center">
          <div className="text-[10px] text-muted-foreground">情绪</div>
          <div className="font-mono text-xs tnum">
            <span className="text-up">{positiveCount}正</span>
            <span className="text-flat"> {totalCount - positiveCount - negativeCount}中</span>
            <span className="text-down"> {negativeCount}负</span>
          </div>
        </div>
      </div>

      {/* 数据源切换 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-muted-foreground">数据源：</span>
        <button
          onClick={() => setDataSource('all')}
          className={`rounded-md border px-2.5 py-1 text-xs ${dataSource === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          全部 ({totalCount})
        </button>
        <button
          onClick={() => setDataSource('gov')}
          className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${dataSource === 'gov' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          <Building2 className="h-3 w-3" /> 官网直连 ({govCount})
        </button>
        <button
          onClick={() => setDataSource('media')}
          className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${dataSource === 'media' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          <Newspaper className="h-3 w-3" /> 财经媒体 ({mediaCount})
        </button>
      </div>

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> 筛选：
        </span>
        <button
          onClick={() => setFilter('all')}
          className={`rounded-md border px-2.5 py-1 text-xs ${filter === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          全部 ({totalCount})
        </button>
        <button
          onClick={() => setFilter('official')}
          className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${filter === 'official' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          <Landmark className="h-3 w-3" /> 官方权威 ({allNews.filter((n: any) => n._source === 'gov' || n.authorityLevel === 'official').length})
        </button>
        <button
          onClick={() => setFilter('high')}
          className={`rounded-md border px-2.5 py-1 text-xs ${filter === 'high' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          高影响 ({highImpactCount})
        </button>
        <button
          onClick={() => setFilter('related')}
          className={`rounded-md border px-2.5 py-1 text-xs ${filter === 'related' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          关联持仓 ({relatedCount})
        </button>
      </div>

      {/* 实时状态 */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Wifi className="h-3 w-3 text-down" />
          {isFetching ? '更新中...' : '已更新'}
          <span>·</span>
          央行/证监会官网 + 东方财富 · 10分钟刷新
        </span>
      </div>

      {/* 卡片列表 */}
      <ScrollArea className="h-[640px] pr-3">
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              暂无符合条件的新闻
            </div>
          )}
          {filtered.map((info: any, idx: number) => {
            // 用 idx + id + 标题前30字符 + 日期组合，确保 100% 唯一
            const uniqueKey = `${info._source}-${idx}-${info.id}-${(info.title || '').slice(0, 30)}-${(info.date || '').slice(0, 10)}`;
            return <NewsCard key={uniqueKey} info={info} isGov={info._source === 'gov'} />;
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
