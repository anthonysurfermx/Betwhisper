import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verifyJWT, extractBearerToken } from '@/lib/auth'
import { getClient, getBestPrice } from '@/lib/polymarket-clob'
import { Side } from '@polymarket/clob-client'

// Price cache to avoid hammering Polymarket API
const priceCache = new Map<string, { price: number; ts: number }>()
const CACHE_TTL = 30_000 // 30 seconds

async function getCachedPrice(tokenId: string): Promise<number> {
  const cached = priceCache.get(tokenId)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.price

  try {
    const client = await getClient()
    const price = await getBestPrice(client, tokenId, Side.SELL)
    priceCache.set(tokenId, { price, ts: Date.now() })
    return price
  } catch {
    return cached?.price || 0.5
  }
}

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')
  if (!wallet) {
    return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 })
  }

  // Verify JWT
  const token = extractBearerToken(request.headers.get('authorization'))
  if (!token) {
    return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
  }

  const payload = await verifyJWT(token)
  if (!payload || payload.wallet !== wallet.toLowerCase()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const positions = await sql`
    SELECT id, market_slug, token_id, side, shares, avg_price, total_usd, tick_size, neg_risk
    FROM positions
    WHERE wallet_address = ${wallet.toLowerCase()} AND shares > 0
    ORDER BY updated_at DESC
  `

  // Fetch current prices (sequentially with cache to avoid rate limits)
  let totalValue = 0
  let totalPnl = 0

  const enriched = []
  for (const pos of positions) {
    const shares = parseFloat(pos.shares)
    const avgPrice = parseFloat(pos.avg_price)
    const costBasis = parseFloat(pos.total_usd)
    const currentPrice = await getCachedPrice(pos.token_id)
    const currentValue = shares * currentPrice
    const pnl = currentValue - costBasis
    const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0

    totalValue += currentValue
    totalPnl += pnl

    enriched.push({
      id: pos.id,
      marketSlug: pos.market_slug,
      side: pos.side,
      shares,
      avgPrice,
      currentPrice,
      costBasis,
      currentValue,
      pnl,
      pnlPct,
      tokenId: pos.token_id,
      tickSize: pos.tick_size,
      negRisk: pos.neg_risk,
    })
  }

  // Fetch MON price from shared oracle (degrade gracefully with 0)
  let monPrice = 0
  try {
    const { getMonPrice } = await import('@/lib/mon-price')
    const priceResult = await getMonPrice()
    if (priceResult.price !== null) monPrice = priceResult.price
  } catch { /* oracle unavailable — show 0 */ }

  return NextResponse.json({
    positions: enriched,
    totalValue,
    totalPnl,
    monPrice,
    count: enriched.length,
  })
}
