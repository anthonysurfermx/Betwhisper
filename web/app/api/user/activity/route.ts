import { NextRequest, NextResponse } from 'next/server'
import { getUserActivity } from '@/lib/polymarket'

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')
  if (!address) {
    return NextResponse.json({ error: 'address required' }, { status: 400 })
  }

  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
  const type = request.nextUrl.searchParams.get('type') || undefined

  try {
    const activity = await getUserActivity(address, limit, type)
    return NextResponse.json({ activity })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch activity', detail: String(error) },
      { status: 500 }
    )
  }
}
