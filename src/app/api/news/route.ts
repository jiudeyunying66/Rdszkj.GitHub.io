// 多源权威财经新闻接口
// 来源: 东方财富搜索 + 央行/国务院/证监会/CSIS 等权威源关键词标注
import { NextResponse } from 'next/server';
import { ETF_CONFIGS } from '@/lib/etf-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface NewsItem {
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
  // 新增：权威源标注
  authorityLevel: 'official' | 'media' | 'industry' | 'geopolitical' | 'sentiment';
  authoritySource: string;  // 具体权威源（如"央行"、"国务院"、"CSIS"）
  authorityWeight: number;  // 权重 0-100
  rawKeyword: string;       // 命中的搜索关键词
}

// 权威源识别规则
interface AuthorityRule {
  name: string;          // 权威源名称
  level: 'official' | 'media' | 'industry' | 'geopolitical' | 'sentiment';
  weight: number;
  keywords: string[];    // 标题/内容中包含这些关键词则标记为该权威源
}

const AUTHORITY_RULES: AuthorityRule[] = [
  // 官方权威 (权重 90)
  {
    name: '央行',
    level: 'official',
    weight: 90,
    keywords: ['央行', '人民银行', '货币政策', '降准', '降息', '逆回购', 'MLF', 'SLF', '公开市场操作', 'LPR'],
  },
  {
    name: '国务院',
    level: 'official',
    weight: 90,
    keywords: ['国务院', '总理', '常务会议', '政府工作报告', '国务院政策'],
  },
  {
    name: '证监会',
    level: 'official',
    weight: 90,
    keywords: ['证监会', '证监会主席', '注册制', '上市公司监管', '证券法'],
  },
  {
    name: '发改委',
    level: 'official',
    weight: 90,
    keywords: ['发改委', '国家发改委', '产业政策', '重大项目', '投资计划'],
  },
  {
    name: '财政部',
    level: 'official',
    weight: 90,
    keywords: ['财政部', '财政政策', '减税降费', '专项债', '财政赤字'],
  },
  {
    name: '国家统计局',
    level: 'official',
    weight: 90,
    keywords: ['国家统计局', 'GDP', 'CPI', 'PPI', 'PMI', '工业增加值', '社零'],
  },
  // 地缘监测 (权重 50)
  {
    name: 'CSIS 地缘',
    level: 'geopolitical',
    weight: 50,
    keywords: ['CSIS', '地缘', '制裁', '出口管制', '贸易战', '关税', '台海', '南海', '中美关系', '俄乌', '中东'],
  },
  {
    name: '外交部',
    level: 'geopolitical',
    weight: 60,
    keywords: ['外交部', '外交部发言人', '外交关系', '双边会谈'],
  },
  // 行业研究 (权重 50)
  {
    name: '中信证券研报',
    level: 'industry',
    weight: 50,
    keywords: ['中信证券', '研报', '中信建投', '中金公司', '国泰君安', '海通证券'],
  },
  {
    name: '行业协会',
    level: 'industry',
    weight: 50,
    keywords: ['半导体行业协会', '中国汽车工业协会', '行业协会'],
  },
];

// 搜索关键词组（覆盖各权威源）
const SEARCH_GROUPS = [
  { keyword: '央行 货币政策', authority: '央行' },
  { keyword: '国务院 政策', authority: '国务院' },
  { keyword: '证监会 资本市场', authority: '证监会' },
  { keyword: 'PMI GDP 经济数据', authority: '国家统计局' },
  { keyword: '芯片 半导体 出口管制', authority: 'CSIS 地缘' },
  { keyword: '人工智能 AI 产业', authority: '发改委' },
  { keyword: 'ETF 市场 资金', authority: null },
];

const POSITIVE_KW = ['利好', '上涨', '增长', '突破', '反弹', '复苏', '支持', '提振', '扶持', '投资', '投入', '减税', '降息', '降准', '刺激', '加速', '创新高', '牛市'];
const NEGATIVE_KW = ['利空', '下跌', '下滑', '衰退', '风险', '限制', '管制', '制裁', '冲突', '疫情', '暴跌', '熊市', '警告', '质疑', '不及预期', '疲软', '亏损', '暂停', '收紧'];
const HIGH_IMPACT_KW = ['央行', '国务院', '证监会', '发改委', '降准', '降息', '制裁', '管制', 'PMI', 'GDP', 'CPI', '政策', '产业', '改革'];

function analyzeSentiment(title: string, content: string) {
  const text = (title + ' ' + content).toLowerCase();
  let pos = 0, neg = 0;
  for (const kw of POSITIVE_KW) if (text.includes(kw.toLowerCase())) pos++;
  for (const kw of NEGATIVE_KW) if (text.includes(kw.toLowerCase())) neg++;
  if (pos > neg) return { sentiment: 'positive' as const, sentimentScore: Math.min(0.9, 0.3 + (pos - neg) * 0.15) };
  if (neg > pos) return { sentiment: 'negative' as const, sentimentScore: Math.max(-0.9, -0.3 - (neg - pos) * 0.15) };
  return { sentiment: 'neutral' as const, sentimentScore: 0 };
}

function analyzeImpact(title: string, content: string): 'high' | 'medium' | 'low' {
  const text = title + ' ' + content;
  for (const kw of HIGH_IMPACT_KW) if (text.includes(kw)) return 'high';
  return 'medium';
}

