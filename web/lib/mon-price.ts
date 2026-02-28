// Multi-source MON price oracle with circuit breaker
// Sources: CoinGecko, DexScreener, GeckoTerminal
// Returns null (circuit breaker open) if no source responds → refuse trade

import { MON_PRICE_API } from './constants'

const PRICE_SOURCES = [
  {
    name: 'defillama',
    url: 'https://coins.llama.fi/prices/current/coingecko:monad',
    extract: (data: Record<string, unknown>): number | null => {
      const coins = data?.coins as Record<string, { price?: number; confidence?: number }> | undefined
      const mon = coins?.['coingecko:monad']
      return mon?.price && mon.price > 0 ? mon.price : null
    },
  },
  {
    name: 'coingecko',
    url: MON_PRICE_API,
    extract: (data: Record<string, Record<string, number>>): number | null =>
      data?.monad?.usd > 0 ? data.monad.usd : null,
  },
  {
    name: 'geckoterminal',
    url: 'https://api.geckoterminal.com/api/v2/networks/monad/pools?page=1',
    extract: (data: Record<string, unknown>): number | null => {
      const items = (data?.data as Array<{ attributes?: { base_token_price_usd?: string } }>) || []
      if (!Array.isArray(items) || items.length === 0) return null
      const price = items[0]?.attributes?.base_token_price_usd
      return price ? parseFloat(price) : null
    },
  },
]

// Module-level cache (survives across requests within same serverless instance)
let cachedPrice: number | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60_000         // 60 seconds
const STALE_CACHE_TTL_MS = 300_000  // 5 minutes (last resort)
const FETCH_TIMEOUT_MS = 4_000      // 4s per source
const MAX_DEVIATION = 0.15          // 15% max deviation between sources (DexScreener can have alt-chain tokens)

export interface MonPriceResult {
  price: number | null  // null = circuit breaker open, refuse trade
  source: string
  cached: boolean
  sourcesChecked: number
  sourcesResponded: number
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function getMonPrice(): Promise<MonPriceResult> {
  const now = Date.now()

  // Return cache if fresh
  if (cachedPrice !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return { price: cachedPrice, source: 'cache', cached: true, sourcesChecked: 0, sourcesResponded: 0 }
  }

  // Query all sources in parallel with individual timeouts
  const results: { name: string; price: number }[] = []

  const fetches = PRICE_SOURCES.map(async (src) => {
    try {
      const res = await fetchWithTimeout(src.url, FETCH_TIMEOUT_MS)
      if (!res.ok) return
      const data = await res.json()
      const price = src.extract(data)
      if (price !== null && price > 0 && isFinite(price)) {
        results.push({ name: src.name, price })
      }
    } catch {
      // Source failed — continue
    }
  })

  await Promise.allSettled(fetches)

  // Circuit breaker: no source responded
  if (results.length === 0) {
    // Stale cache as last resort (< 5 min old)
    if (cachedPrice !== null && now - cacheTimestamp < STALE_CACHE_TTL_MS) {
      console.warn('[MonPrice] All sources failed, using stale cache')
      return { price: cachedPrice, source: 'stale_cache', cached: true, sourcesChecked: PRICE_SOURCES.length, sourcesResponded: 0 }
    }
    console.error('[MonPrice] CIRCUIT BREAKER OPEN: all price sources failed')
    return { price: null, source: 'circuit_breaker_open', cached: false, sourcesChecked: PRICE_SOURCES.length, sourcesResponded: 0 }
  }

  // Multiple sources: check consistency via median
  if (results.length >= 2) {
    const prices = results.map(r => r.price).sort((a, b) => a - b)
    const median = prices[Math.floor(prices.length / 2)]
    const allClose = prices.every(p => Math.abs(p - median) / median <= MAX_DEVIATION)
    if (!allClose) {
      console.error(`[MonPrice] CIRCUIT BREAKER: sources disagree. ${results.map(r => `${r.name}=$${r.price}`).join(', ')}`)
      return { price: null, source: 'circuit_breaker_deviation', cached: false, sourcesChecked: PRICE_SOURCES.length, sourcesResponded: results.length }
    }
    cachedPrice = median
  } else {
    // Single source — use it with warning
    cachedPrice = results[0].price
    console.warn(`[MonPrice] Only 1 source: ${results[0].name}=$${results[0].price}`)
  }

  cacheTimestamp = now
  return {
    price: cachedPrice,
    source: results.length >= 2 ? 'median' : results[0].name,
    cached: false,
    sourcesChecked: PRICE_SOURCES.length,
    sourcesResponded: results.length,
  }
}

// Convenience: get price or throw (for critical paths: execute, sell, verify)
export async function getMonPriceOrThrow(): Promise<number> {
  const result = await getMonPrice()
  if (result.price === null) {
    throw new Error('MON price unavailable: all price sources failed. Trade refused for safety.')
  }
  return result.price
}
