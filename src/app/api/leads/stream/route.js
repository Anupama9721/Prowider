import { sseEmitter } from '@/lib/sse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const writer = {
        write: (data) => controller.enqueue(encoder.encode(data)),
      };

      // Send initial connection event
      writer.write('event: connected\ndata: {"status":"ok"}\n\n');

      // Register client
      const unsubscribe = sseEmitter.addClient(writer);

      // Keep-alive ping every 25 seconds
      const pingInterval = setInterval(() => {
        try {
          writer.write(': ping\n\n');
        } catch {
          clearInterval(pingInterval);
          unsubscribe();
        }
      }, 25000);

      // Clean up when client disconnects
      const cleanup = () => {
        clearInterval(pingInterval);
        unsubscribe();
      };

      // Store cleanup so we can call it
      controller._cleanup = cleanup;
    },
    cancel(controller) {
      if (controller._cleanup) controller._cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
