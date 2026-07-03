'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

export interface PushEvent {
  id: string;
  type: 'market_alert' | 'take_profit' | 'add_position' | 'macro_news' | 'technical_signal' | 'system';
  level: 'info' | 'warn' | 'critical';
  title: string;
  content: string;
  etfId?: string;
  etfName?: string;
  timestamp: string;
  channel: 'wechat' | 'app' | 'sms';
  actions?: { label: string; type: string }[];
}

export function usePushEvents(enabled: boolean = true) {
  const [events, setEvents] = useState<PushEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const markRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setUnreadCount(0);
  }, []);

  const addEvent = useCallback((event: PushEvent) => {
    setEvents((prev) => {
      // 去重
      if (prev.find((e) => e.id === event.id)) return prev;
      return [event, ...prev].slice(0, 100);
    });
    setUnreadCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let reconnectTimer: any;
    let closed = false;

    function connect() {
      if (closed) return;
      try {
        const es = new EventSource('/api/push/stream');
        eventSourceRef.current = es;

        es.onopen = () => {
          setConnected(true);
        };

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'history') {
              setEvents(data.events || []);
            } else if (data.type === 'push' && data.event) {
              addEvent(data.event);
              // 显示浏览器通知（如果授权）
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try {
                  new Notification(data.event.title, {
                    body: data.event.content.slice(0, 100),
                    tag: data.event.id,
                  });
                } catch (err) {}
              }
            }
          } catch (err) {}
        };

        es.onerror = () => {
          setConnected(false);
          es.close();
          // 5 秒后重连
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch (e) {
        reconnectTimer = setTimeout(connect, 5000);
      }
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [enabled, addEvent]);

  // 浏览器通知授权请求
  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }, []);

  return {
    events,
    connected,
    unreadCount,
    markRead,
    clearEvents,
    requestNotificationPermission,
  };
}
