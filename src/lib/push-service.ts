// 推送服务核心逻辑 - 全局单例，跨请求维持状态
// 在 Next.js API Route 内运行，使用 SSE 推送

import iconv from 'iconv-lite';

const ETF_CONFIGS = [
  { id: 'csi300', name: '沪深300ETF', code: '510300', shares: 200, costPrice: 4.984, takeProfitLine: 8, addLines: { level1: -1.5, level2: -3.0 } },
  { id: 'ai', name: '人工智能ETF', code: '159819', shares: 900, costPrice: 2.112, takeProfitLine: 10, addLines: { level1: -2.0, level2: -4.0 } },
  { id: 'chip', name: '芯片ETF', code: '159995', shares: 300, costPrice: 2.881, takeProfitLine: 15, addLines: { level1: -3.0, level2: -5.0 } },
  { id: 'battery', name: '电池ETF', code: '159755', shares: 500, costPrice: 1.117, takeProfitLine: 8, addLines: { level1: -2.0, level2: -4.0 } },
  { id: 'robot', name: '机器人ETF', code: '159559', shares: 300, costPrice: 1.470, takeProfitLine: 10, addLines: { level1: -2.5, level2: -5.0 } },
];

const QUOTES_URL = 'https://qt.gtimg.cn/q=sh510300,sz159819,sz159995,sz159755,sz159559';

export interface PushEvent {
  id: string;
  type: 'market_alert' | 'take_profit' | 'add_position' | 'macro_news' | 'technical_signal' | 'system';
  level: 'info' | 'warn' | 'critical';
  title: string;
  content: string;
  etfId?: string;
  etfName?: string;
  timestamp: string;
  channel: 'wechat' | 'app' | 'sms';
  actions?: { label: string; type: string }[];
}

// 全局状态（只在第一次 import 时初始化）
declare global {
  var __pushState: {
    events: PushEvent[];
    subscribers: Set<(event: PushEvent) => void>;
    lastQuotes: any[];
    pushedKeys: Map<string, number>;
    monitorStarted: boolean;
    lastMonitorAt: number;
  } | undefined;
}

const DEDUP_WINDOW = 30 * 60 * 1000;

function getState() {
  if (!globalThis.__pushState) {
    globalThis.__pushState = {
      events: [],
      subscribers: new Set(),
      lastQuotes: [],
      pushedKeys: new Map(),
      monitorStarted: false,
      lastMonitorAt: 0,
    };
  }
  return globalThis.__pushState;
}

function genId() {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function shouldPush(key: string): boolean {
  const state = getState();
  const now = Date.now();
  const last = state.pushedKeys.get(key);
  if (last && now - last < DEDUP_WINDOW) return false;
  state.pushedKeys.set(key, now);
  return true;
}

export function emitEvent(event: Omit<PushEvent, 'id' | 'timestamp'>): PushEvent {
  const state = getState();
  const fullEvent: PushEvent = {
    ...event,
    id: genId(),
    timestamp: new Date().toISOString(),
  };
  state.events.unshift(fullEvent);
  if (state.events.length > 100) state.events.pop();
  // 推送给所有订阅者
  for (const cb of state.subscribers) {
    try {
      cb(fullEvent);
    } catch (e) {
      // ignore
    }
  }
  return fullEvent;
}

export function subscribe(cb: (event: PushEvent) => void): () => void {
  const state = getState();
  state.subscribers.add(cb);
  return () => {
    state.subscribers.delete(cb);
  };
}

export function getHistory(limit = 50): PushEvent[] {
  return getState().events.slice(0, limit);
}

async function fetchQuotes() {
  try {
    const resp = await fetch(QUOTES_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://gu.qq.com/',
      },
      cache: 'no-store',
    });
    if (!resp.ok) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    const text = iconv.decode(buf, 'gbk');
    const quotes: any[] = [];
    for (const line of text.trim().split('\n')) {
      const m = line.match(/^v_(\w+)="(.+)";?$/);
      if (!m) continue;
      const parts = m[2].split('~');
      if (parts.length < 35) continue;
      const code = parts[2];
      const cfg = ETF_CONFIGS.find((e) => e.code === code);
      if (!cfg) continue;
      quotes.push({
        ...cfg,
        currentPrice: parseFloat(parts[3]) || 0,
        prevClose: parseFloat(parts[4]) || 0,
        changePercent: parseFloat(parts[32]) || 0,
        change: parseFloat(parts[31]) || 0,
        volume: parseInt(parts[6]) || 0,
        high: parseFloat(parts[33]) || 0,
        low: parseFloat(parts[34]) || 0,
        timestamp: parts[30] || '',
      });
    }
    return quotes;
  } catch (e: any) {
    return null;
  }
}

