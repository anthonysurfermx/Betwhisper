import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// Auto-create positions table on first call
let tableCreated = false
async function ensureTable() {
  if (tableCreated) return
  await sql`
    CREATE TABLE IF NOT EXISTS positions (
      id SERIAL PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      market_slug TEXT NOT NULL,
      condition_id TEXT NOT NULL DEFAULT '',
      token_id TEXT NOT NULL DEFAULT '',
      side TEXT NOT NULL,
      shares NUMERIC NOT NULL DEFAULT 0,
      avg_price NUMERIC NOT NULL DEFAULT 0,
      total_usd NUMERIC NOT NULL DEFAULT 0,
      monad_tx_hash TEXT DEFAULT '',
      polygon_tx_hash TEXT DEFAULT '',
      tick_size TEXT DEFAULT '0.01',
      neg_risk BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `
  // Indexes for common queries
  await sql`CREATE INDEX IF NOT EXISTS idx_positions_wallet ON positions(wallet_address)`
  await sql`CREATE INDEX IF NOT EXISTS idx_positions_wallet_token ON positions(wallet_address, token_id)`
  tableCreated = true
}

// POST: Record a new bet / update position
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { marketSlug, side, amount, walletAddress, txHash, signalHash, source, monadTxHash,
          conditionId, tokenId, shares, price, tickSize, negRisk } = body

  if (!marketSlug || !side || !walletAddress) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  await ensureTable()

  const wallet = walletAddress.toLowerCase()
  const resolvedTokenId = tokenId || ''
  const resolvedShares = parseFloat(shares || '0')
  const resolvedPrice = parseFloat(price || '0')
  const resolvedAmount = parseFloat(amount || '0')

  // Check if user already has a position for this token
  const existing = await sql`
    SELECT id, shares, avg_price, total_usd FROM positions
    WHERE wallet_address = ${wallet} AND token_id = ${resolvedTokenId} AND token_id != ''
    LIMIT 1
  `

  if (existing.length > 0 && resolvedTokenId) {
    // Update existing position (add shares, recalculate avg price)
    const oldShares = parseFloat(existing[0].shares)
    const oldAvg = parseFloat(existing[0].avg_price)
    const oldTotal = parseFloat(existing[0].total_usd)
    const newShares = oldShares + resolvedShares
    const newTotal = oldTotal + resolvedAmount
    const newAvg = newShares > 0 ? newTotal / newShares : resolvedPrice

    await sql`
      UPDATE positions SET
        shares = ${newShares},
        avg_price = ${newAvg},
        total_usd = ${newTotal},
        polygon_tx_hash = ${txHash || ''},
        monad_tx_hash = ${monadTxHash || ''},
        updated_at = NOW()
      WHERE id = ${existing[0].id}
    `

    return NextResponse.json({ success: true, action: 'updated', shares: newShares })
  }

  // Insert new position
  await sql`
    INSERT INTO positions (wallet_address, market_slug, condition_id, token_id, side, shares, avg_price, total_usd,
      monad_tx_hash, polygon_tx_hash, tick_size, neg_risk)
    VALUES (${wallet}, ${marketSlug}, ${conditionId || ''}, ${resolvedTokenId}, ${side},
      ${resolvedShares}, ${resolvedPrice}, ${resolvedAmount},
      ${monadTxHash || ''}, ${txHash || ''}, ${tickSize || '0.01'}, ${negRisk || false})
  `

  return NextResponse.json({ success: true, action: 'created' })
}

// GET: List positions for a wallet
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')
  if (!wallet) {
    return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 })
  }

  await ensureTable()

  const positions = await sql`
    SELECT * FROM positions
    WHERE wallet_address = ${wallet.toLowerCase()} AND shares > 0
    ORDER BY updated_at DESC
  `

  return NextResponse.json({ positions, count: positions.length })
}
