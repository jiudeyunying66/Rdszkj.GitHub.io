// 政府/央行权威源直连接口
// 数据源: 央行官网公告 + 证监会要闻 + CSIS 分析 + 东方财富备份
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface GovNewsItem {
  id: string;
  title: string;
  content: string;
  date: string;
  source: string;          // 央行/证监会/CSIS 等
  sourceType: 'official' | 'geopolitical';
  sourceWeight: number;    // 权重 90/60/50
  url: string;
  relatedEtfs: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  impact: 'high' | 'medium' | 'low';
}

const ETF_KEYWORDS = [
  { id: 'csi300', name: '沪深300ETF', keywords: ['沪深300', '大盘', '蓝筹', '指数', '市场'] },
  { id: 'ai', name: '人工智能ETF', keywords: ['人工智能', 'AI', '大模型', '算力', '智能'] },
  { id: 'chip', name: '芯片ETF', keywords: ['芯片', '半导体', '集成电路', '国产替代'] },
  { id: 'battery', name: '电池ETF', keywords: ['电池', '新能源', '宁德', '储能', '锂电'] },
  { id: 'robot', name: '机器人ETF', keywords: ['机器人', '人形', '智能制造', '工业4.0'] },
];

const POSITIVE_KW = ['利好', '增长', '支持', '扶持', '减税', '降息', '降准', '投入', '刺激', '加速', '创新', '复苏', '提振'];
const NEGATIVE_KW = ['利空', '风险', '限制', '管制', '制裁', '冲突', '不及预期', '疲软', '下行', '警告', '严控'];

function analyzeSentiment(text: string): { sentiment: 'positive' | 'negative' | 'neutral'; sentimentScore: number } {
  let pos = 0, neg = 0;
  for (const kw of POSITIVE_KW) if (text.includes(kw)) pos++;
  for (const kw of NEGATIVE_KW) if (text.includes(kw)) neg++;
  if (pos > neg) return { sentiment: 'positive', sentimentScore: Math.min(0.9, 0.3 + (pos - neg) * 0.15) };
  if (neg > pos) return { sentiment: 'negative', sentimentScore: Math.max(-0.9, -0.3 - (neg - pos) * 0.15) };
  return { sentiment: 'neutral', sentimentScore: 0 };
}

function findRelatedEtfs(text: string): string[] {
  const related: string[] = [];
  for (const cfg of ETF_KEYWORDS) {
    for (const kw of cfg.keywords) {
      if (text.includes(kw)) {
        if (!related.includes(cfg.id)) related.push(cfg.id);
        break;
      }
    }
  }
  return related;
}

// ===== 央行官网公告抓取 =====
async function fetchPbcNews(): Promise<GovNewsItem[]> {
  try {
    const resp = await fetch('http://www.pbc.gov.cn/goutongjiaoliu/113456/113469/index.html', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      cache: 'no-store',
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    // 提取链接和标题
    const matches = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]{8,100})<\/a>/g)];
    const items: GovNewsItem[] = [];
    for (const m of matches) {
      const href = m[1];
      const title = m[2].trim();
      // 仅保留央行公告链接
      if (!href.includes('/goutongjiaoliu/') && !href.includes('/zhengcehuobisi/')) continue;
      if (title.length < 8) continue;
      const fullUrl = href.startsWith('http') ? href : `http://www.pbc.gov.cn${href}`;
      const text = title;
      const { sentiment, sentimentScore } = analyzeSentiment(text);
      const relatedEtfs = findRelatedEtfs(text);
      // 从 URL 提取日期
      const dateMatch = href.match(/(\d{4})(\d{2})(\d{2})/);
      const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString().slice(0, 10);
      items.push({
        id: `pbc-${items.length}-${title.slice(0, 15)}-${href.slice(-12)}`,
        title,
        content: title, // 详情需另抓取
        date: `${date} ${new Date().toTimeString().slice(0, 8)}`,
        source: '中国人民银行',
        sourceType: 'official',
        sourceWeight: 90,
        url: fullUrl,
        relatedEtfs,
        sentiment,
        sentimentScore: Number(sentimentScore.toFixed(2)),
        impact: 'high',
      });
      if (items.length >= 8) break;
    }
    return items;
  } catch (e) {
    console.error('[gov-news] 央行抓取失败:', e);
    return [];
  }
}

