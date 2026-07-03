'use client';

import { useQuery } from '@tanstack/react-query';

export interface ArimaPrediction {
  nextDay: { openLow: number; openHigh: number; changeLow: number; changeHigh: number; mid: number };
  threeDay: { changeLow: number; changeHigh: number; mid: number };
  confidence: number;
  order: [number, number, number];
  log: string;
}

export interface LstmPrediction {
  nextDay: { openLow: number; openHigh: number; changeLow: number; changeHigh: number; mid: number };
  threeDay: { changeLow: number; changeHigh: number; mid: number };
  confidence: number;
  trainLoss?: number;
  valLoss?: number;
  rmse?: number;
  trainTime?: number;
  epochs?: number;
  log: string;
}

export interface EnsemblePrediction {
  nextDay: { openLow: number; openHigh: number; changeLow: number; changeHigh: number };
  threeDay: { changeLow: number; changeHigh: number };
  confidence: number;
  method: string;
}

export interface PredictionResponse {
  etfId: string;
  etfName: string;
  currentPrice: number;
  arima: ArimaPrediction;
  lstm: LstmPrediction;
  ensemble: EnsemblePrediction;
  timestamp: string;
}

interface KlineItem {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

// 单 ETF 预测 hook
export function usePrediction(
  etfId: string,
  klines: KlineItem[] | undefined,
  etfName: string,
  currentPrice: number | undefined,
  enabled: boolean = true
) {
  return useQuery<PredictionResponse>({
    queryKey: ['prediction', etfId, klines?.length, currentPrice],
    queryFn: async () => {
      if (!klines || klines.length < 30 || !currentPrice) {
        throw new Error('数据不足');
      }
      const r = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          klines,
          etfId,
          etfName,
          currentPrice,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: '请求失败' }));
        throw new Error(err.error || `预测失败: ${r.status}`);
      }
      return r.json();
    },
    enabled: enabled && !!klines && klines.length >= 30 && !!currentPrice,
    staleTime: 10 * 60 * 1000, // 10 分钟内不重新计算
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
