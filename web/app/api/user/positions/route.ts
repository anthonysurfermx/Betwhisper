import { NextRequest, NextResponse } from 'next/server'
import { getUserPositions } from '@/lib/polymarket'

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')
  if (!address) {
    return NextResponse.json({ error: 'address required' }, { status: 400 })
  }

  try {
    const positions = await getUserPositions(address)
    return NextResponse.json({ positions })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch positions', detail: String(error) },
      { status: 500 }
    )
  }
}
