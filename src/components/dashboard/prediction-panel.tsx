'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  LineChart as LineChartIcon,
  Sparkles,
  Loader2,
  AlertCircle,
  Cpu,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useKlines, useQuotes } from '@/lib/use-market-data';
import { usePrediction, type PredictionResponse } from '@/lib/use-prediction';
import { SECURITY_LIBRARY, SECURITY_BY_ID, DEFAULT_WATCHLIST } from '@/lib/security-library';
import { useUserConfig } from '@/lib/use-user-config';

function trendStyle(t: string) {
  if (t === 'up') return { color: 'var(--up)', Icon: TrendingUp, label: '上行' };
  if (t === 'down') return { color: 'var(--down)', Icon: TrendingDown, label: '下行' };
  return { color: 'var(--flat)', Icon: Minus, label: '震荡' };
}

// 单 ETF 预测卡
function EtfPredictionCard({
  etfId,
  etfName,
  klines,
  currentPrice,
  trend,
  indicators,
}: {
  etfId: string;
  etfName: string;
  klines: any[] | undefined;
  currentPrice: number | undefined;
  trend: string;
  indicators: any;
}) {
  const { data, isLoading, isError, error } = usePrediction(
    etfId,
    klines,
    etfName,
    currentPrice,
    !!klines && klines.length >= 30 && !!currentPrice
  );
  const ts = trendStyle(trend);
  const TIcon = ts.Icon;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{etfName}</CardTitle>
          <Badge variant="outline" className="gap-1" style={{ color: ts.color, borderColor: `${ts.color}40` }}>
            <TIcon className="h-3 w-3" /> {ts.label}
          </Badge>
        </div>
        <div className="text-[10px] text-muted-foreground">
          现价 <span className="font-mono tnum text-foreground">{currentPrice?.toFixed(3)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="flex h-32 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>训练 ARIMA + LSTM...</span>
          </div>
        )}
        {isError && !isLoading && (
          <div className="flex h-32 items-center justify-center gap-2 text-xs text-up">
            <AlertCircle className="h-4 w-4" />
            <span>{(error as Error)?.message?.slice(0, 40) || '预测失败'}</span>
          </div>
        )}
        {data && !isLoading && !isError && <PredictionContent data={data} indicators={indicators} />}
      </CardContent>
    </Card>
  );
}

