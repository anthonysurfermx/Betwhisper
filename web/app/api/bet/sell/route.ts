import { NextRequest, NextResponse } from 'next/server'
import { executeClobSell } from '@/lib/polymarket-clob'
import { sendMON, getServerMONBalance } from '@/lib/monad-bet'
import { sql } from '@/lib/db'
import { verifyJWT, extractBearerToken } from '@/lib/auth'

// MON cashout: after CLOB sell, send MON equivalent to user on Monad
// Gas buffer for Monad tx (~21k gas at ~50 gwei = negligible, keep minimal)
const GAS_BUFFER_MON = 0.05

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { wallet, tokenId, shares, tickSize, negRisk, marketSlug } = body

  if (!wallet || !tokenId || !shares) {
    return NextResponse.json({ error: 'Missing required fields: wallet, tokenId, shares' }, { status: 400 })
  }

  // Auth: JWT (web with PIN) or iOS platform header (Face ID gated client-side)
  const platform = request.headers.get('x-platform')
  const token = extractBearerToken(request.headers.get('authorization'))

  if (platform === 'ios') {
    // iOS: Face ID is enforced on device. Verify wallet owns the position (checked below).
  } else if (token) {
    const payload = await verifyJWT(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
    if (payload.wallet !== wallet.toLowerCase()) {
      return NextResponse.json({ error: 'Token wallet mismatch' }, { status: 403 })
    }
  } else {
    return NextResponse.json({ error: 'Authorization required. Verify your PIN first.' }, { status: 401 })
  }

  const sharesToSell = parseFloat(shares)
  if (isNaN(sharesToSell) || sharesToSell <= 0) {
    return NextResponse.json({ error: 'Invalid shares amount' }, { status: 400 })
  }

  // Verify user has this position
  const positions = await sql`
    SELECT id, shares, avg_price, total_usd FROM positions
    WHERE wallet_address = ${wallet.toLowerCase()} AND token_id = ${tokenId} AND shares > 0
    LIMIT 1
  `

  if (positions.length === 0) {
    return NextResponse.json({ error: 'No open position found for this token' }, { status: 404 })
  }

  const position = positions[0]
  const currentShares = parseFloat(position.shares)

  if (sharesToSell > currentShares * 1.01) {
    return NextResponse.json({ error: `Cannot sell ${sharesToSell} shares, only ${currentShares} available` }, { status: 400 })
  }

  try {
    const isMock = process.env.MOCK_POLYGON_EXECUTION?.toLowerCase() === 'true'
    const actualShares = Math.min(sharesToSell, currentShares)
    const avgPrice = parseFloat(position.avg_price)

    // Mock mode: simulate CLOB sell
    const result = isMock
      ? {
          shares: actualShares,
          amountUSD: actualShares * avgPrice,
          price: avgPrice,
          transactionHashes: [`0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`],
          explorerUrl: '',
        }
      : await executeClobSell({
          tokenId,
          shares: actualShares,
          tickSize: tickSize || '0.01',
          negRisk: negRisk || false,
        })

    // Update position in database
    const remainingShares = currentShares - (result.shares || sharesToSell)

    if (remainingShares <= 0.001) {
      await sql`DELETE FROM positions WHERE id = ${position.id}`
    } else {
      await sql`
        UPDATE positions SET
          shares = ${remainingShares},
          total_usd = ${parseFloat(position.total_usd) - result.amountUSD},
          updated_at = NOW()
        WHERE id = ${position.id}
      `
    }

    // MON CASHOUT: Send MON equivalent to user on Monad
    let monCashout: { monAmount: number; txHash: string; explorerUrl: string; status: string } | null = null

    if (result.amountUSD > 0) {
      // Fetch MON price from shared oracle (throws if all sources fail → no cashout at wrong price)
      let monPriceUSD: number
      try {
        const { getMonPriceOrThrow } = await import('@/lib/mon-price')
        monPriceUSD = await getMonPriceOrThrow()
      } catch {
        // Price unavailable — skip cashout to avoid sending wrong amount
        return NextResponse.json({
          success: true,
          sharesSold: result.shares,
          usdReceived: result.amountUSD,
          price: result.price,
          polygonTxHash: result.transactionHashes[0] || '',
          explorerUrl: result.explorerUrl,
          remainingShares: Math.max(remainingShares, 0),
          marketSlug,
          monCashout: { monAmount: 0, txHash: '', explorerUrl: '', status: 'price_unavailable' },
        })
      }

      const monToSend = (result.amountUSD / monPriceUSD) - GAS_BUFFER_MON

      if (monToSend > 0) {
        const serverBalance = await getServerMONBalance()

        // Send full amount if possible, otherwise send what's available (partial cashout)
        const actualSend = serverBalance > monToSend + GAS_BUFFER_MON
          ? monToSend
          : Math.max(serverBalance - GAS_BUFFER_MON, 0)

        if (actualSend > 0.01) {
          try {
            const cashoutResult = await sendMON(wallet, actualSend)
            monCashout = {
              monAmount: actualSend,
              txHash: cashoutResult.txHash,
              explorerUrl: cashoutResult.explorerUrl,
              status: actualSend >= monToSend ? 'sent' : 'partial',
            }
            console.log(`[Cashout] Sent ${actualSend.toFixed(4)} MON to ${wallet} (requested: ${monToSend.toFixed(4)}, balance: ${serverBalance.toFixed(4)})`)
          } catch (err) {
            console.error('[Cashout] MON transfer failed:', err instanceof Error ? err.message : err)
            monCashout = { monAmount: monToSend, txHash: '', explorerUrl: '', status: 'failed' }
          }
        } else {
          console.warn(`[Cashout] Insufficient MON: need ${monToSend.toFixed(4)}, have ${serverBalance.toFixed(4)}`)
          monCashout = { monAmount: monToSend, txHash: '', explorerUrl: '', status: 'pending' }
        }
      }
    }

    return NextResponse.json({
      success: true,
      sharesSold: result.shares,
      usdReceived: result.amountUSD,
      price: result.price,
      polygonTxHash: result.transactionHashes[0] || '',
      explorerUrl: result.explorerUrl,
      remainingShares: Math.max(remainingShares, 0),
      marketSlug,
      monCashout,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[CLOB Sell] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
