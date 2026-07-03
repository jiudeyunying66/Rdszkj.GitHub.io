/**
 * 微信推送服务 - WebSocket 实时推送
 * 端口: 3004
 *
 * 功能:
 * 1. 后台定时拉取行情数据，监测异常事件
 * 2. 推送事件到所有已连接客户端（模拟微信推送）
 * 3. 客户端可订阅/取消订阅特定类型事件
 */
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import iconv from 'iconv-lite';

const PORT = 3004;
const QUOTES_URL = 'https://qt.gtimg.cn/q=sh510300,sh515980,sh512760,sh561910,sh562500';

const ETF_CONFIGS = [
  { id: 'csi300', name: '沪深300ETF', code: '510300', shares: 200, costPrice: 4.984, takeProfitLine: 8, addLines: { level1: -1.5, level2: -3.0 } },
  { id: 'ai', name: '人工智能ETF', code: '515980', shares: 900, costPrice: 2.112, takeProfitLine: 10, addLines: { level1: -2.0, level2: -4.0 } },
  { id: 'chip', name: '芯片ETF', code: '512760', shares: 300, costPrice: 2.881, takeProfitLine: 15, addLines: { level1: -3.0, level2: -5.0 } },
  { id: 'battery', name: '电池ETF', code: '561910', shares: 500, costPrice: 1.117, takeProfitLine: 8, addLines: { level1: -2.0, level2: -4.0 } },
  { id: 'robot', name: '机器人ETF', code: '562500', shares: 300, costPrice: 1.470, takeProfitLine: 10, addLines: { level1: -2.5, level2: -5.0 } },
];

interface PushEvent {
  id: string;
  type: 'market_alert' | 'take_profit' | 'add_position' | 'macro_news' | 'technical_signal' | 'system';
  level: 'info' | 'warn' | 'critical';
  title: string;
  content: string;
  etfId?: string;
  etfName?: string;
  timestamp: string;
  // 微信推送样式
  channel: 'wechat' | 'app' | 'sms';
  actions?: { label: string; type: string }[];
}

const httpServer = createServer();
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// 历史事件存储（最多 100 条）
const eventHistory: PushEvent[] = [];
// 已推送事件去重（同一 ETF + 同一阈值 30 分钟内不重复推）
const pushedKeys = new Map<string, number>();
const DEDUP_WINDOW = 30 * 60 * 1000; // 30 分钟

function genId() {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function shouldPush(key: string): boolean {
  const now = Date.now();
  const last = pushedKeys.get(key);
  if (last && now - last < DEDUP_WINDOW) return false;
  pushedKeys.set(key, now);
  return true;
}

function pushEvent(event: Omit<PushEvent, 'id' | 'timestamp'>) {
  const fullEvent: PushEvent = {
    ...event,
    id: genId(),
    timestamp: new Date().toISOString(),
  };
  eventHistory.unshift(fullEvent);
  if (eventHistory.length > 100) eventHistory.pop();

  // 推送给所有客户端
  io.emit('push', fullEvent);
  // 按类型也推一份
  io.emit(`push:${fullEvent.type}`, fullEvent);
  if (fullEvent.level === 'critical') {
    io.emit('push:critical', fullEvent);
  }
  console.log(`[push] ${fullEvent.level.toUpperCase()} ${fullEvent.title}`);
  return fullEvent;
}

// ===== 行情监测循环 =====
let lastQuotes: any[] = [];

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
    console.error('[push] 行情拉取失败:', e.message);
    return null;
  }
}

