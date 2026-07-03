'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings, RotateCcw, Save, AlertCircle, Plus, X, Search, LineChart, Building2, TrendingUp } from 'lucide-react';
import { useUserConfig, type UserConfig, type EtfUserConfig } from '@/lib/use-user-config';
import { SECURITY_LIBRARY, SECURITY_BY_ID, SECURITIES_BY_CATEGORY, DEFAULT_WATCHLIST, type SecurityInfo } from '@/lib/security-library';

export function SettingsPanel() {
  const { config, loaded, update, updatePosition, addToWatchlist, removeFromWatchlist, reset } = useUserConfig();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<UserConfig>(config);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('全部');

  const handleOpenChange = (o: boolean) => {
    if (o) setLocal(config);
    setOpen(o);
  };

  const handleSave = () => {
    update(local);
    setOpen(false);
  };

  const handleReset = () => {
    if (confirm('确认重置为策略文档默认参数？所有自定义修改将丢失。')) {
      reset();
      setLocal(config);
    }
  };

  const updateLocal = (partial: Partial<UserConfig>) => {
    setLocal((prev) => ({ ...prev, ...partial }));
  };

  const updateLocalPosition = (etfId: string, partial: Partial<EtfUserConfig>) => {
    setLocal((prev) => ({
      ...prev,
      positions: { ...prev.positions, [etfId]: { ...prev.positions[etfId], ...partial } },
    }));
  };

  // 当前 watchlist 中的证券
  const watchlistSecurities = (config.watchlist || DEFAULT_WATCHLIST)
    .map((id) => SECURITY_BY_ID[id])
    .filter(Boolean) as SecurityInfo[];

  // 可添加的证券（过滤搜索 + 分类）
  const categories = ['全部', ...Object.keys(SECURITIES_BY_CATEGORY)];
  const availableSecurities = SECURITY_LIBRARY.filter((s) => {
    if (config.watchlist?.includes(s.id)) return false;
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      return s.name.toLowerCase().includes(kw) || s.code.includes(kw) || s.keywords.some((k) => k.toLowerCase().includes(kw));
    }
    if (activeCategory !== '全部' && s.category !== activeCategory) return false;
    return true;
  });

  if (!loaded) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-background/40 px-3 text-muted-foreground transition-colors hover:text-foreground">
          <Settings className="h-4 w-4" />
          <span className="hidden text-xs sm:inline">参数设置</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            参数设置
            <Badge variant="outline" className="text-[10px]">localStorage 持久化</Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            可调整总资产、现金、持仓数量、成本价、加仓线、止盈线，以及监测的 ETF/个股列表（支持添加/删除）。
          </p>
        </DialogHeader>

        <Tabs defaultValue="watchlist">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="watchlist" className="text-xs">持仓/监测管理</TabsTrigger>
            <TabsTrigger value="capital" className="text-xs">资金管理</TabsTrigger>
            <TabsTrigger value="positions" className="text-xs">持仓参数</TabsTrigger>
          </TabsList>

          {/* 持仓/监测管理 */}
          <TabsContent value="watchlist" className="space-y-4">
            {/* 当前监测列表 */}
            <div>
              <Label className="text-xs mb-2 block">当前监测列表（{watchlistSecurities.length}）</Label>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {watchlistSecurities.map((s) => {
                  const pos = config.positions[s.id];
                  return (
                    <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-2">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${s.type === 'etf' ? 'bg-info/15 text-info' : 'bg-chart-5/15 text-chart-5'}`}>
                          {s.type === 'etf' ? <LineChart className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{s.name}</span>
                            <Badge variant="outline" className="text-[9px] font-mono">{s.code}</Badge>
                            <Badge variant="secondary" className="text-[9px]">{s.category}</Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {pos && pos.shares > 0 ? `持仓 ${pos.shares} 股 · 成本 ${pos.costPrice.toFixed(3)}` : '未持仓（仅监测）'}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[10px] text-up hover:bg-up/10"
                        onClick={() => removeFromWatchlist(s.id)}
                      >
                        <X className="h-3 w-3" /> 移除
                      </Button>
                    </div>
                  );
                })}
                {watchlistSecurities.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-4">监测列表为空，请从下方添加</div>
                )}
              </div>
            </div>

            {/* 添加新证券 */}
            <div>
              <Label className="text-xs mb-2 block">添加证券（ETF + 个股）</Label>
              {/* 搜索框 */}
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="搜索代码/名称/关键词（如 510300、茅台、AI）"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="h-8 pl-7 text-xs"
                />
              </div>
              {/* 分类筛选 */}
              {!searchKeyword && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`rounded border px-2 py-0.5 text-[10px] ${activeCategory === cat ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
              {/* 证券列表 */}
              <div className="space-y-1 max-h-[280px] overflow-y-auto">
                {availableSecurities.slice(0, 30).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border border-border/60 p-1.5 hover:border-primary/40">
                    <div className="flex items-center gap-1.5">
                      <span className={`flex h-5 w-5 items-center justify-center rounded ${s.type === 'etf' ? 'bg-info/15 text-info' : 'bg-chart-5/15 text-chart-5'}`}>
                        {s.type === 'etf' ? <LineChart className="h-2.5 w-2.5" /> : <Building2 className="h-2.5 w-2.5" />}
                      </span>
                      <span className="text-xs font-medium">{s.name}</span>
                      <Badge variant="outline" className="text-[9px] font-mono">{s.code}</Badge>
                      <Badge variant="secondary" className="text-[9px]">{s.category}</Badge>
                      <span className="text-[9px] text-muted-foreground">{s.type === 'etf' ? 'ETF' : '个股'}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 gap-1 px-2 text-[10px]"
                      onClick={() => addToWatchlist(s.id)}
                    >
                      <Plus className="h-2.5 w-2.5" /> 添加
                    </Button>
                  </div>
                ))}
                {availableSecurities.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-4">无符合条件的证券</div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* 资金管理 */}
          <TabsContent value="capital" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cash" className="text-xs">账户现金/备用金（元）</Label>
                <Input
                  id="cash"
                  type="number"
                  step="100"
                  value={local.cashReserve}
                  onChange={(e) => updateLocal({ cashReserve: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-[10px] text-muted-foreground">总资产 = 持仓市值 + 账户现金</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekly" className="text-xs">周定投金额（元）</Label>
                <Input
                  id="weekly"
                  type="number"
                  step="100"
                  value={local.weeklyInvest}
                  onChange={(e) => updateLocal({ weeklyInvest: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-[10px] text-muted-foreground">沪深300ETF 核心底仓补仓进度</p>
              </div>
            </div>

            <div className="rounded-md border border-info/30 bg-info/5 p-3 text-xs">
              <div className="flex items-center gap-1.5 text-info">
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="font-medium">计算公式</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                <span className="font-mono">总资产 = Σ(持仓数 × 现价) + 账户现金</span><br/>
                <span className="font-mono">累计盈亏 = 持仓市值 - 持仓成本 (与账户现金无关)</span><br/>
                <span className="font-mono">今日盈亏 = Σ(今日涨跌额 × 持仓数)</span>
              </p>
            </div>
          </TabsContent>

          {/* 持仓参数 */}
          <TabsContent value="positions" className="space-y-3">
            {watchlistSecurities.map((cfg) => {
              const pos = local.positions[cfg.id] || {
                shares: 0,
                costPrice: 0,
                addLine1: -3,
                addLine2: -5,
                takeProfitLine: 10,
              };
              return (
                <div key={cfg.id} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cfg.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{cfg.code}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{cfg.category}</Badge>
                      {cfg.type === 'stock' && <Badge variant="outline" className="text-[10px] text-chart-5">个股</Badge>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                    <Field
                      label="持仓数量"
                      value={pos.shares}
                      step={100}
                      onChange={(v) => updateLocalPosition(cfg.id, { shares: v })}
                    />
                    <Field
                      label="成本价"
                      value={pos.costPrice}
                      step={0.01}
                      digits={3}
                      onChange={(v) => updateLocalPosition(cfg.id, { costPrice: v })}
                    />
                    <Field
                      label="一级加仓线%"
                      value={pos.addLine1}
                      step={0.5}
                      digits={1}
                      onChange={(v) => updateLocalPosition(cfg.id, { addLine1: v })}
                    />
                    <Field
                      label="二级加仓线%"
                      value={pos.addLine2}
                      step={0.5}
                      digits={1}
                      onChange={(v) => updateLocalPosition(cfg.id, { addLine2: v })}
                    />
                    <Field
                      label="止盈线%"
                      value={pos.takeProfitLine}
                      step={1}
                      digits={0}
                      onChange={(v) => updateLocalPosition(cfg.id, { takeProfitLine: v })}
                    />
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1">
            <RotateCcw className="h-3.5 w-3.5" />
            重置默认
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1">
            <Save className="h-3.5 w-3.5" />
            保存生效
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label, value, onChange, step = 1, digits = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  digits?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-8 text-xs"
      />
    </div>
  );
}
