import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { verifyJWT, extractBearerToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')
  if (!wallet) {
    return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 })
  }

  // Auth: JWT (web with PIN) or iOS platform header (Face ID gated client-side)
  const platform = request.headers.get('x-platform')
  const token = extractBearerToken(request.headers.get('authorization'))

  if (platform === 'ios') {
    // iOS: Face ID is enforced on device
  } else if (token) {
    const payload = await verifyJWT(token)
    if (!payload || payload.wallet !== wallet.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
  } else {
    return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
  }

  try {
    const rows = await sql`
      SELECT id, market_slug, side, amount_usd, shares, fill_price, status,
             monad_tx_hash, polygon_tx_hash, mon_paid, mon_price_usd, error_msg, created_at
      FROM orders
      WHERE wallet_address = ${wallet.toLowerCase()}
      ORDER BY created_at DESC
      LIMIT 30
    `

    const orders = rows.map(r => ({
      id: r.id,
      marketSlug: r.market_slug,
      side: r.side,
      amountUSD: parseFloat(r.amount_usd),
      shares: parseFloat(r.shares),
      fillPrice: parseFloat(r.fill_price),
      status: r.status,
      monadTxHash: r.monad_tx_hash,
      polygonTxHash: r.polygon_tx_hash,
      monPaid: r.mon_paid,
      monPriceUSD: parseFloat(r.mon_price_usd),
      errorMsg: r.error_msg,
      createdAt: r.created_at,
    }))

    return NextResponse.json({ orders })
  } catch {
    // Table may not exist yet
    return NextResponse.json({ orders: [] })
  }
}
