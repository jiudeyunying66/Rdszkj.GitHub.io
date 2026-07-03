// 智能选股推荐接口
// 基于内置证券库（50+ ETF + 个股）扫描，多维度推荐
// 维度：技术面（趋势/超卖）+ 政策面（新闻关键词匹配）+ 资金面（量比）+ 板块轮动
import { NextResponse } from 'next/server';
import iconv from 'iconv-lite';
import { SECURITY_LIBRARY, SECURITY_BY_ID } from '@/lib/security-library';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

interface ScanResult {
  id: string;
  name: string;
  code: string;
  market: string;
  type: 'etf' | 'stock';
  category: string;
  currentPrice: number;
  changePercent: number;
  volume: number;
  amount: number;
  // 技术指标
  ma5: number;
  ma10: number;
  ma20: number;
  kdjJ: number;
  rsi6: number;
  trend: 'up' | 'down' | 'flat';
  volumeRatio: number;
  recent5Change: number;
  recent20Change: number;
}

interface Recommendation {
  id: string;
  name: string;
  code: string;
  type: 'etf' | 'stock';
  category: string;
  currentPrice: number;
  changePercent: number;
  // 推荐信息
  score: number;          // 综合评分 0-100
  reasons: string[];      // 推荐理由
  action: 'buy' | 'hold' | 'add';  // 建议操作
  entryPrice: number;     // 建议入场价
  stopLossPrice: number;  // 止损价
  targetPrice: number;    // 目标价
  positionSize: string;   // 仓位建议
  horizon: string;        // 持有周期
  // 信号来源
  signals: {
    technical?: string;
    policy?: string;
    capital?: string;
    sector?: string;
  };
}

async function fetchBatchQuotes(securities: typeof SECURITY_LIBRARY): Promise<ScanResult[]> {
  const codes = securities.map((s) => `${s.market}${s.code}`).join(',');
  const url = `https://qt.gtimg.cn/q=${codes}`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://gu.qq.com/',
    },
    cache: 'no-store',
  });
  if (!resp.ok) throw new Error(`行情接口失败: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const text = iconv.decode(buf, 'gbk');

  const results: ScanResult[] = [];
  for (const line of text.trim().split('\n')) {
    const m = line.match(/^v_(\w+)="(.+)";?$/);
    if (!m) continue;
    const parts = m[2].split('~');
    if (parts.length < 35) continue;
    const code = parts[2];
    const cfg = securities.find((s) => s.code === code);
    if (!cfg) continue;

    results.push({
      id: cfg.id,
      name: cfg.name,
      code: cfg.code,
      market: cfg.market,
      type: cfg.type,
      category: cfg.category,
      currentPrice: parseFloat(parts[3]) || 0,
      changePercent: parseFloat(parts[32]) || 0,
      volume: parseInt(parts[6]) || 0,
      amount: parseFloat(parts[37]) || 0,
      ma5: 0, ma10: 0, ma20: 0,
      kdjJ: 50, rsi6: 50,
      trend: 'flat',
      volumeRatio: 0,
      recent5Change: 0,
      recent20Change: 0,
    });
  }
  return results;
}

async function fetchKlinesForScan(code: string, market: string): Promise<any[]> {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${market}${code},day,,,30,qfq`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://gu.qq.com/',
    },
    cache: 'no-store',
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  const arr = data?.data?.[`${market}${code}`]?.qfqday || data?.data?.[`${market}${code}`]?.day || [];
  return arr.map((k: any[]) => ({
    date: k[0], open: parseFloat(k[1]), close: parseFloat(k[2]),
    high: parseFloat(k[3]), low: parseFloat(k[4]), volume: parseFloat(k[5]) || 0,
  }));
}

