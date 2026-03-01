'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

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

/**
 * Hook: connect to the SSE stream for real-time heatmap updates.
 * Returns new trades as they arrive — no polling needed.
 */
export function usePulseStream(enabled: boolean = true) {
  const [lastTrade, setLastTrade] = useState<PulseTradeEvent | null>(null)
  const [connected, setConnected] = useState(false)
  const [tradeCount, setTradeCount] = useState(0)
  const listenersRef = useRef<Set<(event: PulseTradeEvent) => void>>(new Set())
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!enabled) return

    const es = new EventSource('/api/pulse/stream')
    eventSourceRef.current = es

    es.onopen = () => setConnected(true)

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'trade') {
          const trade: PulseTradeEvent = {
            lat: data.lat,
            lng: data.lng,
            side: data.side,
            amountBucket: data.amountBucket,
            conditionId: data.conditionId,
            timestamp: data.timestamp,
            executionMode: data.executionMode || 'direct',
            marketName: data.marketName || undefined,
            walletHash: data.walletHash || undefined,
          }
          setLastTrade(trade)
          setTradeCount(c => c + 1)
          // Notify all registered listeners
          for (const listener of listenersRef.current) {
            listener(trade)
          }
        }
      } catch {}
    }

    es.onerror = () => {
      setConnected(false)
      // EventSource auto-reconnects
    }

    return () => {
      es.close()
      eventSourceRef.current = null
      setConnected(false)
    }
  }, [enabled])

  /** Register a callback for each new trade (useful for map updates) */
  const onTrade = useCallback((listener: (event: PulseTradeEvent) => void) => {
    listenersRef.current.add(listener)
    return () => { listenersRef.current.delete(listener) }
  }, [])

  return { lastTrade, connected, tradeCount, onTrade }
}
