/**
 * Pulse Broadcast — In-memory pub/sub for real-time heatmap updates.
 * Server-side only. Used by:
 * - POST /api/bet/execute → broadcasts new geo-tagged trade
 * - GET /api/pulse/stream → SSE endpoint subscribes to broadcasts
 */

export interface PulseTradeEvent {
  lat: number
  lng: number
  side: string
  amountBucket: string
  conditionId: string
  timestamp: number
  executionMode?: 'direct' | 'unlink'
  marketName?: string
  walletHash?: string
}

type PulseListener = (event: PulseTradeEvent) => void

class PulseBroadcaster {
  private listeners = new Set<PulseListener>()

  subscribe(listener: PulseListener): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  broadcast(event: PulseTradeEvent) {
    for (const listener of this.listeners) {
      try { listener(event) } catch {}
    }
  }

  get connectionCount() {
    return this.listeners.size
  }
}

// Singleton — shared across all API routes in the same serverless instance
export const pulseBroadcaster = new PulseBroadcaster()