function calcIndicators(klines: any[]) {
  if (klines.length < 10) return null;
  const closes = klines.map((k) => k.close);
  const ma = (p: number) => closes.slice(-p).reduce((s, v) => s + v, 0) / Math.min(p, closes.length);
  const ma5 = ma(5), ma10 = ma(10), ma20 = ma(20);
  // KDJ
  const recent = klines.slice(-9);
  const high9 = Math.max(...recent.map((k) => k.high));
  const low9 = Math.min(...recent.map((k) => k.low));
  const close = closes[closes.length - 1];
  const kdjJ = high9 > low9 ? ((close - low9) / (high9 - low9)) * 100 : 50;
  // RSI6
  let gains = 0, losses = 0;
  for (let i = closes.length - 6; i < closes.length; i++) {
    if (i < 1) continue;
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const rsi6 = losses === 0 ? 100 : 100 - 100 / (1 + gains / 6 / (losses / 6));
  // 趋势
  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (close > ma5 && ma5 > ma10) trend = 'up';
  else if (close < ma5 && ma5 < ma10) trend = 'down';
  // 量比
  const recentVol = klines.slice(-21, -1).reduce((s, k) => s + k.volume, 0) / Math.min(20, klines.length - 1);
  const todayVol = klines[klines.length - 1].volume;
  const volumeRatio = recentVol > 0 ? todayVol / recentVol : 0;
  // 近5日/20日涨跌
  const recent5Change = closes.length >= 6 ? ((close - closes[closes.length - 6]) / closes[closes.length - 6]) * 100 : 0;
  const recent20Change = closes.length >= 21 ? ((close - closes[closes.length - 21]) / closes[closes.length - 21]) * 100 : 0;
  return { ma5, ma10, ma20, kdjJ, rsi6, trend, volumeRatio, recent5Change, recent20Change };
}

// 推荐评分逻辑
function scoreAndRecommend(
  scan: ScanResult,
  newsKeywords: string[],
  userWatchlist: string[]
): Recommendation | null {
  const reasons: string[] = [];
  const signals: Recommendation['signals'] = {};
  let score = 50; // 基础分

  // 1. 技术面信号
  if (scan.trend === 'up') {
    score += 10;
    reasons.push(`技术面多头排列（价格>MA5>MA10）`);
    signals.technical = '多头';
  } else if (scan.trend === 'down') {
    score -= 5;
  }
  // KDJ 超卖反弹
  if (scan.kdjJ < 20) {
    score += 15;
    reasons.push(`KDJ.J=${scan.kdjJ.toFixed(0)} 超卖，短期反弹概率高`);
    signals.technical = (signals.technical || '') + ' 超卖反弹';
  } else if (scan.kdjJ > 80) {
    score -= 10;
    reasons.push(`KDJ.J=${scan.kdjJ.toFixed(0)} 超买，短期有回调风险`);
  }
  // RSI 超卖
  if (scan.rsi6 < 30) {
    score += 10;
    reasons.push(`RSI6=${scan.rsi6.toFixed(0)} 超卖`);
  }
  // 近5日强势
  if (scan.recent5Change > 3) {
    score += 5;
    reasons.push(`近5日涨幅 +${scan.recent5Change.toFixed(2)}%`);
  } else if (scan.recent5Change < -5) {
    score += 8; // 跌多了反弹机会
    reasons.push(`近5日跌幅 ${scan.recent5Change.toFixed(2)}%，超跌反弹机会`);
  }

  // 2. 资金面信号
  if (scan.volumeRatio >= 1.5) {
    score += 10;
    reasons.push(`量比 ${scan.volumeRatio.toFixed(2)}，资金关注度较高`);
    signals.capital = '放量';
  } else if (scan.volumeRatio < 0.5) {
    score -= 3;
  }

  // 3. 政策面信号（基于新闻关键词匹配）
  const matchedPolicies: string[] = [];
  for (const kw of SECURITY_BY_ID[scan.id]?.keywords || []) {
    if (newsKeywords.includes(kw)) {
      matchedPolicies.push(kw);
    }
  }
  if (matchedPolicies.length > 0) {
    score += 12;
    reasons.push(`政策/新闻催化：关键词「${matchedPolicies.join('、')}」命中近期新闻`);
    signals.policy = matchedPolicies.join('+');
  }

  // 4. 板块轮动（同分类近期表现）
  if (scan.recent20Change > 5) {
    score += 5;
    reasons.push(`近20日涨幅 +${scan.recent20Change.toFixed(2)}%，板块处于强势`);
    signals.sector = '强势';
  }

  // 5. 已在 watchlist 中减分（避免重复推荐）
  if (userWatchlist.includes(scan.id)) {
    score -= 15;
  }

  // 过滤：评分低于 60 不推荐
  if (score < 60) return null;

  // 去除重复理由
  const uniqueReasons = [...new Set(reasons)];
  if (uniqueReasons.length === 0) return null;

  // 操作建议
  let action: 'buy' | 'hold' | 'add' = 'hold';
  if (score >= 80) action = 'buy';
  else if (score >= 70) action = 'add';

  // 入场价/止损/目标
  const entryPrice = scan.currentPrice;
  const stopLossPrice = entryPrice * 0.93; // -7% 止损
  const targetPrice = entryPrice * 1.10;   // +10% 目标
  const positionSize = scan.type === 'etf' ? '10-20% 仓位' : '5-10% 仓位（个股风险较高）';
  const horizon = scan.kdjJ < 20 ? '短期（1-2周）' : '中期（1-3月）';

  return {
    id: scan.id,
    name: scan.name,
    code: scan.code,
    type: scan.type,
    category: scan.category,
    currentPrice: scan.currentPrice,
    changePercent: scan.changePercent,
    score: Math.min(100, Math.max(0, score)),
    reasons: uniqueReasons,
    action,
    entryPrice: Number(entryPrice.toFixed(3)),
    stopLossPrice: Number(stopLossPrice.toFixed(3)),
    targetPrice: Number(targetPrice.toFixed(3)),
    positionSize,
    horizon,
    signals,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userWatchlist = (url.searchParams.get('watchlist') || '').split(',').filter(Boolean);
    const limit = parseInt(url.searchParams.get('limit') || '20');

    // 1. 拉取所有证券的实时行情
    const allSecurities = SECURITY_LIBRARY;
    const quotes = await fetchBatchQuotes(allSecurities);

    // 2. 拉取 K 线计算技术指标（仅前 30 只，避免请求过多）
    const top30 = quotes.slice(0, 30);
    const klinePromises = top30.map(async (q) => {
      const klines = await fetchKlinesForScan(q.code, q.market);
      const ind = calcIndicators(klines);
      if (ind) {
        return { ...q, ...ind };
      }
      return q;
    });
    const scanned = await Promise.all(klinePromises);

    // 3. 获取新闻关键词（从东方财富搜索简化版）
    let newsKeywords: string[] = [];
    try {
      const newsResp = await fetch('http://localhost:3000/api/news', { cache: 'no-store' });
      if (newsResp.ok) {
        const newsData = await newsResp.json();
        // 提取所有新闻标题中的关键词
        const allTitles = (newsData.data || []).map((n: any) => n.title + ' ' + n.content).join(' ');
        // 简化：直接用预设关键词列表过滤
        const presetKeywords = ['AI', '人工智能', '芯片', '半导体', '电池', '新能源', '机器人', '光伏', '军工', '医药', '白酒', '消费', '银行', '证券', '黄金', '煤炭', '钢铁', '港股', '纳指'];
        newsKeywords = presetKeywords.filter((kw) => allTitles.includes(kw));
      }
    } catch (e) {}

    // 4. 评分推荐
    const recommendations = scanned
      .map((s) => scoreAndRecommend(s, newsKeywords, userWatchlist))
      .filter(Boolean) as Recommendation[];

    // 5. 按评分排序
    recommendations.sort((a, b) => b.score - a.score);

    // 6. 分类：新推荐 + 替换建议
    const newRecs = recommendations.filter((r) => !userWatchlist.includes(r.id));
    const replaceRecs = recommendations.filter((r) => userWatchlist.includes(r.id));

    // 7. 找出 watchlist 中表现最差的（可替换）
    const userPositions = userWatchlist
      .map((id) => SECURITY_BY_ID[id])
      .filter(Boolean);
    const userScans = scanned.filter((s) => userWatchlist.includes(s.id));
    const worst = userScans.length > 0
      ? userScans.reduce((worst, s) => (s.recent20Change < worst.recent20Change ? s : worst), userScans[0])
      : null;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total: recommendations.length,
      recommendations: recommendations.slice(0, limit),
      newRecommendations: newRecs.slice(0, 10),
      replaceSuggestions: worst
        ? [{
            replaceId: worst.id,
            replaceName: worst.name,
            reason: `近20日跌幅 ${worst.recent20Change.toFixed(2)}%，是当前持仓中表现最差的`,
            candidates: newRecs.slice(0, 3).map((r) => ({
              id: r.id, name: r.name, code: r.code, score: r.score, reasons: r.reasons.slice(0, 2),
            })),
          }]
        : [],
      addSuggestions: newRecs.slice(0, 5).map((r) => ({
        id: r.id, name: r.name, code: r.code, score: r.score, action: r.action,
        reason: r.reasons[0],
      })),
      scannedCount: scanned.length,
      newsKeywordsMatched: newsKeywords,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
