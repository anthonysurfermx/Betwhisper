import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendMON, getServerMONBalance } from '@/lib/monad-bet'
import { REFUND_GAS_BUFFER_MON } from '@/lib/constants'

// Auto-refund worker: scans clob_failed orders, sends MON back to users
// Uses FOR UPDATE SKIP LOCKED to prevent double-spend from concurrent executions
// Max 3 refunds per run (fits in Vercel 30s timeout)

const MAX_REFUNDS_PER_RUN = 3

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Array<{ orderId: number; status: string; txHash?: string; error?: string }> = []

  try {
    // Check server MON balance first
    const serverBalance = await getServerMONBalance()
    if (serverBalance <= 0) {
      return NextResponse.json({
        message: 'Server MON balance unavailable or zero',
        refunded: 0,
        results: [],
      })
    }

    // Atomic lock: SELECT ... FOR UPDATE SKIP LOCKED prevents concurrent cron
    // executions from picking the same orders (prevents double-spend)
    const failedOrders = await sql`
      SELECT id, monad_tx_hash, wallet_address, amount_usd, mon_paid, mon_price_usd
      FROM orders
      WHERE status = 'clob_failed'
        AND (refund_status IS NULL OR refund_status = 'failed')
        AND mon_paid::numeric > 0
        AND wallet_address != ''
        AND created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at ASC
      LIMIT ${MAX_REFUNDS_PER_RUN}
      FOR UPDATE SKIP LOCKED
    `

    if (failedOrders.length === 0) {
      return NextResponse.json({
        message: 'No orders to refund',
        refunded: 0,
        results: [],
      })
    }

    for (const order of failedOrders) {
      const orderId = order.id
      const monPaid = parseFloat(order.mon_paid)

      // Subsidize gas: refund full MON amount (gas cost absorbed by server)
      const monToRefund = monPaid

      if (monToRefund <= 0) {
        results.push({ orderId, status: 'skipped', error: 'Zero MON amount' })
        continue
      }

      // Check if server has enough balance for this refund
      if (serverBalance < monToRefund + REFUND_GAS_BUFFER_MON) {
        // Mark as failed so it gets retried when balance is replenished
        await sql`
          UPDATE orders SET
            refund_status = 'failed',
            refund_error = 'Insufficient server MON balance',
            refund_attempted_at = NOW(),
            updated_at = NOW()
          WHERE id = ${orderId}
        `
        results.push({ orderId, status: 'insufficient_balance' })
        continue
      }

      // Mark as processing BEFORE sending (prevents re-pick on crash)
      await sql`
        UPDATE orders SET
          refund_status = 'processing',
          refund_attempted_at = NOW(),
          updated_at = NOW()
        WHERE id = ${orderId}
      `

      try {
        const txResult = await sendMON(order.wallet_address, monToRefund)

        await sql`
          UPDATE orders SET
            refund_status = 'refunded',
            refund_tx_hash = ${txResult.txHash},
            refund_mon_amount = ${monToRefund},
            updated_at = NOW()
          WHERE id = ${orderId}
        `

        results.push({ orderId, status: 'refunded', txHash: txResult.txHash })
        console.log(`[Refund] Sent ${monToRefund.toFixed(4)} MON to ${order.wallet_address} (order #${orderId})`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'

        await sql`
          UPDATE orders SET
            refund_status = 'failed',
            refund_error = ${errorMsg},
            updated_at = NOW()
          WHERE id = ${orderId}
        `

        results.push({ orderId, status: 'failed', error: errorMsg })
        console.error(`[Refund] Failed for order #${orderId}:`, errorMsg)
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Refund Cron] Error:', errorMsg)
    return NextResponse.json({ error: errorMsg, results }, { status: 500 })
  }

  return NextResponse.json({
    message: `Processed ${results.length} orders`,
    refunded: results.filter(r => r.status === 'refunded').length,
    results,
  })
}
