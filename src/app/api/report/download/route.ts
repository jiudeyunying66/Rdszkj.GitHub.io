// 报告生成与下载接口（含图表嵌入）
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { ETF_CONFIGS } from '@/lib/etf-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const CHARTS_SCRIPT = resolve(process.cwd(), 'scripts/report/charts.py');

async function generateCharts(data: any): Promise<Record<string, string>> {
  return new Promise((resolvePromise) => {
    const py = spawn(PYTHON, [CHARTS_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });
    let stdout = '';
    let stderr = '';
    py.stdout.on('data', (c) => (stdout += c.toString()));
    py.stderr.on('data', (c) => (stderr += c.toString()));
    py.on('error', () => resolvePromise({}));
    py.on('close', () => {
      try {
        const result = JSON.parse(stdout);
        resolvePromise(result.charts || {});
      } catch {
        resolvePromise({});
      }
    });
    const timeout = setTimeout(() => {
      py.kill('SIGKILL');
      resolvePromise({});
    }, 60000);
    py.on('close', () => clearTimeout(timeout));
    py.stdin.write(JSON.stringify(data));
    py.stdin.end();
  });
}

interface ReportRequest {
  type: 'daily' | 'pre-close' | 'post-close' | 'backtest';
  format: 'markdown' | 'html' | 'json';
  data: {
    quotes?: any[];
    klines?: any[];
    news?: any[];
    govNews?: any[];
    backtest?: any;
    userConfig?: any;
  };
  charts?: Record<string, string>;  // Base64 PNG
}

