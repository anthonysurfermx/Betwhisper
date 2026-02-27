import { NextRequest, NextResponse } from 'next/server'
import { executeClobBet, getUSDCBalance } from '@/lib/polymarket-clob'
import { verifyMonadPayment } from '@/lib/monad-bet'
import { MAX_BET_USD, POLYGON_EXPLORER, DAILY_SPEND_LIMIT_USD, PAYMENT_TOLERANCE, RATE_LIMIT_PER_MINUTE } from '@/lib/constants'
import { sql } from '@/lib/db'

// Auto-create orders table (replay protection + order tracking + refund tracking)
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
      refund_status TEXT DEFAULT NULL,
      refund_tx_hash TEXT DEFAULT NULL,
      refund_mon_amount NUMERIC DEFAULT NULL,
      refund_attempted_at TIMESTAMP DEFAULT NULL,
      refund_error TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `
  // Add refund columns + indexes in parallel (all idempotent)
  await Promise.all([
    sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT NULL`,
    sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_tx_hash TEXT DEFAULT NULL`,
    sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_mon_amount NUMERIC DEFAULT NULL`,
    sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_attempted_at TIMESTAMP DEFAULT NULL`,
    sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_error TEXT DEFAULT NULL`,
    sql`CREATE INDEX IF NOT EXISTS idx_orders_wallet_status ON orders(wallet_address, status)`,
    sql`CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at)`,
  ])
  ordersTableCreated = true
}

// DB-backed daily limit (survives deploys and cold starts)
async function getDailySpent(): Promise<number> {
  const result = await sql`
    SELECT COALESCE(SUM(amount_usd), 0) as total
    FROM orders
    WHERE status = 'success' AND created_at >= CURRENT_DATE
  `
  return parseFloat(result[0]?.total || '0')
}