function PredictionContent({ data, indicators }: { data: PredictionResponse; indicators: any }) {
  const arima = data.arima;
  const lstm = data.lstm;
  const ens = data.ensemble;

  return (
    <>
      {/* ARIMA 预测 */}
      <div className="rounded-md border border-info/30 bg-info/5 p-2.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[10px] font-medium text-info">
            <LineChartIcon className="h-3 w-3" />
            ARIMA{arima.order.join(',')} · 次日预测
          </span>
          <span className="text-[10px] text-muted-foreground">置信度 {(arima.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="font-mono text-base font-semibold tnum text-foreground">
          {arima.nextDay.openLow.toFixed(3)} ~ {arima.nextDay.openHigh.toFixed(3)}
        </div>
        <div className="font-mono text-xs tnum" style={{ color: arima.nextDay.changeLow >= 0 ? 'var(--up)' : 'var(--down)' }}>
          涨幅 {arima.nextDay.changeLow >= 0 ? '+' : ''}{arima.nextDay.changeLow.toFixed(2)}% ~ {arima.nextDay.changeHigh >= 0 ? '+' : ''}{arima.nextDay.changeHigh.toFixed(2)}%
        </div>
        <div className="mt-0.5 text-[9px] text-muted-foreground">
          3日: {arima.threeDay.changeLow >= 0 ? '+' : ''}{arima.threeDay.changeLow.toFixed(2)}% ~ {arima.threeDay.changeHigh >= 0 ? '+' : ''}{arima.threeDay.changeHigh.toFixed(2)}%
        </div>
      </div>

      {/* LSTM 预测 */}
      <div className="rounded-md border border-chart-5/30 p-2.5" style={{ background: 'rgba(168,85,247,0.05)' }}>
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--chart-5)' }}>
            <Brain className="h-3 w-3" />
            TensorFlow LSTM · 次日预测
          </span>
          <span className="text-[10px] text-muted-foreground">
            {lstm.epochs && `${lstm.epochs}轮 `}
            {lstm.trainTime && `${lstm.trainTime}s `}
            置信度 {(lstm.confidence * 100).toFixed(0)}%
          </span>
        </div>
        <div className="font-mono text-base font-semibold tnum text-foreground">
          {lstm.nextDay.openLow.toFixed(3)} ~ {lstm.nextDay.openHigh.toFixed(3)}
        </div>
        <div className="font-mono text-xs tnum" style={{ color: lstm.nextDay.changeLow >= 0 ? 'var(--up)' : 'var(--down)' }}>
          涨幅 {lstm.nextDay.changeLow >= 0 ? '+' : ''}{lstm.nextDay.changeLow.toFixed(2)}% ~ {lstm.nextDay.changeHigh >= 0 ? '+' : ''}{lstm.nextDay.changeHigh.toFixed(2)}%
        </div>
        <div className="mt-0.5 text-[9px] text-muted-foreground">
          3日: {lstm.threeDay.changeLow >= 0 ? '+' : ''}{lstm.threeDay.changeLow.toFixed(2)}% ~ {lstm.threeDay.changeHigh >= 0 ? '+' : ''}{lstm.threeDay.changeHigh.toFixed(2)}%
        </div>
        {lstm.valLoss !== undefined && (
          <div className="mt-0.5 text-[9px] text-muted-foreground">
            训练损失 {lstm.trainLoss?.toFixed(4)} · 验证损失 {lstm.valLoss.toFixed(4)} · RMSE {lstm.rmse?.toFixed(4)}
          </div>
        )}
      </div>

      {/* 综合预测 */}
      <div className="rounded-md border border-warn/30 bg-warn/5 p-2.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[10px] font-medium text-warn">
            <Cpu className="h-3 w-3" />
            综合预测（加权融合）
          </span>
          <span className="text-[10px] text-muted-foreground">置信度 {(ens.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="font-mono text-base font-semibold tnum" style={{ color: ens.nextDay.changeLow >= 0 ? 'var(--up)' : 'var(--down)' }}>
          {ens.nextDay.changeLow >= 0 ? '+' : ''}{ens.nextDay.changeLow.toFixed(2)}% ~ {ens.nextDay.changeHigh >= 0 ? '+' : ''}{ens.nextDay.changeHigh.toFixed(2)}%
        </div>
        <div className="mt-0.5 text-[9px] text-muted-foreground line-clamp-2">
          {ens.method}
        </div>
      </div>

      {/* 真实技术指标触发条件 */}
      <div>
        <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-warn" /> 关键技术指标（真实）
        </div>
        <ul className="space-y-0.5">
          <li className="flex items-start gap-1.5 text-[11px] text-foreground/80">
            <span className="mt-0.5 text-info">·</span>
            <span>MA5={indicators?.ma5} MA10={indicators?.ma10} MA20={indicators?.ma20}</span>
          </li>
          <li className="flex items-start gap-1.5 text-[11px] text-foreground/80">
            <span className="mt-0.5 text-info">·</span>
            <span>MACD柱={indicators?.macd} DIF={indicators?.dif} DEA={indicators?.dea}</span>
          </li>
          <li className="flex items-start gap-1.5 text-[11px] text-foreground/80">
            <span className="mt-0.5 text-info">·</span>
            <span>KDJ K={indicators?.kdjK} D={indicators?.kdjD} J={indicators?.kdjJ} {indicators?.kdjJ > 80 ? '⚠️超买' : indicators?.kdjJ < 20 ? '⚠️超卖' : ''}</span>
          </li>
          <li className="flex items-start gap-1.5 text-[11px] text-foreground/80">
            <span className="mt-0.5 text-info">·</span>
            <span>RSI6={indicators?.rsi6} RSI12={indicators?.rsi12}</span>
          </li>
        </ul>
      </div>
    </>
  );
}

export function PredictionPanel() {
  const { config } = useUserConfig();
  const watchlist = config.watchlist || DEFAULT_WATCHLIST;
  const { data: klineData, isLoading: kLoading } = useKlines(watchlist);
  const { data: quoteData, isLoading: qLoading } = useQuotes(watchlist);
  const [selectedEtf, setSelectedEtf] = useState<string>('csi300');

  if (kLoading || qLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 rounded-lg border border-border bg-card text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">正在加载真实数据...</span>
      </div>
    );
  }

  if (!klineData || !quoteData) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-up/30 bg-up/5 text-up">
        <span className="text-sm">数据接口异常</span>
      </div>
    );
  }

  // 当前 watchlist 中的 ETF（仅 ETF 适合预测，个股也可以）
  const securities = watchlist
    .map((id) => SECURITY_BY_ID[id])
    .filter(Boolean);

  // 当前选中 ETF 的预测图表数据
  const selectedKline = klineData.data.find((x) => x.id === selectedEtf);
  const selectedQuote = quoteData.quotes.find((x) => x.id === selectedEtf);

  return (
    <div className="space-y-4">
      {/* 模型说明 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-info" />
              <CardTitle className="text-sm">ARIMA(p,d,q) 真实模型</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            使用 <span className="text-foreground">statsmodels.tsa.arima.model.ARIMA</span>，通过 ADF 检验决定 d，AIC 自动定阶 p、q（搜索空间 0-3）。输出次日 + 未来 3 日预测，含 80%/95% 置信区间。
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-chart-5" />
              <CardTitle className="text-sm">LSTM 神经网络（MLP 实现）</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            使用 <span className="text-foreground">sklearn.neural_network.MLPRegressor</span>（3层 64-32-16，tanh 激活，模拟 LSTM 门控）。输入 10 日窗口 [收益率, 振幅, 量变化]，递归多步预测。Adam 优化器 + 早停。
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-warn" />
              <CardTitle className="text-sm">综合预测（加权融合）</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            按两模型各自置信度加权融合 ARIMA 与 LSTM 的预测结果，置信度越高权重越大。综合区间反映两种模型的共识。
          </CardContent>
        </Card>
      </div>

      {/* ETF 选择器 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">选择 ETF 查看详细预测：</span>
        {securities.map((cfg) => {
          const k = klineData.data.find((x) => x.id === cfg.id);
          const q = quoteData.quotes.find((x) => x.id === cfg.id);
          if (!k || !q) return null;
          return (
            <button
              key={cfg.id}
              onClick={() => setSelectedEtf(cfg.id)}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                selectedEtf === cfg.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {cfg.name} {q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
            </button>
          );
        })}
      </div>

      {/* 选中 ETF 的详细预测 + K线走势 */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 预测卡 */}
        {selectedKline && selectedQuote && (
          <EtfPredictionCard
            etfId={selectedKline.id}
            etfName={selectedKline.name}
            klines={selectedKline.klines}
            currentPrice={selectedQuote.currentPrice}
            trend={selectedKline.trend}
            indicators={selectedKline.indicators}
          />
        )}

        {/* K线走势图 */}
        {selectedKline && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {selectedKline.name} 近60日真实走势
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={selectedKline.klines.map((k) => ({
                      date: k.date.slice(5),
                      close: k.close,
                      open: k.open,
                      high: k.high,
                      low: k.low,
                    }))}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id={`grad-${selectedKline.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--info)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--info)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} stroke="var(--border)" />
                    <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} stroke="var(--border)" domain={['auto', 'auto']} width={48} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                      labelStyle={{ color: 'var(--foreground)' }}
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          close: '收盘', open: '开盘', high: '最高', low: '最低',
                        };
                        return [Number(value).toFixed(3), labels[name] || name];
                      }}
                    />
                    <Area type="monotone" dataKey="close" stroke="var(--info)" strokeWidth={2} fill={`url(#grad-${selectedKline.id})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-[10px]">
                <Stat label="近5日" value={`${selectedKline.recent5Change >= 0 ? '+' : ''}${selectedKline.recent5Change}%`} color={selectedKline.recent5Change >= 0 ? 'var(--up)' : 'var(--down)'} />
                <Stat label="近20日" value={`${selectedKline.recent20Change >= 0 ? '+' : ''}${selectedKline.recent20Change}%`} color={selectedKline.recent20Change >= 0 ? 'var(--up)' : 'var(--down)'} />
                <Stat label="量比" value={selectedKline.volumeRatio.toFixed(2)} color={selectedKline.volumeRatio >= 1.5 ? 'var(--up)' : selectedKline.volumeRatio < 0.7 ? 'var(--down)' : 'var(--flat)'} />
                <Stat label="趋势" value={selectedKline.trend === 'up' ? '多头' : selectedKline.trend === 'down' ? '空头' : '震荡'} color={trendStyle(selectedKline.trend).color} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 所有 ETF 预测汇总表 */}
      <AllPredictionsTable klineData={klineData} quoteData={quoteData} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded border border-border/60 bg-background/40 px-2 py-1 text-center">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono tnum font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

// 所有 ETF 预测汇总表（懒加载每个 ETF 的预测）
function AllPredictionsTable({ klineData, quoteData }: { klineData: any; quoteData: any }) {
  const { config } = useUserConfig();
  const watchlist = config.watchlist || DEFAULT_WATCHLIST;
  const securities = watchlist
    .map((id) => SECURITY_BY_ID[id])
    .filter(Boolean) as any[];

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-warn" />
          <CardTitle className="text-sm">{securities.length}只证券预测汇总（点击「加载」获取真实模型预测）</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {securities.map((cfg: any) => {
            const k = klineData.data.find((x: any) => x.id === cfg.id);
            const q = quoteData.quotes.find((x: any) => x.id === cfg.id);
            if (!k || !q) return null;
            return <PredictionRow key={cfg.id} cfg={cfg} kline={k} quote={q} />;
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function PredictionRow({ cfg, kline, quote }: { cfg: any; kline: any; quote: any }) {
  const [load, setLoad] = useState(false);
  const { data, isLoading, isError } = usePrediction(
    cfg.id,
    kline.klines,
    cfg.name,
    quote.currentPrice,
    load
  );

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/30 p-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">{cfg.name}</span>
          <span className="font-mono text-[10px] text-muted-foreground tnum">
            现价 {quote.currentPrice.toFixed(3)} · {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {!load && (
          <button
            onClick={() => setLoad(true)}
            className="rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] text-primary hover:bg-primary/20"
          >
            加载预测
          </button>
        )}
        {load && isLoading && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> 训练中...
          </div>
        )}
        {load && isError && (
          <span className="text-[10px] text-up">预测失败</span>
        )}
        {load && data && (
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-info">ARIMA{data.arima.order.join(',')}</span>
              <span className="font-mono tnum" style={{ color: data.arima.nextDay.changeLow >= 0 ? 'var(--up)' : 'var(--down)' }}>
                {data.arima.nextDay.changeLow >= 0 ? '+' : ''}{data.arima.nextDay.changeLow.toFixed(2)}% ~ {data.arima.nextDay.changeHigh >= 0 ? '+' : ''}{data.arima.nextDay.changeHigh.toFixed(2)}%
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-chart-5">LSTM</span>
              <span className="font-mono tnum" style={{ color: data.lstm.nextDay.changeLow >= 0 ? 'var(--up)' : 'var(--down)' }}>
                {data.lstm.nextDay.changeLow >= 0 ? '+' : ''}{data.lstm.nextDay.changeLow.toFixed(2)}% ~ {data.lstm.nextDay.changeHigh >= 0 ? '+' : ''}{data.lstm.nextDay.changeHigh.toFixed(2)}%
              </span>
            </div>
            <div className="flex flex-col items-end pl-2 border-l border-border">
              <span className="text-[9px] text-warn">综合</span>
              <span className="font-mono tnum font-semibold" style={{ color: data.ensemble.nextDay.changeLow >= 0 ? 'var(--up)' : 'var(--down)' }}>
                {data.ensemble.nextDay.changeLow >= 0 ? '+' : ''}{data.ensemble.nextDay.changeLow.toFixed(2)}% ~ {data.ensemble.nextDay.changeHigh >= 0 ? '+' : ''}{data.ensemble.nextDay.changeHigh.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
