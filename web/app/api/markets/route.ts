import { NextRequest, NextResponse } from 'next/server'
import { searchMarkets, getTrendingMarkets } from '@/lib/polymarket'
import { FALLBACK_EVENTS } from '@/lib/fallback-markets'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') || ''
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '8')

  console.log(`[Markets API] query="${q}" limit=${limit}`)

  try {
    const events = q
      ? await searchMarkets(q, limit)
      : await getTrendingMarkets(limit)

    console.log(`[Markets API] ${events.length} events found for "${q}"`, events.map(e => e.title))

    if (events.length === 0 && FALLBACK_EVENTS.length > 0) {
      console.log(`[Markets API] No results, serving fallback`)
      return NextResponse.json({ events: FALLBACK_EVENTS, cached: true })
    }

    return NextResponse.json({ events, cached: false, v: 2 })
  } catch (err) {
    console.error(`[Markets API] Error:`, err)
    return NextResponse.json({ events: FALLBACK_EVENTS, cached: true })
  }
}
