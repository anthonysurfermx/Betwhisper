import { NextRequest, NextResponse } from 'next/server'
import { GAMMA_API, CLOB_API } from '@/lib/constants'

// GET /api/markets/history?slug=market-slug&interval=1d&fidelity=5
// Returns price history for a market (YES outcome token)
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')
  const conditionId = request.nextUrl.searchParams.get('conditionId')
  const interval = request.nextUrl.searchParams.get('interval') || '1d'
  const fidelity = request.nextUrl.searchParams.get('fidelity') || '5'

  if (!slug && !conditionId) {
    return NextResponse.json({ error: 'slug or conditionId required' }, { status: 400 })
  }

  try {
    // Step 1: Get clobTokenIds from Gamma API (prefer slug, fallback conditionId)
    const query = slug
      ? `slug=${encodeURIComponent(slug)}`
      : `conditionId=${conditionId}`

    const marketRes = await fetch(
      `${GAMMA_API}/markets?${query}&_limit=1`,
      { next: { revalidate: 300 } }
    )
    if (!marketRes.ok) {
      return NextResponse.json({ history: [] })
    }
    const markets = await marketRes.json()
    if (!Array.isArray(markets) || markets.length === 0) {
      return NextResponse.json({ history: [] })
    }

    const tokenIds = JSON.parse(markets[0].clobTokenIds || '[]')
    if (tokenIds.length === 0) {
      return NextResponse.json({ history: [] })
    }

    // Step 2: Fetch price history from CLOB API (YES token = index 0)
    // Try requested interval first, fall back to wider intervals for more data
    const intervals = [interval, '1w', 'all']
    let history: { t: number; p: number }[] = []

    for (const iv of intervals) {
      const historyRes = await fetch(
        `${CLOB_API}/prices-history?market=${tokenIds[0]}&interval=${iv}&fidelity=${fidelity}`
      )
      if (historyRes.ok) {
        const data = await historyRes.json()
        history = data.history || []
        if (history.length >= 5) break // Got enough data
      }
    }

    return NextResponse.json({
      history,
      question: markets[0].question || '',
      yesPrice: parseFloat(JSON.parse(markets[0].outcomePrices || '[]')[0]) || 0,
    })
  } catch (err) {
    console.error('[Markets History] Error:', err)
    return NextResponse.json({ history: [] })
  }
}
