// SSE 推送流 - 客户端订阅此端点接收实时事件
import { NextRequest } from 'next/server';
import { subscribe, getHistory, ensureMonitor } from '@/lib/push-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // 触发监测（如果距离上次足够久）
  ensureMonitor();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // 推送历史事件
      const history = getHistory(20);
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'history', events: history })}\n\n`)
      );

      // 订阅新事件
      const unsubscribe = subscribe((event) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'push', event })}\n\n`)
          );
        } catch (e) {
          // 通道关闭
        }
      });

      // 心跳
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (e) {}
      }, 25000);

      // 客户端断开时清理
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch (e) {}
      };
      request.signal.addEventListener('abort', cleanup);

      // 触发一次监测
      setTimeout(() => ensureMonitor(), 1000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