function findRelatedEtfs(title: string, content: string): string[] {
  const text = title + ' ' + content;
  const related: string[] = [];
  for (const cfg of ETF_CONFIGS) {
    for (const kw of cfg.keywords) {
      if (text.includes(kw)) {
        if (!related.includes(cfg.id)) related.push(cfg.id);
        break;
      }
    }
  }
  return related;
}

// 检测权威源
function detectAuthority(title: string, content: string, searchAuthority: string | null): {
  authorityLevel: 'official' | 'media' | 'industry' | 'geopolitical' | 'sentiment';
  authoritySource: string;
  authorityWeight: number;
} {
  const text = title + ' ' + content;
  // 优先匹配关键词
  for (const rule of AUTHORITY_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        return {
          authorityLevel: rule.level,
          authoritySource: rule.name,
          authorityWeight: rule.weight,
        };
      }
    }
  }
  // 如果搜索关键词带权威标注，使用之
  if (searchAuthority) {
    const rule = AUTHORITY_RULES.find((r) => r.name === searchAuthority);
    if (rule) {
      return {
        authorityLevel: rule.level,
        authoritySource: rule.name,
        authorityWeight: rule.weight,
      };
    }
  }
  // 默认：财经媒体
  return {
    authorityLevel: 'media',
    authoritySource: '财经媒体',
    authorityWeight: 70,
  };
}

async function searchNews(keyword: string, authority: string | null, pageSize: number = 6): Promise<NewsItem[]> {
  const param = {
    uid: '',
    keyword,
    type: ['cmsArticleWebOld'],
    client: 'web',
    clientType: 'web',
    clientVersion: 'curr',
    param: {
      cmsArticleWebOld: {
        searchScope: 'default',
        sort: 'default',
        pageIndex: 1,
        pageSize,
        preTag: '',
        postTag: '',
      },
    },
  };
  const url = `https://search-api-web.eastmoney.com/search/jsonp?cb=callback&param=${encodeURIComponent(JSON.stringify(param))}`;
  console.log(`[news] 搜索: ${keyword}`);
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://so.eastmoney.com/',
      },
      cache: 'no-store',
    });
    if (!resp.ok) {
      console.error(`[news] HTTP ${resp.status} for ${keyword}`);
      return [];
    }
    const raw = await resp.text();
    const m = raw.match(/^callback\((.+)\);?$/s);
    if (!m) {
      console.error(`[news] 无法匹配 callback for ${keyword}, raw length=${raw.length}`);
      return [];
    }
    const data = JSON.parse(m[1]);
    const articles = data?.result?.cmsArticleWebOld || [];
    console.log(`[news] ${keyword} -> ${articles.length} 篇`);
    return articles.map((a: any, idx: number) => {
      const title = (a.title || '').replace(/<[^>]+>/g, '');
      const content = (a.content || '').replace(/<[^>]+>/g, '');
      const { sentiment, sentimentScore } = analyzeSentiment(title, content);
      const impact = analyzeImpact(title, content);
      const relatedEtfs = findRelatedEtfs(title, content);
      const detectedAuth = detectAuthority(title, content, authority);
      return {
        id: `${a.code || keyword}-${idx}-${(a.title || '').slice(0, 15)}`,
        title,
        content: content.slice(0, 300),
        date: a.date || '',
        source: '东方财富',
        url: a.url || '',
        relatedEtfs,
        sentiment,
        sentimentScore: Number(sentimentScore.toFixed(2)),
        impact,
        authorityLevel: detectedAuth.authorityLevel,
        authoritySource: detectedAuth.authoritySource,
        authorityWeight: detectedAuth.authorityWeight,
        rawKeyword: keyword,
      } as NewsItem;
    });
  } catch (e: any) {
    console.error(`[news] 搜索异常 ${keyword}:`, e.message);
    return [];
  }
}

export async function GET() {
  try {
    // 串行请求避免触发限流
    const allResults: NewsItem[][] = [];
    for (const g of SEARCH_GROUPS) {
      try {
        const items = await searchNews(g.keyword, g.authority, 6);
        allResults.push(items);
      } catch (e) {
        allResults.push([]);
      }
    }

    const seen = new Set<string>();
    const merged: NewsItem[] = [];
    for (const list of allResults) {
      for (const item of list) {
        const key = item.title.slice(0, 30);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
    }

    merged.sort((a, b) => (b.date > a.date ? 1 : -1));

    const stats = {
      total: merged.length,
      byAuthority: {
        official: merged.filter((m) => m.authorityLevel === 'official').length,
        media: merged.filter((m) => m.authorityLevel === 'media').length,
        industry: merged.filter((m) => m.authorityLevel === 'industry').length,
        geopolitical: merged.filter((m) => m.authorityLevel === 'geopolitical').length,
      },
      byImpact: {
        high: merged.filter((m) => m.impact === 'high').length,
        medium: merged.filter((m) => m.impact === 'medium').length,
        low: merged.filter((m) => m.impact === 'low').length,
      },
      bySentiment: {
        positive: merged.filter((m) => m.sentiment === 'positive').length,
        negative: merged.filter((m) => m.sentiment === 'negative').length,
        neutral: merged.filter((m) => m.sentiment === 'neutral').length,
      },
      sources: Array.from(new Set(merged.map((m) => m.authoritySource))),
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      total: merged.length,
      data: merged.slice(0, 40),
      stats,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
