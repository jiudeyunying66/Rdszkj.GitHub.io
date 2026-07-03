'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Wallet,
  Newspaper,
  Activity,
  BrainCircuit,
  SlidersHorizontal,
  FileBarChart,
  History,
  Sparkles,
} from 'lucide-react';

import { DashboardHeader } from '@/components/dashboard/header';
import { KpiRow } from '@/components/dashboard/kpi-row';
import { PositionPanel, Csi300ProgressCard } from '@/components/dashboard/position-panel';
import { CapitalAllocationPanel } from '@/components/dashboard/capital-allocation';
import { MacroInfoFlow } from '@/components/dashboard/macro-info-flow';
import { MonitoringTimeline } from '@/components/dashboard/monitoring-timeline';
import { PredictionPanel } from '@/components/dashboard/prediction-panel';
import { StrategyRulesPanel } from '@/components/dashboard/strategy-rules';
import { ReportCenter } from '@/components/dashboard/report-center';
import { BacktestPanel } from '@/components/dashboard/backtest-panel';
import { RecommendPanel } from '@/components/dashboard/recommend-panel';
import { exceptionCases } from '@/lib/mock-data';

export default function Home() {
  const [activeTab, setActiveTab] = useState('positions');

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="mx-auto max-w-[1600px] space-y-4 px-3 py-4 lg:px-6 lg:py-6">
        <KpiRow />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="overflow-x-auto no-scrollbar">
            <TabsList className="flex h-10 w-max gap-1 rounded-lg border border-border bg-card p-1">
              <TabsTrigger
                value="positions"
                className="flex items-center gap-1.5 rounded-md px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Wallet className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">持仓管理</span>
                <span className="ml-1 rounded bg-secondary px-1 text-[10px] data-[state=active]:bg-primary-foreground/20">核心</span>
              </TabsTrigger>
              <TabsTrigger
                value="macro"
                className="flex items-center gap-1.5 rounded-md px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Newspaper className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">宏观信息流</span>
                <span className="ml-1 rounded bg-info/20 px-1 text-[10px] text-info">实时</span>
              </TabsTrigger>
              <TabsTrigger
                value="monitor"
                className="flex items-center gap-1.5 rounded-md px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Activity className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">监测面板</span>
                <span className="ml-1 rounded bg-up px-1 text-[10px] text-white pulse-warn">实时</span>
              </TabsTrigger>
              <TabsTrigger
                value="predict"
                className="flex items-center gap-1.5 rounded-md px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <BrainCircuit className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">预测分析</span>
                <span className="ml-1 rounded bg-chart-5/20 px-1 text-[10px]" style={{ color: 'var(--chart-5)' }}>TF</span>
              </TabsTrigger>
              <TabsTrigger
                value="rules"
                className="flex items-center gap-1.5 rounded-md px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">策略规则</span>
              </TabsTrigger>
              <TabsTrigger
                value="backtest"
                className="flex items-center gap-1.5 rounded-md px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <History className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">历史回测</span>
              </TabsTrigger>
              <TabsTrigger
                value="recommend"
                className="flex items-center gap-1.5 rounded-md px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">智能推荐</span>
                <span className="ml-1 rounded bg-chart-5/20 px-1 text-[10px]" style={{ color: 'var(--chart-5)' }}>NEW</span>
              </TabsTrigger>
              <TabsTrigger
                value="report"
                className="flex items-center gap-1.5 rounded-md px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <FileBarChart className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">汇报中心</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="positions" className="space-y-4">
            <Csi300ProgressCard />
            <PositionPanel />
            <CapitalAllocationPanel />
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">资金分配规则</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-xs font-medium text-primary">核心底仓</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    优先将资金集中用于 <span className="text-foreground">沪深300ETF</span>，目标持仓 <span className="font-mono text-foreground tnum">1000 股</span>（约 5000 元），占比总资金 <span className="text-foreground">40% 以上</span>。
                  </p>
                </div>
                <div className="rounded-md border border-info/30 bg-info/5 p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-info" />
                    <span className="text-xs font-medium text-info">卫星仓位</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    <span className="text-foreground">AI / 芯片 / 电池 / 机器人</span> ETF 维持 <span className="font-mono text-foreground tnum">500-1000 股</span>，以"攒筹码"为主，止盈操作简化（盈利达标后卖出整百股）。
                  </p>
                </div>
                <div className="rounded-md border border-warn/30 bg-warn/5 p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-warn" />
                    <span className="text-xs font-medium text-warn">备用金</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    账户预留 <span className="font-mono text-foreground tnum">500 元</span> 现金，确保加仓 / 定投有资金。
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="macro">
            <MacroInfoFlow />
          </TabsContent>

          <TabsContent value="monitor">
            <MonitoringTimeline />
          </TabsContent>

          <TabsContent value="predict">
            <PredictionPanel />
          </TabsContent>

          <TabsContent value="rules">
            <StrategyRulesPanel />
          </TabsContent>

          <TabsContent value="backtest">
            <BacktestPanel />
          </TabsContent>

          <TabsContent value="recommend">
            <RecommendPanel />
          </TabsContent>

          <TabsContent value="report">
            <ReportCenter exceptions={exceptionCases} />
          </TabsContent>
        </Tabs>

        <footer className="mt-8 border-t border-border pt-4 text-center">
          <p className="text-[10px] text-muted-foreground">
            本系统所有流程均为 <span className="text-info">分析 + 汇报</span>，不执行交易。
            实时数据：<span className="text-foreground">腾讯财经</span>(行情) · <span className="text-foreground">ifzq</span>(K线) · <span className="text-foreground">央行/证监会官网+东方财富</span>(新闻)；
            预测：<span className="text-foreground">statsmodels ARIMA</span> + <span className="text-foreground">TensorFlow LSTM</span>；
            推送：<span className="text-foreground">SSE 实时流</span> · 参数：<span className="text-foreground">localStorage 可调</span>
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground/60">
            持仓数量与成本价为用户配置（可在右上角"参数设置"中修改） · 数据仅供参考，决策需用户自行判断
          </p>
        </footer>
      </main>
    </div>
  );
}
