import { NextRequest, NextResponse } from 'next/server'
import { executeClobBet, getUSDCBalance } from '@/lib/polymarket-clob'
import { verifyMonadPayment } from '@/lib/monad-bet'
import { MAX_BET_USD, POLYGON_EXPLORER } from '@/lib/constants'
import { sql } from '@/lib/db'

// Auto-create orders table (replay protection + order tracking)
let ordersTableCreated = false
async function ensureOrdersTable() {
  if (ordersTableCreated) return
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      monad_tx_hash TEXT NOT NULL UNIQUE,
      wallet_address TEXT NOT NULL DEFAULT '',
      market_slug TEXT NOT NULL,
      condition_id TEXT NOT NULL,
      side TEXT NOT NULL,
      amount_usd NUMERIC NOT NULL,
      verified_amount_usd NUMERIC,
      mon_paid TEXT DEFAULT '0',
      mon_price_usd NUMERIC DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      polygon_tx_hash TEXT DEFAULT '',
      order_id TEXT DEFAULT '',
      shares NUMERIC DEFAULT 0,
      fill_price NUMERIC DEFAULT 0,
      error_msg TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `
  ordersTableCreated = true
}

// Daily spend tracking (resets on deploy/restart)
let dailySpent = 0
let dailyResetDate = new Date().toDateString()
const DAILY_LIMIT = 500

function checkDailyLimit(amount: number): boolean {
  const today = new Date().toDateString()
  if (today !== dailyResetDate) {
    dailySpent = 0
    dailyResetDate = today
  }
  return (dailySpent + amount) <= DAILY_LIMIT
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { conditionId, outcomeIndex, amountUSD, signalHash, marketSlug, monadTxHash, tokenId, tickSize, negRisk, monPriceUSD } = body

  // Validate required fields
  if (!conditionId || outcomeIndex === undefined || !amountUSD || !marketSlug) {
    return NextResponse.json({ error: 'Missing required fields: conditionId, outcomeIndex, amountUSD, marketSlug' }, { status: 400 })
  }

  // Validate amount
  const amount = parseFloat(amountUSD)
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }
  if (amount > MAX_BET_USD) {
    return NextResponse.json({ error: `Amount exceeds max bet of $${MAX_BET_USD}` }, { status: 400 })
  }

  // Check daily limit
  if (!checkDailyLimit(amount)) {
    return NextResponse.json({ error: `Daily limit of $${DAILY_LIMIT} reached` }, { status: 400 })
  }

  // Mock mode (panic button for demo)
  if (process.env.MOCK_POLYGON_EXECUTION?.toLowerCase() === 'true') {
    await new Promise(r => setTimeout(r, 1500))
    const mockHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
    dailySpent += amount
    return NextResponse.json({
      success: true,
      source: 'polymarket-mock',
      orderID: `mock_${Date.now()}`,
      txHash: mockHash,
      polygonTxHash: mockHash,
      price: outcomeIndex === 0 ? 0.55 : 0.45,
      shares: amount / (outcomeIndex === 0 ? 0.55 : 0.45),
      amountUSD: amount,
      explorerUrl: `${POLYGON_EXPLORER}/tx/${mockHash}`,
      monadTxHash: monadTxHash || null,
      marketSlug,
      side: outcomeIndex === 0 ? 'Yes' : 'No',
    })
  }

  // Require monadTxHash for real execution
  if (!monadTxHash) {
    return NextResponse.json({ error: 'Missing monadTxHash: payment required before execution' }, { status: 400 })
  }

  await ensureOrdersTable()

  // REPLAY PROTECTION: Check if this monadTxHash was already used
  const existing = await sql`
    SELECT id, status, polygon_tx_hash FROM orders WHERE monad_tx_hash = ${monadTxHash} LIMIT 1
  `
  if (existing.length > 0) {
    const order = existing[0]
    if (order.status === 'success') {
      return NextResponse.json({
        error: `This payment was already used for order #${order.id}`,
        existingPolygonTxHash: order.polygon_tx_hash,
      }, { status: 409 })
    }
    if (order.status === 'pending') {
      return NextResponse.json({ error: 'This payment is already being processed' }, { status: 409 })
    }
    // If status is 'clob_failed', allow retry (delete old record)
    if (order.status === 'clob_failed') {
      await sql`DELETE FROM orders WHERE id = ${order.id}`
    }
  }

  // Payment gate: verify MON payment on Monad
  const verification = await verifyMonadPayment(monadTxHash, amount, monPriceUSD || 0)
  if (!verification.verified) {
    console.error('[Payment Gate] Verification failed:', verification.error)
    return NextResponse.json({
      error: `Payment not verified: ${verification.error}`,
    }, { status: 400 })
  }

  // PRICE VERIFICATION: Compute USD from on-chain MON value (don't trust client)
  const verifiedAmountUSD = verification.computedUSD || amount
  const tolerance = 0.15 // 15% tolerance for price drift
  if (verifiedAmountUSD < amount * (1 - tolerance)) {
    return NextResponse.json({
      error: `Payment too low: on-chain value ~$${verifiedAmountUSD.toFixed(2)}, bet requires $${amount.toFixed(2)}`,
    }, { status: 400 })
  }

  console.log(`[Payment Gate] Verified: ${verification.value} MON from ${verification.from} (~$${verifiedAmountUSD.toFixed(2)})`)

  // Insert order as PENDING before CLOB execution (locks the monadTxHash)
  // Resolve side label: use client-provided side if available, fallback to Yes/No
  const { side: clientSide } = body
  const side = clientSide || (outcomeIndex === 0 ? 'Yes' : 'No')
  await sql`
    INSERT INTO orders (monad_tx_hash, wallet_address, market_slug, condition_id, side, amount_usd, verified_amount_usd, mon_paid, mon_price_usd, status)
    VALUES (${monadTxHash}, ${verification.from || ''}, ${marketSlug}, ${conditionId}, ${side},
            ${amount}, ${verifiedAmountUSD}, ${verification.value || '0'}, ${monPriceUSD || 0}, 'pending')
  `

  // Check USDC balance (skip if RPC fails, let CLOB reject if insufficient)
  const balance = await getUSDCBalance()
  if (balance >= 0 && balance < amount) {
    await sql`UPDATE orders SET status = 'clob_failed', error_msg = 'Insufficient USDC balance', updated_at = NOW() WHERE monad_tx_hash = ${monadTxHash}`
    return NextResponse.json({
      error: `Insufficient USDC balance: $${balance.toFixed(2)} available, $${amount} needed`,
      orphanedPayment: true,
    }, { status: 400 })
  }

  try {
    // Execute real CLOB order on Polymarket
    const result = await executeClobBet({
      conditionId,
      outcomeIndex,
      amountUSD: amount,
      signalHash: signalHash || '',
      tokenId: tokenId || undefined,
      tickSize: tickSize || undefined,
      negRisk: negRisk !== undefined ? negRisk : undefined,
      marketSlug: marketSlug || undefined,
    })

    dailySpent += amount

    // Update order to SUCCESS
    await sql`
      UPDATE orders SET
        status = 'success',
        polygon_tx_hash = ${result.transactionHashes[0] || ''},
        order_id = ${result.orderID || ''},
        shares = ${result.shares},
        fill_price = ${result.price},
        updated_at = NOW()
      WHERE monad_tx_hash = ${monadTxHash}
    `

    return NextResponse.json({
      success: true,
      source: 'polymarket',
      orderID: result.orderID,
      txHash: result.transactionHashes[0] || '',
      polygonTxHash: result.transactionHashes[0] || '',
      price: result.price,
      shares: result.shares,
      amountUSD: result.amountUSD,
      explorerUrl: result.explorerUrl,
      monadTxHash: monadTxHash || null,
      marketSlug,
      side,
      tokenId: result.tokenId,
      tickSize: result.tickSize,
      negRisk: result.negRisk,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CLOB Execute] Error:', msg)

    // ORPHANED FUNDS: Mark order as clob_failed (MON paid but CLOB rejected)
    await sql`
      UPDATE orders SET status = 'clob_failed', error_msg = ${msg}, updated_at = NOW()
      WHERE monad_tx_hash = ${monadTxHash}
    `

    return NextResponse.json({ error: msg, orphanedPayment: true }, { status: 500 })
  }
}

// GET: Check execution status, balance, and orphaned orders
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')

  const balance = await getUSDCBalance()
  const today = new Date().toDateString()
  if (today !== dailyResetDate) {
    dailySpent = 0
    dailyResetDate = today
  }

  // If wallet provided, also return any failed/orphaned orders for that wallet
  let orphanedOrders: unknown[] = []
  if (wallet) {
    await ensureOrdersTable()
    orphanedOrders = await sql`
      SELECT id, monad_tx_hash, market_slug, side, amount_usd, mon_paid, status, error_msg, created_at
      FROM orders
      WHERE wallet_address = ${wallet.toLowerCase()} AND status = 'clob_failed'
      ORDER BY created_at DESC
      LIMIT 10
    `
  }

  return NextResponse.json({
    ready: !!process.env.POLYMARKET_PRIVATE_KEY,
    mock: process.env.MOCK_POLYGON_EXECUTION?.toLowerCase() === 'true',
    balance,
    dailySpent,
    dailyLimit: DAILY_LIMIT,
    dailyRemaining: DAILY_LIMIT - dailySpent,
    maxBetUSD: MAX_BET_USD,
    orphanedOrders,
  })
}