async function checkDailyLimit(amount: number): Promise<{ allowed: boolean; spent: number; remaining: number }> {
  const spent = await getDailySpent()
  const remaining = DAILY_SPEND_LIMIT_USD - spent
  return {
    allowed: (spent + amount) <= DAILY_SPEND_LIMIT_USD,
    spent,
    remaining,
  }
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

  // Run table setup + daily limit check in parallel
  const [, dailyCheck] = await Promise.all([
    ensureOrdersTable(),
    checkDailyLimit(amount),
  ])
  if (!dailyCheck.allowed) {
    return NextResponse.json({
      error: `Daily limit of $${DAILY_SPEND_LIMIT_USD} reached ($${dailyCheck.spent.toFixed(2)} spent today)`,
    }, { status: 429 })
  }

  // ── Pulse: save geo-located trade for heatmap ──
  const { lat, lng, side: clientSidePulse } = body
  if (lat && lng) {
    const pulseSide = clientSidePulse || (outcomeIndex === 0 ? 'Yes' : 'No')
    const bucket = amount < 10 ? '1-10' : amount < 50 ? '10-50' : amount < 100 ? '50-100' : '100+'
    const tsBucket = Math.floor(Date.now() / 60000) * 60000 // 60s window for privacy
    const walletHash = (body.walletAddress || '').slice(0, 10) || 'anon'
    sql`
      INSERT INTO pulse_trades (condition_id, side, amount_bucket, lat, lng, timestamp_bucket, wallet_hash)
      VALUES (${conditionId}, ${pulseSide}, ${bucket}, ${lat}, ${lng}, ${tsBucket}, ${walletHash})
    `.catch((e: unknown) => console.error('[Pulse] Failed to save trade:', e instanceof Error ? e.message : e))
  }

  // Mock mode (panic button for demo)
  if (process.env.MOCK_POLYGON_EXECUTION?.toLowerCase() === 'true') {
    await new Promise(r => setTimeout(r, 500))
    const mockHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`
    const mockPrice = outcomeIndex === 0 ? 0.55 : 0.45
    const mockShares = amount / mockPrice
    return NextResponse.json({
      success: true,
      source: 'polymarket-mock',
      orderID: `mock_${Date.now()}`,
      txHash: mockHash,
      polygonTxHash: mockHash,
      price: mockPrice,
      shares: mockShares,
      amountUSD: amount,
      explorerUrl: `${POLYGON_EXPLORER}/tx/${mockHash}`,
      monadTxHash: monadTxHash || null,
      marketSlug,
      side: outcomeIndex === 0 ? 'Yes' : 'No',
      tokenId: tokenId || `mock_token_${conditionId}_${outcomeIndex}`,
      tickSize: tickSize || '0.01',
      negRisk: negRisk || false,
    })
  }

  // Require monadTxHash for real execution
  if (!monadTxHash) {
    return NextResponse.json({ error: 'Missing monadTxHash: payment required before execution' }, { status: 400 })
  }

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
  if (verifiedAmountUSD < amount * (1 - PAYMENT_TOLERANCE)) {
    return NextResponse.json({
      error: `Payment too low: on-chain value ~$${verifiedAmountUSD.toFixed(2)}, bet requires $${amount.toFixed(2)}`,
    }, { status: 400 })
  }

  console.log(`[Payment Gate] Verified: ${verification.value} MON from ${verification.from} (~$${verifiedAmountUSD.toFixed(2)})`)

  // Per-wallet rate limit: max N trades per 60 seconds
  const walletForRateLimit = (verification.from || '').toLowerCase()
  if (walletForRateLimit) {
    const recentOrders = await sql`
      SELECT COUNT(*) as cnt FROM orders
      WHERE wallet_address = ${walletForRateLimit}
        AND created_at >= NOW() - INTERVAL '60 seconds'
    `
    if (parseInt(recentOrders[0]?.cnt || '0') >= RATE_LIMIT_PER_MINUTE) {
      return NextResponse.json({
        error: `Rate limited: maximum ${RATE_LIMIT_PER_MINUTE} trades per minute.`,
      }, { status: 429 })
    }
  }

  // Insert order as PENDING before CLOB execution (locks the monadTxHash)
  const { side: clientSide } = body
  const side = clientSide || (outcomeIndex === 0 ? 'Yes' : 'No')
  await sql`
    INSERT INTO orders (monad_tx_hash, wallet_address, market_slug, condition_id, side, amount_usd, verified_amount_usd, mon_paid, mon_price_usd, status)
    VALUES (${monadTxHash}, ${verification.from || ''}, ${marketSlug}, ${conditionId}, ${side},
            ${amount}, ${verifiedAmountUSD}, ${verification.value || '0'}, ${monPriceUSD || 0}, 'pending')
  `

  // Check USDC balance — FAIL-CLOSED: refuse trade if balance check fails
  const balance = await getUSDCBalance()
  if (balance < 0) {
    // RPC failed — cannot verify balance, refuse to proceed
    await sql`UPDATE orders SET status = 'clob_failed', error_msg = 'USDC balance check failed (RPC error)', updated_at = NOW() WHERE monad_tx_hash = ${monadTxHash}`
    return NextResponse.json({
      error: 'Unable to verify USDC balance. Please try again in a moment.',
      orphanedPayment: true,
      retryable: true,
    }, { status: 503 })
  }
  if (balance < amount) {
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
  const dailySpent = await getDailySpent()

  // If wallet provided, also return any failed/orphaned orders for that wallet
  let orphanedOrders: unknown[] = []
  if (wallet) {
    await ensureOrdersTable()
    orphanedOrders = await sql`
      SELECT id, monad_tx_hash, market_slug, side, amount_usd, mon_paid, status, error_msg, refund_status, refund_tx_hash, created_at
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
    dailyLimit: DAILY_SPEND_LIMIT_USD,
    dailyRemaining: DAILY_SPEND_LIMIT_USD - dailySpent,
    maxBetUSD: MAX_BET_USD,
    orphanedOrders,
  })
}
