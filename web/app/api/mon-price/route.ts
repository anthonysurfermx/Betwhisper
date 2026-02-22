import { NextResponse } from 'next/server'
import { MON_PRICE_API } from '@/lib/constants'

let cachedPrice = 0.021
let cacheTime = 0

export async function GET() {
  const now = Date.now()
  if (now - cacheTime < 60_000 && cachedPrice > 0) {
    return NextResponse.json({ price: cachedPrice, source: 'coingecko', cached: true })
  }

  try {
    const res = await fetch(MON_PRICE_API, { next: { revalidate: 60 } })
    if (res.ok) {
      const data = await res.json()
      const price = data?.monad?.usd
      if (price && price > 0) {
        cachedPrice = price
        cacheTime = now
        return NextResponse.json({ price, source: 'coingecko', cached: false })
      }
    }
  } catch { /* fallback */ }

  return NextResponse.json({ price: cachedPrice, source: 'fallback', cached: true })
}
