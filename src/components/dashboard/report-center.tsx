'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText, Download, Eye, CheckCircle2, AlertTriangle, AlertOctagon, Info, Clock, Loader2, Printer, FileCode,
} from 'lucide-react';
import type { ExceptionCase, AlertLevel } from '@/lib/types';
import { useQuotes, useKlines, useNews } from '@/lib/use-market-data';
import { useUserConfig } from '@/lib/use-user-config';
import { ETF_CONFIGS } from '@/lib/etf-config';

interface ReportType {
  id: string;
  type: 'daily' | 'pre-close' | 'post-close' | 'backtest';
  title: string;
  description: string;
  icon: React.ReactNode;
}

const REPORT_TYPES: ReportType[] = [
  {
    id: 'daily',
    type: 'daily',
    title: '日报',
    description: '当日持仓、行情、宏观、操作建议汇总',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: 'pre-close',
    type: 'pre-close',
    title: '收盘前总结',
    description: '14:50 触发，含次日预测与操作建议',
    icon: <Clock className="h-4 w-4" />,
  },
  {
    id: 'post-close',
    type: 'post-close',
    title: '盘后复盘',
    description: '16:30 触发，含技术分析与3日预测',
    icon: <Eye className="h-4 w-4" />,
  },
];

function levelStyle(l: AlertLevel) {
  if (l === 'critical') return { color: 'var(--up)', Icon: AlertOctagon };
  if (l === 'warn') return { color: 'var(--warn)', Icon: AlertTriangle };
  return { color: 'var(--info)', Icon: Info };
}

