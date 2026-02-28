import { pulseBroadcaster, type PulseTradeEvent } from '@/lib/pulse-broadcast'

/**
 * SSE endpoint for real-time heatmap updates.
 * Clients connect here and receive new trade points as they happen.
 * No polling needed — server pushes instantly on each trade.
 */
export async function GET() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`))

      // Subscribe to trade broadcasts
      const unsubscribe = pulseBroadcaster.subscribe((event: PulseTradeEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'trade', ...event })}\n\n`))
        } catch {
          // Client disconnected
          unsubscribe()
        }
      })

      // Heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ping', ts: Date.now(), connections: pulseBroadcaster.connectionCount })}\n\n`))
        } catch {
          clearInterval(heartbeat)
          unsubscribe()
        }
      }, 15000)

      // Cleanup on close (Next.js will call cancel when client disconnects)
    },
    cancel() {
      // Stream closed — cleanup handled by unsubscribe in the closure
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
