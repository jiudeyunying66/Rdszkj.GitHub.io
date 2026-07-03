// 用户参数管理 - localStorage 持久化
'use client';

import { useState, useEffect, useCallback } from 'react';

export interface EtfUserConfig {
  shares: number;          // 持仓数量
  costPrice: number;       // 成本价
  targetShares?: number;   // 目标持仓
  addLine1: number;        // 一级加仓线 (%)
  addLine2: number;        // 二级加仓线 (%)
  takeProfitLine: number;  // 止盈线 (%)
}

export interface UserConfig {
  cashReserve: number;     // 账户现金（备用金，参与总资产计算）
  weeklyInvest: number;    // 周定投金额
  positions: Record<string, EtfUserConfig>;
  // watchlist: 用户监测的 ETF id 列表（需求 6A）
  watchlist?: string[];
}

const STORAGE_KEY = 'etf-dashboard-user-config-v4';

// 默认值（来自策略文档）
export const DEFAULT_USER_CONFIG: UserConfig = {
  cashReserve: 500,
  weeklyInvest: 500,
  positions: {
    csi300: { shares: 200, costPrice: 4.984, targetShares: 1000, addLine1: -1.5, addLine2: -3.0, takeProfitLine: 8 },
    ai: { shares: 900, costPrice: 2.112, addLine1: -2.0, addLine2: -4.0, takeProfitLine: 10 },
    chip: { shares: 300, costPrice: 2.881, addLine1: -3.0, addLine2: -5.0, takeProfitLine: 15 },
    battery: { shares: 500, costPrice: 1.117, addLine1: -2.0, addLine2: -4.0, takeProfitLine: 8 },
    robot: { shares: 300, costPrice: 1.470, addLine1: -2.5, addLine2: -5.0, takeProfitLine: 10 },
  },
  watchlist: ['csi300', 'ai', 'chip', 'battery', 'robot'],
};

export function useUserConfig() {
  const [config, setConfig] = useState<UserConfig>(DEFAULT_USER_CONFIG);
  const [loaded, setLoaded] = useState(false);

  // 加载
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged: UserConfig = {
          ...DEFAULT_USER_CONFIG,
          ...parsed,
          positions: { ...DEFAULT_USER_CONFIG.positions, ...(parsed.positions || {}) },
          watchlist: parsed.watchlist || DEFAULT_USER_CONFIG.watchlist,
        };
        // 异步触发避免在 effect 同步体内 setState
        setTimeout(() => setConfig(merged), 0);
      }
    } catch (e) {}
    setTimeout(() => setLoaded(true), 0);
  }, []);

  // 持久化
  const save = useCallback((newConfig: UserConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    } catch (e) {}
  }, []);

  const update = useCallback((partial: Partial<UserConfig>) => {
    const newConfig = { ...config, ...partial };
    save(newConfig);
  }, [config, save]);

  const updatePosition = useCallback((etfId: string, partial: Partial<EtfUserConfig>) => {
    const newPos = { ...config.positions[etfId], ...partial };
    const newConfig = {
      ...config,
      positions: { ...config.positions, [etfId]: newPos },
    };
    save(newConfig);
  }, [config, save]);

  // 添加 ETF 到 watchlist（需求 6A）
  const addToWatchlist = useCallback((etfId: string) => {
    const list = config.watchlist || [];
    if (list.includes(etfId)) return;
    const newConfig = { ...config, watchlist: [...list, etfId] };
    save(newConfig);
  }, [config, save]);

  // 从 watchlist 移除（需求 6A）
  const removeFromWatchlist = useCallback((etfId: string) => {
    const list = config.watchlist || [];
    const newConfig = {
      ...config,
      watchlist: list.filter((id) => id !== etfId),
    };
    save(newConfig);
  }, [config, save]);

  const reset = useCallback(() => {
    save(DEFAULT_USER_CONFIG);
  }, [save]);

  return {
    config,
    loaded,
    update,
    updatePosition,
    addToWatchlist,
    removeFromWatchlist,
    reset,
    save,
  };
}