export function ReportCenter({ exceptions }: { exceptions: ExceptionCase[] }) {
  const { data: quoteData } = useQuotes();
  const { data: klineData } = useKlines();
  const { data: newsData } = useNews();
  const { config } = useUserConfig();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleDownload = async (type: string, format: 'markdown' | 'html') => {
    setDownloading(`${type}-${format}`);
    try {
      const r = await fetch('/api/report/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          format,
          data: {
            quotes: quoteData?.quotes || [],
            klines: klineData?.data || [],
            news: newsData?.data || [],
            userConfig: config,
          },
        }),
      });
      if (!r.ok) throw new Error('下载失败');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'markdown' ? 'md' : 'html';
      a.download = `ETF报告_${type}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`下载失败: ${e.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const handlePreview = async (type: string) => {
    setDownloading(`${type}-preview`);
    try {
      const r = await fetch('/api/report/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          format: 'markdown',
          data: {
            quotes: quoteData?.quotes || [],
            klines: klineData?.data || [],
            news: newsData?.data || [],
            userConfig: config,
          },
        }),
      });
      if (!r.ok) throw new Error('预览失败');
      const text = await r.text();
      setPreview(text);
    } catch (e: any) {
      alert(`预览失败: ${e.message}`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 报告生成器 */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-info" />
              <CardTitle className="text-sm">报告生成与导出</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px]">含真实数据 · 可下载</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {REPORT_TYPES.map((rt) => (
              <div key={rt.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-info/10 text-info">
                      {rt.icon}
                    </span>
                    <div>
                      <div className="text-sm font-medium">{rt.title}</div>
                      <div className="text-[10px] text-muted-foreground">{rt.description}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[10px]"
                    onClick={() => handlePreview(rt.type)}
                    disabled={downloading === `${rt.type}-preview`}
                  >
                    {downloading === `${rt.type}-preview` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                    预览
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[10px]"
                    onClick={() => handleDownload(rt.type, 'markdown')}
                    disabled={downloading === `${rt.type}-markdown`}
                  >
                    {downloading === `${rt.type}-markdown` ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileCode className="h-3 w-3" />}
                    .md
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[10px]"
                    onClick={() => handleDownload(rt.type, 'html')}
                    disabled={downloading === `${rt.type}-html`}
                  >
                    {downloading === `${rt.type}-html` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    .html
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-md border border-info/30 bg-info/5 p-2 text-[10px] text-muted-foreground">
            <strong className="text-info">导出说明</strong>：
            <span className="ml-1">.md 文件可在 Typora/Obsidian/VSCode 中查看；</span>
            <span className="ml-1">.html 文件可在浏览器中打开，支持 Ctrl+P 直接打印为 PDF（推荐）。</span>
            <span className="ml-1">所有数据基于实时行情、K线、新闻自动填充，无需手动编辑。</span>
          </div>
        </CardContent>
      </Card>

      {/* 预览区 */}
      {preview && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">报告预览（Markdown 渲染）</CardTitle>
              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setPreview(null)}>
                关闭
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="report-preview prose prose-sm prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-lg font-bold text-primary border-b border-border pb-2 mb-4">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold text-foreground mt-4 mb-2 border-l-4 border-primary pl-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-3 mb-1">{children}</h3>,
                    p: ({ children }) => <p className="text-xs leading-relaxed text-foreground/90 mb-2">{children}</p>,
                    ul: ({ children }) => <ul className="text-xs text-foreground/90 mb-2 list-disc pl-5 space-y-0.5">{children}</ul>,
                    li: ({ children }) => <li className="text-xs">{children}</li>,
                    strong: ({ children }) => <strong className="font-bold text-primary">{children}</strong>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-info pl-3 text-[11px] text-muted-foreground italic mb-3">{children}</blockquote>,
                    hr: () => <hr className="border-border my-4" />,
                    table: ({ children }) => <table className="w-full text-[11px] border-collapse my-3">{children}</table>,
                    thead: ({ children }) => <thead className="bg-primary/15">{children}</thead>,
                    th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-semibold text-foreground">{children}</th>,
                    td: ({ children }) => <td className="border border-border/60 px-2 py-1 text-foreground/80">{children}</td>,
                    img: ({ src, alt }) => {
                      // 过滤空 src，避免 React 警告
                      if (!src || src === '') return null;
                      return (
                        <img
                          src={src as string}
                          alt={alt as string}
                          className="my-3 max-w-full rounded-lg border border-border"
                          style={{ display: 'block', margin: '12px auto' }}
                        />
                      );
                    },
                  }}
                >
                  {preview}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* 异常处理 */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warn" />
            <CardTitle className="text-sm">异常处理与人工干预</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {exceptions.map((ex) => {
              const ls = levelStyle(ex.level);
              const LIcon = ls.Icon;
              return (
                <div
                  key={ex.id}
                  className="rounded-md border p-3"
                  style={{ borderColor: `${ls.color}30`, background: `${ls.color}08` }}
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <LIcon className="h-4 w-4" style={{ color: ls.color }} />
                    <span className="text-sm font-medium">{ex.scenario}</span>
                  </div>
                  <div className="text-xs leading-relaxed text-muted-foreground">{ex.handling}</div>
                  <div className="mt-2 flex items-center gap-1.5 border-t border-border/50 pt-1.5 text-[10px]">
                    <span className="text-muted-foreground">通知方式：</span>
                    <Badge variant="outline" className="text-[10px]" style={{ color: ls.color, borderColor: `${ls.color}40` }}>
                      {ex.notifyMethod}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 历史报告列表 */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-info" />
              <CardTitle className="text-sm">历史报告</CardTitle>
              <Badge variant="secondary" className="text-[10px]">3 份</Badge>
            </div>
            <div className="text-[10px] text-muted-foreground">汇报渠道：邮件 / APP推送 / 微信</div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[280px] pr-3">
            <div className="space-y-2.5">
              {[
                { id: 'rpt-20260626-pre', title: '2026-06-26 收盘前总结报告', time: '14:50（待生成）', status: 'pending', type: 'pre-close' },
                { id: 'rpt-20260626-post', title: '2026-06-26 盘后复盘报告', time: '16:30（待生成）', status: 'pending', type: 'post-close' },
                { id: 'rpt-20260625-post', title: '2026-06-25 盘后复盘报告', time: '昨日 16:30', status: 'completed', type: 'post-close' },
              ].map((r) => (
                <div
                  key={r.id}
                  className="rounded-md border border-border bg-background/30 p-3 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-info" />
                      <div>
                        <div className="text-sm font-medium leading-snug">{r.title}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" /> {r.time}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {r.status === 'completed' ? (
                        <Badge variant="outline" className="gap-1 border-down/40 text-down">
                          <CheckCircle2 className="h-3 w-3" /> 已生成
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-warn/40 text-warn">
                          <Clock className="h-3 w-3" /> 待生成
                        </Badge>
                      )}
                    </div>
                  </div>
                  {r.status === 'completed' && (
                    <div className="mt-2 flex items-center gap-1.5 pl-6">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 gap-1 px-2 text-[10px]"
                        onClick={() => handleDownload(r.type, 'markdown')}
                      >
                        <FileCode className="h-3 w-3" /> 下载 .md
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 gap-1 px-2 text-[10px]"
                        onClick={() => handleDownload(r.type, 'html')}
                      >
                        <Download className="h-3 w-3" /> 下载 .html
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
