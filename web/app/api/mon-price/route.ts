import { NextResponse } from 'next/server'
import { getMonPrice } from '@/lib/mon-price'

export async function GET() {
  const result = await getMonPrice()

  if (result.price === null) {
    return NextResponse.json({
      error: 'All price sources failed',
      source: result.source,
      sourcesChecked: result.sourcesChecked,
      sourcesResponded: result.sourcesResponded,
    }, { status: 503 })
  }

  return NextResponse.json({
    price: result.price,
    source: result.source,
    cached: result.cached,
    sourcesChecked: result.sourcesChecked,
    sourcesResponded: result.sourcesResponded,
  })
}
