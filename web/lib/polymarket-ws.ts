/**
 * Polymarket CLOB WebSocket — Real-time price streaming
 * Endpoint: wss://ws-subscriptions-clob.polymarket.com/ws/market
 * No authentication required. Up to 500 tokens per connection.
 */

const WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market'
const PING_INTERVAL = 10_000 // 10s heartbeat required by Polymarket

export type PriceUpdate = {
  tokenId: string
  bestBid: number
  bestAsk: number
  midPrice: number
  lastTradePrice?: number
  lastTradeSide?: 'BUY' | 'SELL'
  lastTradeSize?: number
  timestamp: number
}

type Listener = (update: PriceUpdate) => void

class PolymarketPriceStream {
  private ws: WebSocket | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private subscribedTokens = new Set<string>()
  private listeners = new Map<string, Set<Listener>>()
  private globalListeners = new Set<Listener>()
  private prices = new Map<string, PriceUpdate>()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private connected = false

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return

    try {
      this.ws = new WebSocket(WS_URL)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.connected = true
      this.reconnectAttempts = 0
      console.log('[WS] Connected to Polymarket price stream')

      // Re-subscribe all tokens after reconnect
      if (this.subscribedTokens.size > 0) {
        this.sendSubscribe([...this.subscribedTokens])
      }

      // Start heartbeat
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send('PING')
        }
      }, PING_INTERVAL)
    }

    this.ws.onmessage = (event) => {
      const raw = event.data as string
      if (raw === 'PONG') return

      try {
        const data = JSON.parse(raw)
        this.handleMessage(data)
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onclose = () => {
      this.connected = false
      this.cleanup()
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      // onclose will fire after this
    }
  }

  private handleMessage(data: Record<string, unknown>) {
    const eventType = data.event_type as string

    if (eventType === 'book') {
      const tokenId = data.asset_id as string
      const bids = data.bids as { price: string; size: string }[]
      const asks = data.asks as { price: string; size: string }[]
      if (bids?.length && asks?.length) {
        const bestBid = parseFloat(bids[0].price)
        const bestAsk = parseFloat(asks[0].price)
        this.emitPrice(tokenId, { bestBid, bestAsk, midPrice: (bestBid + bestAsk) / 2, timestamp: data.timestamp as number || Date.now() })
      }
    } else if (eventType === 'price_change') {
      const changes = data.price_changes as { asset_id: string; best_bid: string; best_ask: string }[]
      if (changes) {
        for (const c of changes) {
          const bestBid = parseFloat(c.best_bid)
          const bestAsk = parseFloat(c.best_ask)
          if (bestBid > 0 && bestAsk > 0) {
            this.emitPrice(c.asset_id, { bestBid, bestAsk, midPrice: (bestBid + bestAsk) / 2, timestamp: data.timestamp as number || Date.now() })
          }
        }
      }
    } else if (eventType === 'last_trade_price') {
      const tokenId = data.asset_id as string
      const existing = this.prices.get(tokenId)
      const tradePrice = parseFloat(data.price as string)
      this.emitPrice(tokenId, {
        bestBid: existing?.bestBid || tradePrice,
        bestAsk: existing?.bestAsk || tradePrice,
        midPrice: existing?.midPrice || tradePrice,
        lastTradePrice: tradePrice,
        lastTradeSide: data.side as 'BUY' | 'SELL',
        lastTradeSize: parseFloat(data.size as string),
        timestamp: data.timestamp as number || Date.now(),
      })
    } else if (eventType === 'best_bid_ask') {
      const tokenId = data.asset_id as string
      const bestBid = parseFloat(data.best_bid as string)
      const bestAsk = parseFloat(data.best_ask as string)
      this.emitPrice(tokenId, { bestBid, bestAsk, midPrice: (bestBid + bestAsk) / 2, timestamp: data.timestamp as number || Date.now() })
    }
  }

  private emitPrice(tokenId: string, partial: Omit<PriceUpdate, 'tokenId'> & { lastTradePrice?: number; lastTradeSide?: 'BUY' | 'SELL'; lastTradeSize?: number }) {
    const existing = this.prices.get(tokenId)
    const update: PriceUpdate = {
      tokenId,
      bestBid: partial.bestBid,
      bestAsk: partial.bestAsk,
      midPrice: partial.midPrice,
      lastTradePrice: partial.lastTradePrice ?? existing?.lastTradePrice,
      lastTradeSide: partial.lastTradeSide ?? existing?.lastTradeSide,
      lastTradeSize: partial.lastTradeSize ?? existing?.lastTradeSize,
      timestamp: partial.timestamp,
    }
    this.prices.set(tokenId, update)

    // Notify token-specific listeners
    const tokenListeners = this.listeners.get(tokenId)
    if (tokenListeners) {
      for (const fn of tokenListeners) fn(update)
    }
    // Notify global listeners
    for (const fn of this.globalListeners) fn(update)
  }

  subscribe(tokenIds: string[], listener: Listener): () => void {
    // Connect if not already
    if (!this.connected) this.connect()

    const newTokens = tokenIds.filter(id => !this.subscribedTokens.has(id))

    // Register listener for each token
    for (const id of tokenIds) {
      this.subscribedTokens.add(id)
      if (!this.listeners.has(id)) this.listeners.set(id, new Set())
      this.listeners.get(id)!.add(listener)
    }

    // Send subscribe for new tokens only
    if (newTokens.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(newTokens)
    }

    // Return cached prices immediately
    for (const id of tokenIds) {
      const cached = this.prices.get(id)
      if (cached) listener(cached)
    }

    // Return unsubscribe function
    return () => {
      for (const id of tokenIds) {
        this.listeners.get(id)?.delete(listener)
        if (this.listeners.get(id)?.size === 0) {
          this.listeners.delete(id)
          // Don't unsubscribe from WS — keep receiving for cache
        }
      }
    }
  }

  /** Subscribe to ALL price updates (useful for portfolio-wide tracking) */
  onAnyPrice(listener: Listener): () => void {
    this.globalListeners.add(listener)
    return () => { this.globalListeners.delete(listener) }
  }

  /** Get last known price for a token */
  getPrice(tokenId: string): PriceUpdate | undefined {
    return this.prices.get(tokenId)
  }

  private sendSubscribe(tokenIds: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({
      assets_ids: tokenIds,
      type: 'market',
      custom_feature_enabled: true,
    }))
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private cleanup() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
  }

  disconnect() {
    this.cleanup()
    this.reconnectAttempts = this.maxReconnectAttempts // prevent reconnect
    if (this.ws) { this.ws.close(); this.ws = null }
    this.connected = false
  }
}

// Singleton — one connection shared across all components
export const priceStream = new PolymarketPriceStream()
