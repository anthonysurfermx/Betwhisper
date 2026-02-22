import { NextRequest, NextResponse } from 'next/server'
import { searchMarkets, getTrendingMarkets } from '@/lib/polymarket'
import { FALLBACK_EVENTS } from '@/lib/fallback-markets'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') || ''
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '8')

  try {
    const events = q
      ? await searchMarkets(q, limit)
      : await getTrendingMarkets(limit)

    if (events.length === 0 && FALLBACK_EVENTS.length > 0) {
      return NextResponse.json({ events: FALLBACK_EVENTS, cached: true })
    }

    return NextResponse.json({ events, cached: false })
  } catch {
    // Serve fallback if Polymarket API is down
    return NextResponse.json({ events: FALLBACK_EVENTS, cached: true })
  }
}
