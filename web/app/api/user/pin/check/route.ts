import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')
  if (!wallet) {
    return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 })
  }

  try {
    const users = await sql`
      SELECT id FROM users WHERE wallet_address = ${wallet.toLowerCase()} LIMIT 1
    `
    return NextResponse.json({ hasPin: users.length > 0 })
  } catch {
    // Table doesn't exist yet = no PIN set
    return NextResponse.json({ hasPin: false })
  }
}
