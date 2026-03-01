import { NextResponse } from 'next/server'

// Real Polymarket market slugs for the sidebar — high volume, NYC-relevant
const SIDEBAR_SLUGS = [
  'will-the-new-york-knicks-win-the-2026-nba-finals',                  // Sports / NYC
  'will-trump-nominate-kevin-warsh-as-the-next-fed-chair',             // Politics / Finance
  'fed-rate-cut-by-july-2026-meeting-577',                              // Macro / Finance
]

interface MarketLive {
  slug: string
  question: string
  yesPrice: number
  noPrice: number
  volume: number
}

let cache: { data: MarketLive[]; ts: number } | null = null
const CACHE_TTL = 15_000 // 15s

export async function GET() {
  // Return cached if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ markets: cache.data, cached: true })
  }

  const markets: MarketLive[] = []

  for (const slug of SIDEBAR_SLUGS) {
    try {
      const res = await fetch(
        `https://gamma-api.polymarket.com/markets?slug=${slug}&limit=1`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (!res.ok) continue
      const data = await res.json()
      const m = Array.isArray(data) ? data[0] : data
      if (!m) continue

      let yesPrice = 0.5
      let noPrice = 0.5
      try {
        const prices = JSON.parse(m.outcomePrices || '[]')
        yesPrice = parseFloat(prices[0]) || 0.5
        noPrice = parseFloat(prices[1]) || 0.5
      } catch {}

      markets.push({
        slug: m.slug || slug,
        question: m.question || slug,
        yesPrice,
        noPrice,
        volume: parseFloat(m.volume || '0'),
      })
    } catch {
      // Skip failed markets
    }
  }

  // Cache successful results
  if (markets.length > 0) {
    cache = { data: markets, ts: Date.now() }
  }

  return NextResponse.json({ markets, cached: false })
}
