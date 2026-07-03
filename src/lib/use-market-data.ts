'use client';

import { useQuery } from '@tanstack/react-query';
import { useUserConfig } from './use-user-config';

// ===== 类型定义 =====
export interface QuoteItem {
  id: string;
  code: string;
  name: string;
  currentPrice: number;
  prevClose: number;
  openPrice: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  change: number;
  changePercent: number;
  timestamp: string;
  amplitude: number;
  shares: number;
  marketValue: number;
  costValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface QuoteSummary {
  totalAssets: number;
  totalMarketValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  cashReserve: number;
  positionRatio: number;
  todayPnl: number;
  todayPnlPercent: number;
}

export interface QuoteResponse {
  timestamp: string;
  quotes: QuoteItem[];
  summary: QuoteSummary;
}

export interface TechIndicators {
  ma5: number;
  ma10: number;
  ma20: number;
  macd: number;
  dif: number;
  dea: number;
  kdjK: number;
  kdjD: number;
  kdjJ: number;
  rsi6: number;
  rsi12: number;
}

export interface KlineItem {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface KlineResult {
  id: string;
  code: string;
  name: string;
  currentPrice: number;
  klines: KlineItem[];
  indicators: TechIndicators;
  trend: 'up' | 'down' | 'flat';
  recent5Change: number;
  recent20Change: number;
  recentVolumeAvg: number;
  volumeRatio: number;
  error?: string;
}

export interface KlineResponse {
  timestamp: string;
  data: KlineResult[];
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  date: string;
  source: string;
  url: string;
  relatedEtfs: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  impact: 'high' | 'medium' | 'low';
}

export interface NewsResponse {
  timestamp: string;
  total: number;
  data: NewsItem[];
}

// ===== Hooks =====

// 实时行情：盘中 5 秒刷新，盘后 60 秒
export function useQuotes(watchlist?: string[]) {
  return useQuery<QuoteResponse>({
    queryKey: ['quotes', watchlist?.join(',') || 'default'],
    queryFn: async () => {
      const ids = watchlist && watchlist.length > 0 ? `?ids=${watchlist.join(',')}` : '';
      const r = await fetch(`/api/quotes${ids}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`行情接口失败: ${r.status}`);
      return r.json();
    },
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

// 历史 K线 + 技术指标：5 分钟刷新
export function useKlines(watchlist?: string[]) {
  return useQuery<KlineResponse>({
    queryKey: ['klines', watchlist?.join(',') || 'default'],
    queryFn: async () => {
      const ids = watchlist && watchlist.length > 0 ? `?ids=${watchlist.join(',')}` : '';
      const r = await fetch(`/api/klines${ids}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`K线接口失败: ${r.status}`);
      return r.json();
    },
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

// 财经新闻：10 分钟刷新
export function useNews() {
  return useQuery<NewsResponse>({
    queryKey: ['news'],
    queryFn: async () => {
      const r = await fetch('/api/news', { cache: 'no-store' });
      if (!r.ok) throw new Error(`新闻接口失败: ${r.status}`);
      return r.json();
    },
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}
