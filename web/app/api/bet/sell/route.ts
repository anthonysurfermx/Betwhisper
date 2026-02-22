import { NextRequest, NextResponse } from 'next/server'
import { executeClobSell } from '@/lib/polymarket-clob'
import { sendMON, getServerMONBalance } from '@/lib/monad-bet'
import { sql } from '@/lib/db'
import { verifyJWT, extractBearerToken } from '@/lib/auth'

// MON cashout: after CLOB sell, send MON equivalent to user on Monad
// Gas buffer deducted from cashout amount (~0.5 MON)
const GAS_BUFFER_MON = 0.5

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
    const result = await executeClobSell({
      tokenId,
      shares: Math.min(sharesToSell, currentShares),
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
      // Fetch MON price
      let monPriceUSD = 0.021
      try {
        const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd')
        if (priceRes.ok) {
          const priceData = await priceRes.json()
          if (priceData?.monad?.usd > 0) monPriceUSD = priceData.monad.usd
        }
      } catch { /* fallback */ }

      const monToSend = (result.amountUSD / monPriceUSD) - GAS_BUFFER_MON

      if (monToSend > 0) {
        const serverBalance = await getServerMONBalance()

        if (serverBalance > monToSend + GAS_BUFFER_MON) {
          try {
            const cashoutResult = await sendMON(wallet, monToSend)
            monCashout = {
              monAmount: monToSend,
              txHash: cashoutResult.txHash,
              explorerUrl: cashoutResult.explorerUrl,
              status: 'sent',
            }
            console.log(`[Cashout] Sent ${monToSend.toFixed(4)} MON to ${wallet}`)
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