// ===== 证监会要闻抓取 =====
async function fetchCsrcNews(): Promise<GovNewsItem[]> {
  try {
    const resp = await fetch('http://www.csrc.gov.cn/pub/newsite/zjhxwxx/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      cache: 'no-store',
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const matches = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]{10,150})<\/a>/g)];
    const items: GovNewsItem[] = [];
    const seen = new Set<string>();
    for (const m of matches) {
      const href = m[1];
      const title = m[2].trim();
      if (!href.includes('/csrc/') && !href.includes('/pub/')) continue;
      if (title.length < 10) continue;
      if (seen.has(title)) continue;
      seen.add(title);
      const fullUrl = href.startsWith('http') ? href : `http://www.csrc.gov.cn${href}`;
      const { sentiment, sentimentScore } = analyzeSentiment(title);
      const relatedEtfs = findRelatedEtfs(title);
      // 提取日期（如果有）
      const dateMatch = html.match(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*?(\\d{4}-\\d{2}-\\d{2})`));
      const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
      items.push({
        id: `csrc-${items.length}-${title.slice(0, 15)}-${href.slice(-12)}`,
        title,
        content: title,
        date: `${date} ${new Date().toTimeString().slice(0, 8)}`,
        source: '中国证监会',
        sourceType: 'official',
        sourceWeight: 90,
        url: fullUrl,
        relatedEtfs,
        sentiment,
        sentimentScore: Number(sentimentScore.toFixed(2)),
        impact: 'high',
      });
      if (items.length >= 8) break;
    }
    return items;
  } catch (e) {
    console.error('[gov-news] 证监会抓取失败:', e);
    return [];
  }
}

// ===== CSIS 地缘分析抓取 =====
async function fetchCsisNews(): Promise<GovNewsItem[]> {
  try {
    const resp = await fetch('https://www.csis.org/analysis', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      cache: 'no-store',
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    // CSIS 页面分析文章标题
    const matches = [...html.matchAll(/<a[^>]*href="(\/analysis\/[^"]+)"[^>]*>([^<]{15,150})<\/a>/g)];
    const items: GovNewsItem[] = [];
    const seen = new Set<string>();
    for (const m of matches) {
      const href = m[1];
      const title = m[2].trim();
      if (title.length < 15) continue;
      if (seen.has(title)) continue;
      seen.add(title);
      // 过滤中国/亚洲/技术相关
      const isRelevant = /china|chinese|asia|asian|tech|semiconductor|trade|sanction|taiwan|supply chain/i.test(title);
      if (!isRelevant) continue;
      const fullUrl = `https://www.csis.org${href}`;
      const { sentiment, sentimentScore } = analyzeSentiment(title);
      const relatedEtfs = findRelatedEtfs(title);
      items.push({
        id: `csis-${items.length}-${title.slice(0, 15)}-${href.slice(-12)}`,
        title,
        content: title,
        date: new Date().toISOString().slice(0, 10),
        source: 'CSIS 地缘',
        sourceType: 'geopolitical',
        sourceWeight: 50,
        url: fullUrl,
        relatedEtfs,
        sentiment,
        sentimentScore: Number(sentimentScore.toFixed(2)),
        impact: 'high',
      });
      if (items.length >= 5) break;
    }
    return items;
  } catch (e) {
    console.error('[gov-news] CSIS 抓取失败:', e);
    return [];
  }
}

