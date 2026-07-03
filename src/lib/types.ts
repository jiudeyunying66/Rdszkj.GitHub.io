// ============ 类型定义 - 基于策略文档 ============

export type Sentiment = 'positive' | 'negative' | 'neutral';
export type SourceType = 'official' | 'media' | 'industry' | 'geopolitical' | 'sentiment';
export type AlertLevel = 'info' | 'warn' | 'critical';
export type Trend = 'up' | 'down' | 'flat';

// 持仓项
export interface Position {
  id: string;
  name: string;          // ETF名称
  code: string;          // ETF代码
  category: 'core' | 'satellite';  // 核心底仓 / 卫星仓位
  shares: number;        // 持仓数量
  currentPrice: number;  // 现价
  costPrice: number;     // 成本价
  targetShares?: number; // 目标持仓（仅核心底仓）
  targetAddLines: {      // 加仓线（百分比）
    level1: number;
    level2: number;
  };
  takeProfitLine: number; // 止盈线（百分比）
  todayChange: number;    // 今日涨跌幅
  todayVolume: number;    // 今日成交量（万手）
  volumeChange: number;   // 成交量较昨日变化（%）
  ma5: number;
  ma10: number;
  macd: number;
  kdj: number;
}

// 宏观信息项
export interface MacroInfo {
  id: string;
  source: SourceType;
  sourceName: string;     // 具体渠道
  sourceWeight: number;   // 来源权重 0-100
  title: string;
  content: string;
  sentiment: Sentiment;
  sentimentScore: number; // -1 到 1
  publishedAt: string;    // ISO时间
  relatedEtfs: string[];  // 关联ETF id
  impact: 'high' | 'medium' | 'low';
}

// 监测事件
export interface MonitorEvent {
  id: string;
  triggerTime: string;     // 触发时间 HH:mm
  triggerType: 'intraday' | 'pre-close' | 'post-close' | 'weekend';
  triggerPoint: string;    // 触发点描述：10:30 / 14:00 / 14:30 / 14:50 / 16:30 / 周末
  eventType: 'market' | 'macro' | 'summary' | 'review' | 'weekend';
  level: AlertLevel;
  title: string;
  content: string;
  relatedEtfs?: string[];
  suggestions?: string[];
  status: 'completed' | 'pending' | 'monitoring';
}

// 预测项
export interface Prediction {
  etfId: string;
  etfName: string;
  // ARIMA 次日预测
  nextDayOpenLow: number;
  nextDayOpenHigh: number;
  nextDayChangeLow: number; // %
  nextDayChangeHigh: number; // %
  // LSTM 未来3日预测
  threeDayChangeLow: number; // %
  threeDayChangeHigh: number; // %
  trend: Trend;
  confidence: number; // 0-1
  keyTriggers: string[];
}

// 策略调整规则
export interface StrategyRule {
  id: string;
  macroType: string;      // 政策利好 / 地缘紧张 / 经济数据 / 情绪过热
  trigger: string;        // 触发条件
  adjustment: string;     // 策略调整
  example: string;        // 示例
  isActive: boolean;      // 当前是否激活
  activeReason?: string;
  icon: string;
}

// 异常处理
export interface ExceptionCase {
  id: string;
  scenario: string;
  handling: string;
  notifyMethod: string;
  level: AlertLevel;
}

// 资金分配
export interface CapitalAllocation {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  description: string;
}

// KPI 数据
export interface KpiData {
  totalAssets: number;
  totalPnl: number;
  totalPnlPercent: number;
  positionRatio: number;
  cashReserve: number;
  todayAlerts: number;
  todayPnl: number;
  todayPnlPercent: number;
}
