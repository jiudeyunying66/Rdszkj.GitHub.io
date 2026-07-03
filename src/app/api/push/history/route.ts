// 获取历史推送事件
import { NextResponse } from 'next/server';
import { getHistory, ensureMonitor } from '@/lib/push-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');

  // 触发一次监测
  ensureMonitor();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    total: getHistory(limit).length,
    events: getHistory(limit),
  });
}
