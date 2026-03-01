import { NextResponse } from 'next/server'
import { getServerUnlinkWallet, getServerUnlinkAddress, getPoolBalance } from '@/lib/unlink-server'
import { UNLINK_USDC, UNLINK_USDT, UNLINK_ULNK } from '@/lib/constants'

// GET /api/unlink/status — Server wallet health check
// Returns wallet state, balances, and notes for debugging
export async function GET() {
  const startMs = Date.now()
  try {
    const wallet = await getServerUnlinkWallet()
    const initMs = Date.now() - startMs

    const address = await getServerUnlinkAddress()

    // Get balances for all supported tokens
    const [usdcBal, usdtBal, ulnkBal] = await Promise.all([
      wallet.getBalance(UNLINK_USDC).catch(() => BigInt(0)),
      wallet.getBalance(UNLINK_USDT).catch(() => BigInt(0)),
      wallet.getBalance(UNLINK_ULNK).catch(() => BigInt(0)),
    ])

    // Get notes (received transfers)
    const notes = await wallet.getNotes().catch(() => [])
    const notesSummary = (notes as Array<{ txHash?: string; amount?: bigint; token?: string }>).map((n, i) => ({
      index: i,
      txHash: n.txHash ? `${n.txHash.slice(0, 16)}...${n.txHash.slice(-8)}` : 'none',
      amount: n.amount?.toString() || '0',
      token: n.token || 'unknown',
    }))

    const totalMs = Date.now() - startMs

    return NextResponse.json({
      status: 'ok',
      address,
      balances: {
        USDC: { raw: usdcBal.toString(), formatted: `${(Number(usdcBal) / 1e18).toFixed(4)} USDC` },
        USDT: { raw: usdtBal.toString(), formatted: `${(Number(usdtBal) / 1e18).toFixed(4)} USDT` },
        ULNK: { raw: ulnkBal.toString(), formatted: `${(Number(ulnkBal) / 1e18).toFixed(4)} ULNK` },
      },
      notes: {
        count: notes.length,
        items: notesSummary.slice(0, 20), // Cap at 20 for response size
      },
      timing: { initMs, totalMs },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Unlink:Status] Error:', msg)
    return NextResponse.json({
      status: 'error',
      error: msg,
      timing: { totalMs: Date.now() - startMs },
    }, { status: 500 })
  }
}