function checkAndPushEvents(quotes: any[]) {
  for (const q of quotes) {
    const absChange = Math.abs(q.changePercent);
    if (absChange >= 4 && shouldPush(`mkt-${q.id}-${q.changePercent > 0 ? 'up' : 'down'}`)) {
      emitEvent({
        type: 'market_alert',
        level: absChange >= 5 ? 'critical' : 'warn',
        title: `🚨 ${q.name} ${q.changePercent > 0 ? '涨' : '跌'} ${absChange.toFixed(2)}%`,
        content: `${q.name}(${q.code}) 现价 ${q.currentPrice.toFixed(3)} 元，${q.changePercent > 0 ? '涨' : '跌'}幅 ${absChange.toFixed(2)}%，成交量 ${(q.volume / 10000).toFixed(0)} 万手，已突破 4% 重大波动阈值。`,
        etfId: q.id,
        etfName: q.name,
        channel: 'wechat',
        actions: [
          { label: q.changePercent > 0 ? '查看止盈' : '查看加仓', type: q.changePercent > 0 ? 'take_profit' : 'add_position' },
        ],
      });
    }

    const pnlPercent = ((q.currentPrice - q.costPrice) / q.costPrice) * 100;
    if (pnlPercent >= q.takeProfitLine && shouldPush(`tp-${q.id}`)) {
      emitEvent({
        type: 'take_profit',
        level: 'warn',
        title: `💰 ${q.name} 触发止盈线 +${q.takeProfitLine}%`,
        content: `${q.name} 当前持仓盈亏 +${pnlPercent.toFixed(2)}%，已达止盈线 +${q.takeProfitLine}%，建议卖出整百股止盈。`,
        etfId: q.id,
        etfName: q.name,
        channel: 'wechat',
        actions: [{ label: '查看持仓', type: 'view_position' }],
      });
    }

    if (pnlPercent <= q.addLines.level1 && shouldPush(`add-${q.id}-l1`)) {
      emitEvent({
        type: 'add_position',
        level: pnlPercent <= q.addLines.level2 ? 'critical' : 'warn',
        title: `📉 ${q.name} 触发一级加仓线 ${q.addLines.level1}%`,
        content: `${q.name} 当前持仓盈亏 ${pnlPercent.toFixed(2)}%，已触发一级加仓线 ${q.addLines.level1}%，可考虑分批建仓。${pnlPercent <= q.addLines.level2 ? '已触发二级加仓线，可加大建仓力度。' : ''}`,
        etfId: q.id,
        etfName: q.name,
        channel: 'wechat',
        actions: [{ label: '查看资金', type: 'view_capital' }],
      });
    }

    const state = getState();
    const last = state.lastQuotes.find((x) => x.id === q.id);
    if (last && q.volume > last.volume * 1.5 && q.volume > 100000 && shouldPush(`vol-${q.id}`)) {
      emitEvent({
        type: 'market_alert',
        level: 'info',
        title: `📊 ${q.name} 成交量异常放大`,
        content: `${q.name} 成交量从 ${(last.volume / 10000).toFixed(0)} 万手增至 ${(q.volume / 10000).toFixed(0)} 万手，环比放大 ${((q.volume / last.volume - 1) * 100).toFixed(0)}%，关注后续走势。`,
        etfId: q.id,
        etfName: q.name,
        channel: 'app',
      });
    }
  }
  getState().lastQuotes = quotes;
}

// 启动后台监测（每个请求会检查，但只在间隔够长时执行）
const MONITOR_INTERVAL = 30 * 1000;

export async function ensureMonitor() {
  const state = getState();
  const now = Date.now();
  // 至少间隔 30s 才执行下一次
  if (now - state.lastMonitorAt < MONITOR_INTERVAL) return;
  state.lastMonitorAt = now;

  // 异步执行，不阻塞请求
  (async () => {
    try {
      const quotes = await fetchQuotes();
      if (quotes && quotes.length > 0) {
        checkAndPushEvents(quotes);
      }
    } catch (e) {
      // ignore
    }
  })();
}

// 首次 import 时启动一条系统消息
if (!getState().monitorStarted) {
  getState().monitorStarted = true;
  setTimeout(() => {
    emitEvent({
      type: 'system',
      level: 'info',
      title: '✅ 推送服务已启动',
      content: '市场数据监测系统实时推送服务已上线，将自动监测异常事件并推送通知（每 30 秒检查一次）。',
      channel: 'wechat',
    });
  }, 1000);
}
