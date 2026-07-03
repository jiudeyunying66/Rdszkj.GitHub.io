'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Bell,
  X,
  CheckCheck,
  AlertTriangle,
  AlertOctagon,
  Info,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Settings,
  MessageCircle,
  Wifi,
  WifiOff,
  Trash2,
} from 'lucide-react';
import { usePushEvents, type PushEvent } from '@/lib/use-push-events';

function levelIcon(level: PushEvent['level']) {
  if (level === 'critical') return <AlertOctagon className="h-4 w-4 text-up" />;
  if (level === 'warn') return <AlertTriangle className="h-4 w-4 text-warn" />;
  return <Info className="h-4 w-4 text-info" />;
}

function typeIcon(type: PushEvent['type']) {
  switch (type) {
    case 'market_alert': return <TrendingDown className="h-3.5 w-3.5" />;
    case 'take_profit': return <DollarSign className="h-3.5 w-3.5" />;
    case 'add_position': return <Plus className="h-3.5 w-3.5" />;
    case 'macro_news': return <Info className="h-3.5 w-3.5" />;
    case 'technical_signal': return <TrendingUp className="h-3.5 w-3.5" />;
    case 'system': return <Settings className="h-3.5 w-3.5" />;
  }
}

function typeLabel(type: PushEvent['type']) {
  switch (type) {
    case 'market_alert': return '市场预警';
    case 'take_profit': return '止盈提醒';
    case 'add_position': return '加仓提醒';
    case 'macro_news': return '宏观新闻';
    case 'technical_signal': return '技术信号';
    case 'system': return '系统通知';
  }
}

