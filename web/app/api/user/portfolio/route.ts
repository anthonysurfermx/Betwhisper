import { NextRequest, NextResponse } from 'next/server'
import { getUserPortfolioValue, getUserProfile, getUserPositions, getUserActivity } from '@/lib/polymarket'

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')
  if (!address) {
    return NextResponse.json({ error: 'address required' }, { status: 400 })
  }

  try {
    const [value, profile, positions, activity] = await Promise.all([
      getUserPortfolioValue(address),
      getUserProfile(address),
      getUserPositions(address),
      getUserActivity(address, 20, 'TRADE'),
    ])

    // Compute summary stats from positions
    let totalPnl = 0
    let winCount = 0
    let lossCount = 0
    for (const pos of positions) {
      totalPnl += pos.pnl
      if (pos.pnl > 0) winCount++
      else if (pos.pnl < 0) lossCount++
    }

    return NextResponse.json({
      profile,
      portfolioValue: value.totalValue,
      positions,
      recentTrades: activity,
      stats: {
        totalPnl: Math.round(totalPnl * 100) / 100,
        openPositions: positions.length,
        winCount,
        lossCount,
        winRate: positions.length > 0
          ? Math.round((winCount / (winCount + lossCount || 1)) * 100)
          : 0,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch portfolio', detail: String(error) },
      { status: 500 }
    )
  }
}