function fmtMoney(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function now() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

// 生成 Markdown 报告
function generateMarkdownReport(req: ReportRequest): string {
  const { type, data, charts = {} } = req;
  const quotes = data.quotes || [];
  const klines = data.klines || [];
  const news = data.news || [];
  const govNews = data.govNews || [];
  const userConfig = data.userConfig || {};
  const backtest = data.backtest;

  const totalMarketValue = quotes.reduce((s, q) => {
    const pos = userConfig.positions?.[q.id];
    return s + (pos ? pos.shares * q.currentPrice : 0);
  }, 0);
  const totalCost = quotes.reduce((s, q) => {
    const pos = userConfig.positions?.[q.id];
    return s + (pos ? pos.costPrice * pos.shares : 0);
  }, 0);
  const totalPnl = totalMarketValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const todayPnl = quotes.reduce((s, q) => {
    const pos = userConfig.positions?.[q.id];
    return s + (pos ? q.change * pos.shares : 0);
  }, 0);
  const cashReserve = userConfig.cashReserve || 500;
  const totalAssets = totalMarketValue + cashReserve;

  const titleMap = {
    'daily': '日报',
    'pre-close': '收盘前总结',
    'post-close': '盘后复盘',
    'backtest': '历史回测报告',
  };

  let md = `# 市场数据监测系统 · ${titleMap[type] || '报告'}\n\n`;
  md += `> 生成时间：${now()}  \n`;
  md += `> 数据源：腾讯财经(行情) · ifzq(K线) · 东方财富+央行/证监会官网(新闻) · TensorFlow LSTM + ARIMA(预测)\n\n`;
  md += `---\n\n`;

  // 一、组合总览
  md += `## 一、组合总览\n\n`;
  md += `| 指标 | 数值 |\n| --- | --- |\n`;
  md += `| 总资产 | ¥${fmtMoney(totalAssets)} |\n`;
  md += `| 持仓市值 | ¥${fmtMoney(totalMarketValue)} |\n`;
  md += `| 持仓成本 | ¥${fmtMoney(totalCost)} |\n`;
  md += `| 累计盈亏 | ${totalPnl >= 0 ? '+' : ''}¥${fmtMoney(totalPnl)} (${fmtPct(totalPnlPct)}) |\n`;
  md += `| 今日盈亏 | ${todayPnl >= 0 ? '+' : ''}¥${fmtMoney(todayPnl)} |\n`;
  md += `| 备用金 | ¥${fmtMoney(cashReserve)} |\n`;
  md += `| 仓位占比 | ${totalAssets > 0 ? (totalMarketValue / totalAssets * 100).toFixed(1) : 0}% |\n\n`;

  // 嵌入：今日涨跌幅图
  if (charts.today_change) {
    md += `### 今日涨跌幅可视化\n\n`;
    md += `![今日涨跌幅](data:image/png;base64,${charts.today_change})\n\n`;
  }

  // 嵌入：资金分配饼图
  if (charts.capital_allocation) {
    md += `### 资金分配可视化\n\n`;
    md += `![资金分配](data:image/png;base64,${charts.capital_allocation})\n\n`;
  }

  // 二、持仓明细
  md += `## 二、持仓明细\n\n`;
  md += `| ETF | 代码 | 类型 | 持仓 | 现价 | 成本 | 持仓盈亏 | 今日涨跌 | 量比 | 趋势 |\n`;
  md += `| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | :--- |\n`;
  for (const cfg of ETF_CONFIGS) {
    const q = quotes.find((x) => x.id === cfg.id);
    const k = klines.find((x) => x.id === cfg.id);
    const pos = userConfig.positions?.[cfg.id];
    if (!q || !pos) continue;
    const pnl = (q.currentPrice - pos.costPrice) * pos.shares;
    const pnlPct = pos.costPrice > 0 ? ((q.currentPrice - pos.costPrice) / pos.costPrice) * 100 : 0;
    md += `| ${cfg.name} | ${cfg.code} | ${cfg.category === 'core' ? '核心底仓' : '卫星'} | ${pos.shares} | ${q.currentPrice.toFixed(3)} | ${pos.costPrice.toFixed(3)} | ${pnl >= 0 ? '+' : ''}¥${fmtMoney(pnl)} (${fmtPct(pnlPct)}) | ${fmtPct(q.changePercent)} | ${k?.volumeRatio.toFixed(2) || '-'} | ${k?.trend || '-'} |\n`;
  }
  md += `\n`;

  // 嵌入：持仓盈亏分布图
  if (charts.positions_pnl) {
    md += `### 持仓盈亏分布\n\n`;
    md += `![持仓盈亏](data:image/png;base64,${charts.positions_pnl})\n\n`;
  }

  // 三、技术面分析
  if (klines.length > 0) {
    md += `## 三、技术面分析\n\n`;
    md += `| ETF | MA5 | MA10 | MA20 | MACD | KDJ.K | KDJ.J | RSI6 | 趋势 |\n`;
    md += `| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |\n`;
    for (const k of klines) {
      const ind = k.indicators || {};
      const cfg = ETF_CONFIGS.find((x) => x.id === k.id);
      md += `| ${cfg?.name || k.id} | ${ind.ma5 || 0} | ${ind.ma10 || 0} | ${ind.ma20 || 0} | ${ind.macd || 0} | ${(ind.kdjK || 0).toFixed(1)} | ${(ind.kdjJ || 0).toFixed(1)} | ${(ind.rsi6 || 0).toFixed(1)} | ${k.trend || '-'} |\n`;
    }
    md += `\n**趋势说明**：多头 = 价格>MA5>MA10且DIF>DEA；空头 = 价格<MA5<MA10且DIF<DEA；震荡 = 其他。\n\n`;

    // 嵌入：K线走势图
    if (charts.kline_trend) {
      md += `### 走势图（沪深300 近30日）\n\n`;
      md += `![走势图](data:image/png;base64,${charts.kline_trend})\n\n`;
    }
  }

  // 四、宏观信息
  if (govNews.length > 0 || news.length > 0) {
    md += `## 四、宏观信息汇总\n\n`;
    if (govNews.length > 0) {
      md += `### 官网直连权威源（权重 ≥60%）\n\n`;
      for (const n of govNews.slice(0, 8)) {
        md += `- **[${n.source}]** ${n.title}\n`;
        md += `  - 时间：${n.date} · 情绪：${n.sentiment}(${n.sentimentScore}) · 关联：${n.relatedEtfs.join(', ') || '无'}\n`;
        if (n.url) md += `  - 链接：${n.url}\n`;
      }
      md += `\n`;
    }
    if (news.length > 0) {
      md += `### 财经媒体报道（东方财富聚合）\n\n`;
      for (const n of news.slice(0, 10)) {
        md += `- **[${n.authoritySource}]** ${n.title}\n`;
        md += `  - 时间：${n.date} · 情绪：${n.sentiment}(${n.sentimentScore}) · 影响：${n.impact}\n`;
      }
      md += `\n`;
    }
  }

  // 五、回测结果（如果是回测报告）
  if (backtest) {
    md += `## 五、历史回测结果\n\n`;
    md += `| 指标 | 数值 |\n| --- | --- |\n`;
    md += `| 初始资金 | ¥${fmtMoney(backtest.stats.initialValue)} |\n`;
    md += `| 最终市值 | ¥${fmtMoney(backtest.stats.finalValue)} |\n`;
    md += `| 策略总收益 | ${fmtPct(backtest.stats.totalReturn)} |\n`;
    md += `| 年化收益 | ${fmtPct(backtest.stats.annualReturn)} |\n`;
    md += `| 基准收益 | ${fmtPct(backtest.stats.benchmarkReturn)} |\n`;
    md += `| 超额收益 | ${fmtPct(backtest.stats.excessReturn)} |\n`;
    md += `| 夏普比率 | ${backtest.stats.sharpeRatio.toFixed(2)} |\n`;
    md += `| 最大回撤 | ${backtest.stats.maxDrawdown.toFixed(2)}% (${backtest.stats.maxDrawdownDate}) |\n`;
    md += `| 年化波动率 | ${backtest.stats.volatility.toFixed(2)}% |\n`;
    md += `| 交易次数 | ${backtest.stats.totalTrades} (买${backtest.stats.buyTrades}/卖${backtest.stats.sellTrades}) |\n`;
    md += `| 胜率 | ${backtest.stats.winRate.toFixed(1)}% |\n`;
    md += `| 回测天数 | ${backtest.stats.tradingDays} 个交易日 |\n\n`;

    md += `### 各 ETF 回测统计\n\n`;
    md += `| ETF | 交易次数 | 买/卖 | 最终持仓 | 平均成本 | 盈亏 | 盈亏% |\n`;
    md += `| --- | ---: | --- | ---: | ---: | ---: | ---: |\n`;
    for (const p of backtest.perEtf) {
      md += `| ${p.etfName} | ${p.trades} | ${p.buyCount}/${p.sellCount} | ${p.finalShares} | ${p.avgCost.toFixed(3)} | ${p.pnl >= 0 ? '+' : ''}¥${fmtMoney(p.pnl)} | ${fmtPct(p.pnlPercent)} |\n`;
    }
    md += `\n`;
  }

  // 六、操作建议
  md += `## ${backtest ? '六' : '五'}、操作建议（仅分析，不执行）\n\n`;
  for (const cfg of ETF_CONFIGS) {
    const q = quotes.find((x) => x.id === cfg.id);
    const pos = userConfig.positions?.[cfg.id];
    if (!q || !pos) continue;
    const pnlPct = pos.costPrice > 0 ? ((q.currentPrice - pos.costPrice) / pos.costPrice) * 100 : 0;
    md += `### ${cfg.name}（${cfg.code}）\n`;
    if (pnlPct >= pos.takeProfitLine) {
      md += `- 🟢 **止盈信号**：持仓盈亏 ${pnlPct.toFixed(2)}% 已达止盈线 +${pos.takeProfitLine}%，建议卖出整百股\n`;
    } else if (pnlPct <= pos.addLine2) {
      md += `- 🔴 **二级加仓信号**：持仓盈亏 ${pnlPct.toFixed(2)}% 已破二级加仓线 ${pos.addLine2}%，建议加大建仓力度（200股/次）\n`;
    } else if (pnlPct <= pos.addLine1) {
      md += `- 🟡 **一级加仓信号**：持仓盈亏 ${pnlPct.toFixed(2)}% 已触发一级加仓线 ${pos.addLine1}%，可考虑分批建仓（100股/次）\n`;
    } else {
      md += `- ⚪ **持有观望**：持仓盈亏 ${pnlPct.toFixed(2)}%，未触发加仓/止盈线，建议持有\n`;
    }
    if (Math.abs(q.changePercent) >= 4) {
      md += `- ⚠️ **波动预警**：今日涨跌 ${q.changePercent.toFixed(2)}%，突破 4% 重大波动阈值\n`;
    }
    md += `\n`;
  }

  // 七、风险提示
  md += `## ${backtest ? '七' : '六'}、风险提示\n\n`;
  md += `1. 本系统所有流程均为**分析+汇报**，不执行交易，数据仅供参考，决策需用户自行判断。\n`;
  md += `2. 预测模型（ARIMA + LSTM）基于历史数据，未来表现不保证。\n`;
  md += `3. 宏观信息来自央行/证监会官网直连 + 东方财富搜索，已按权重分级（官方90% > 财经70% > 行业50%）。\n`;
  md += `4. 历史回测结果不代表未来收益，市场存在不确定性。\n\n`;
  md += `---\n\n`;
  md += `*报告由 市场数据监测系统 v4.0 自动生成 · ${now()}*\n`;

  return md;
}

// 生成 HTML 报告（含样式，可直接打印为 PDF）
function generateHtmlReport(req: ReportRequest): string {
  const md = generateMarkdownReport(req);
  // 简单的 Markdown → HTML 转换
  let html = md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hupl])(.+)$/gm, '<p>$1</p>');

  // 表格转换 - 用更安全的正则避免字符类范围问题
  const tableRegex = /^\| (.+) \|\n\| [-: |]+\|\n((?:\| .+ \|\n?)+)/gm;
  html = html.replace(tableRegex, (_: string, header: string, rows: string) => {
    const hCells = header.split('|').map((c: string) => `<th>${c.trim()}</th>`).join('');
    const rCells = rows.trim().split('\n').map((r: string) => {
      const cells = r.split('|').slice(1, -1).map((c: string) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${hCells}</tr></thead><tbody>${rCells}</tbody></table>`;
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>市场数据监测系统报告</title>
<style>
  body { font-family: -apple-system, "Noto Sans SC", sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; color: #1a1a1a; line-height: 1.6; }
  h1 { color: #b8860b; border-bottom: 2px solid #b8860b; padding-bottom: 8px; }
  h2 { color: #444; margin-top: 24px; border-left: 4px solid #b8860b; padding-left: 8px; }
  h3 { color: #666; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  tr:nth-child(even) { background: #fafafa; }
  blockquote { border-left: 3px solid #b8860b; padding-left: 12px; color: #666; margin: 8px 0; }
  ul { padding-left: 20px; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  strong { color: #b8860b; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>${html}</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const req: ReportRequest = await request.json();
    const { type, format, data } = req;

    if (format === 'json') {
      return NextResponse.json({
        type, format, generatedAt: now(), data,
      });
    }

    // 先生成图表（Base64 PNG）
    let charts: Record<string, string> = {};
    try {
      charts = await generateCharts(data);
    } catch (e) {
      console.error('[report] 图表生成失败:', e);
    }

    // 把图表嵌入请求
    const reqWithCharts = { ...req, charts };

    if (format === 'markdown') {
      const md = generateMarkdownReport(reqWithCharts);
      const filename = `ETF报告_${type}_${new Date().toISOString().slice(0, 10)}.md`;
      return new Response(md, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    }

    if (format === 'html') {
      const html = generateHtmlReport(reqWithCharts);
      const filename = `ETF报告_${type}_${new Date().toISOString().slice(0, 10)}.html`;
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    }

    return NextResponse.json({ error: '不支持的格式' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    usage: 'POST /api/report/download with {type, format, data}',
    types: ['daily', 'pre-close', 'post-close', 'backtest'],
    formats: ['markdown', 'html', 'json'],
  });
}