function timeAgo(iso: string) {
  const now = new Date();
  const t = new Date(iso);
  const diff = (now.getTime() - t.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return `${Math.floor(diff / 86400)}天前`;
}

// 微信风格通知卡片
function WeChatNotificationCard({ event }: { event: PushEvent }) {
  const isCritical = event.level === 'critical';
  return (
    <div
      className={`relative overflow-hidden rounded-lg border p-3 transition-all ${
        isCritical
          ? 'border-up/40 bg-up/5'
          : event.level === 'warn'
          ? 'border-warn/30 bg-warn/5'
          : 'border-border bg-card'
      }`}
    >
      {/* 左侧色条 */}
      <div
        className={`absolute left-0 top-0 h-full w-1 ${
          isCritical ? 'bg-up' : event.level === 'warn' ? 'bg-warn' : 'bg-info'
        }`}
      />

      <div className="flex items-start gap-2 pl-2">
        {/* 头像 */}
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${
            isCritical ? 'bg-up/15 text-up' : event.level === 'warn' ? 'bg-warn/15 text-warn' : 'bg-info/15 text-info'
          }`}
        >
          {levelIcon(event.level)}
        </div>

        <div className="flex-1 min-w-0">
          {/* 标题行 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium truncate">{event.title}</span>
              {isCritical && (
                <span className="rounded bg-up/20 px-1 text-[9px] font-bold text-up pulse-warn">CRITICAL</span>
              )}
            </div>
            <span className="font-mono text-[10px] text-muted-foreground tnum flex-shrink-0">
              {timeAgo(event.timestamp)}
            </span>
          </div>

          {/* 内容 */}
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-3">
            {event.content}
          </p>

          {/* 标签行 */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="h-4 gap-0.5 px-1.5 text-[9px]">
              {typeIcon(event.type)}
              {typeLabel(event.type)}
            </Badge>
            {event.etfName && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                {event.etfName}
              </Badge>
            )}
            <Badge variant="outline" className="h-4 gap-0.5 px-1.5 text-[9px]">
              <MessageCircle className="h-2.5 w-2.5" />
              {event.channel === 'wechat' ? '微信' : event.channel === 'app' ? 'APP' : '短信'}
            </Badge>
          </div>

          {/* 操作按钮 */}
          {event.actions && event.actions.length > 0 && (
            <div className="mt-2 flex gap-1.5">
              {event.actions.map((a, i) => (
                <button
                  key={i}
                  className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/20"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const { events, connected, unreadCount, markRead, clearEvents, requestNotificationPermission } = usePushEvents(true);
  const [open, setOpen] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const poppedRef = useRef<Set<string>>(new Set());
  const [popups, setPopups] = useState<PushEvent[]>([]);

  // 新事件弹窗（用 setTimeout 包裹 setState 避免同步触发）
  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[0];
    if (poppedRef.current.has(latest.id)) return;
    poppedRef.current.add(latest.id);
    // 异步触发，避免在 effect 同步体内 setState
    const showTimer = setTimeout(() => {
      setPopups((prev) => [latest, ...prev].slice(0, 3));
    }, 0);
    // 6 秒后自动消失
    const hideTimer = setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== latest.id));
    }, 6000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [events]);

  // 处理打开时标记已读
  useEffect(() => {
    if (open) markRead();
  }, [open, markRead]);

  const handleEnableBrowserNotif = async () => {
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
  };

  const removePopup = (id: string) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <>
      {/* 触发按钮 */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/40 text-muted-foreground transition-colors hover:text-foreground">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-up px-1 text-[10px] font-bold text-white pulse-warn">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            {connected && (
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-down border border-card" />
            )}
          </button>
        </SheetTrigger>

        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-down" />
                推送通知中心
              </SheetTitle>
              <div className="flex items-center gap-1">
                {connected ? (
                  <Badge variant="outline" className="gap-1 border-down/40 text-down">
                    <Wifi className="h-3 w-3" /> 实时
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 border-flat/40 text-muted-foreground">
                    <WifiOff className="h-3 w-3" /> 断开
                  </Badge>
                )}
              </div>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{events.length} 条通知</span>
              <span>·</span>
              <span>渠道：微信 / APP / 短信</span>
            </div>
          </SheetHeader>

          {/* 工具栏 */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>事件类型：</span>
              <Badge variant="outline" className="h-4 px-1.5 text-[9px]">市场预警</Badge>
              <Badge variant="outline" className="h-4 px-1.5 text-[9px]">止盈</Badge>
              <Badge variant="outline" className="h-4 px-1.5 text-[9px]">加仓</Badge>
            </div>
            <div className="flex items-center gap-1">
              {!notifGranted && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[10px]"
                  onClick={handleEnableBrowserNotif}
                >
                  <Bell className="h-3 w-3" /> 桌面通知
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-[10px]"
                onClick={clearEvents}
              >
                <Trash2 className="h-3 w-3" /> 清空
              </Button>
            </div>
          </div>

          {/* 通知列表 */}
          <ScrollArea className="flex-1 px-3 py-3">
            <div className="space-y-2">
              {events.length === 0 && (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  暂无通知
                </div>
              )}
              {events.map((e) => (
                <WeChatNotificationCard key={e.id} event={e} />
              ))}
            </div>
          </ScrollArea>

          {/* 底部说明 */}
          <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Settings className="h-3 w-3" />
              服务端每 30 秒监测一次，触发条件自动推送
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 桌面右下角弹窗（微信风格） */}
      <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {popups.map((e) => (
          <div
            key={e.id}
            className={`animate-in slide-in-from-right rounded-lg border p-3 shadow-lg backdrop-blur ${
              e.level === 'critical'
                ? 'border-up/50 bg-up/10'
                : e.level === 'warn'
                ? 'border-warn/50 bg-warn/10'
                : 'border-info/50 bg-info/10'
            }`}
            style={{ background: 'rgba(33, 35, 50, 0.95)' }}
          >
            <div className="flex items-start gap-2">
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${
                e.level === 'critical' ? 'bg-up/20 text-up' : e.level === 'warn' ? 'bg-warn/20 text-warn' : 'bg-info/20 text-info'
              }`}>
                {levelIcon(e.level)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium truncate">{e.title}</span>
                  <button
                    onClick={() => removePopup(e.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{e.content}</p>
                <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <MessageCircle className="h-2.5 w-2.5 text-down" />
                  数据监测 · {timeAgo(e.timestamp)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