function checkAndPushEvents(quotes: any[]) {
  for (const q of quotes) {
    // 1. 涨跌幅超过 4%
    const absChange = Math.abs(q.changePercent);
    if (absChange >= 4 && shouldPush(`mkt-${q.id}-${q.changePercent > 0 ? 'up' : 'down'}`)) {
      pushEvent({
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

    // 2. 持仓盈亏触发止盈线
    const pnlPercent = ((q.currentPrice - q.costPrice) / q.costPrice) * 100;
    if (pnlPercent >= q.takeProfitLine && shouldPush(`tp-${q.id}`)) {
      pushEvent({
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

    // 3. 跌破一级加仓线
    if (pnlPercent <= q.addLines.level1 && shouldPush(`add-${q.id}-l1`)) {
      pushEvent({
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

    // 4. 量比异常（与上次相比成交量突增）
    const last = lastQuotes.find((x) => x.id === q.id);
    if (last && q.volume > last.volume * 1.5 && q.volume > 100000 && shouldPush(`vol-${q.id}`)) {
      pushEvent({
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
  lastQuotes = quotes;
}

// ===== 启动监测循环（每 30 秒检查一次） =====
const MONITOR_INTERVAL = 30 * 1000;
let monitorTimer: any;

async function monitorLoop() {
  console.log('[push] 监测循环触发');
  const quotes = await fetchQuotes();
  if (quotes && quotes.length > 0) {
    checkAndPushEvents(quotes);
  }
}

function startMonitor() {
  if (monitorTimer) clearInterval(monitorTimer);
  // 立即触发一次
  monitorLoop();
  monitorTimer = setInterval(monitorLoop, MONITOR_INTERVAL);
  console.log(`[push] 监测循环已启动，间隔 ${MONITOR_INTERVAL / 1000}s`);
}

// ===== WebSocket 连接处理 =====
io.on('connection', (socket: Socket) => {
  console.log(`[push] 客户端连接: ${socket.id}`);

  // 发送历史事件（最近 20 条）
  socket.emit('history', eventHistory.slice(0, 20));

  // 订阅特定类型
  socket.on('subscribe', (types: string[]) => {
    for (const t of types) {
      socket.join(`type:${t}`);
    }
    console.log(`[push] ${socket.id} 订阅: ${types.join(', ')}`);
  });

  // 取消订阅
  socket.on('unsubscribe', (types: string[]) => {
    for (const t of types) {
      socket.leave(`type:${t}`);
    }
  });

  // 心跳
  socket.on('ping', () => {
    socket.emit('pong', { time: new Date().toISOString() });
  });

  // 测试推送
  socket.on('test', (data: any) => {
    pushEvent({
      type: 'system',
      level: 'info',
      title: '🔔 测试推送',
      content: `这是一条测试推送消息：${JSON.stringify(data).slice(0, 100)}`,
      channel: 'wechat',
    });
  });

  // 立即拉取一次行情
  socket.on('refresh', async () => {
    const quotes = await fetchQuotes();
    if (quotes) {
      socket.emit('quotes', quotes);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[push] 客户端断开: ${socket.id}`);
  });

  socket.on('error', (err: any) => {
    console.error(`[push] Socket 错误 (${socket.id}):`, err);
  });
});

// ===== 启动服务 =====
httpServer.listen(PORT, () => {
  console.log(`[push-service] 微信推送服务已启动: http://localhost:${PORT}`);
  console.log(`[push-service] 端点: WebSocket /`);
  console.log(`[push-service] 事件类型: market_alert | take_profit | add_position | macro_news | technical_signal | system`);
  startMonitor();
});

// 立即推送一条系统消息
setTimeout(() => {
  pushEvent({
    type: 'system',
    level: 'info',
    title: '✅ 推送服务已启动',
    content: 'ETF 投资辅助系统实时推送服务已上线，将自动监测异常事件并推送通知（每 30 秒检查一次）。',
    channel: 'wechat',
  });
}, 1000);

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[push] 收到 SIGTERM，关闭服务...');
  if (monitorTimer) clearInterval(monitorTimer);
  io.close();
  httpServer.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('[push] 收到 SIGINT，关闭服务...');
  if (monitorTimer) clearInterval(monitorTimer);
  io.close();
  httpServer.close(() => process.exit(0));
});