// ===== 国家统计局数据发布抓取 =====
async function fetchStatsNews(): Promise<GovNewsItem[]> {
  try {
    const resp = await fetch('https://www.stats.gov.cn/sj/zxfb/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const matches = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]{10,150})<\/a>/g)];
    const items: GovNewsItem[] = [];
    const seen = new Set<string>();
    for (const m of matches) {
      const href = m[1];
      const title = m[2].trim();
      if (title.length < 10) continue;
      // 仅保留统计数据相关
      const isRelevant = /GDP|CPI|PPI|PMI|工业|收入|消费|投资|增加值|利润|价格|生产资料|进出口|就业|采购/.test(title);
      if (!isRelevant) continue;
      if (seen.has(title)) continue;
      seen.add(title);
      const fullUrl = href.startsWith('http') ? href : `https://www.stats.gov.cn/sj/zxfb/${href.replace(/^\.\//, '')}`;
      const { sentiment, sentimentScore } = analyzeSentiment(title);
      const relatedEtfs = findRelatedEtfs(title);
      // 从 URL 提取日期
      const dateMatch = href.match(/(\d{4})(\d{2})(\d{2})/);
      const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString().slice(0, 10);
      items.push({
        id: `stats-${items.length}-${title.slice(0, 15)}-${href.slice(-12)}`,
        title,
        content: title,
        date: `${date} ${new Date().toTimeString().slice(0, 8)}`,
        source: '国家统计局',
        sourceType: 'official',
        sourceWeight: 90,
        url: fullUrl,
        relatedEtfs,
        sentiment,
        sentimentScore: Number(sentimentScore.toFixed(2)),
        impact: 'high',
      });
      if (items.length >= 6) break;
    }
    return items;
  } catch (e) {
    console.error('[gov-news] 统计局抓取失败:', e);
    return [];
  }
}

// ===== 发改委政策抓取 =====
async function fetchNdrcNews(): Promise<GovNewsItem[]> {
  try {
    const resp = await fetch('https://www.ndrc.gov.cn/xxgk/zcfb/tz/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    // 发改委页面用 title 属性
    const matches = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*title="([^"]{10,150})"/g)];
    const items: GovNewsItem[] = [];
    const seen = new Set<string>();
    for (const m of matches) {
      const href = m[1];
      const title = m[2].trim();
      if (title.length < 10) continue;
      if (seen.has(title)) continue;
      seen.add(title);
      const fullUrl = href.startsWith('http') ? href : `https://www.ndrc.gov.cn${href}`;
      const { sentiment, sentimentScore } = analyzeSentiment(title);
      const relatedEtfs = findRelatedEtfs(title);
      items.push({
        id: `ndrc-${items.length}-${title.slice(0, 15)}-${href.slice(-12)}`,
        title,
        content: title,
        date: new Date().toISOString().slice(0, 10),
        source: '国家发改委',
        sourceType: 'official',
        sourceWeight: 90,
        url: fullUrl,
        relatedEtfs,
        sentiment,
        sentimentScore: Number(sentimentScore.toFixed(2)),
        impact: 'high',
      });
      if (items.length >= 5) break;
    }
    return items;
  } catch (e) {
    console.error('[gov-news] 发改委抓取失败:', e);
    return [];
  }
}

export async function GET() {
  try {
    // 并行抓取五源
    const [pbc, csrc, csis, stats, ndrc] = await Promise.all([
      fetchPbcNews(),
      fetchCsrcNews(),
      fetchCsisNews(),
      fetchStatsNews(),
      fetchNdrcNews(),
    ]);

    const all = [...pbc, ...csrc, ...csis, ...stats, ...ndrc].sort((a, b) => (b.date > a.date ? 1 : -1));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total: all.length,
      bySource: {
        pbc: pbc.length,
        csrc: csrc.length,
        csis: csis.length,
        stats: stats.length,
        ndrc: ndrc.length,
      },
      data: all,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
