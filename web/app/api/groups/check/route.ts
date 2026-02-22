import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// GET /api/groups/check?wallet=0x... - AI Gate eligibility check
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')

  if (!wallet) {
    return NextResponse.json({ error: 'wallet param required' }, { status: 400 })
  }

  try {
    // Check if this wallet is in any group that has at least 2 members
    const result = await sql`
      SELECT g.id, g.name, g.mode,
        (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) as member_count
      FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.wallet_address = ${wallet.toLowerCase()}
      AND (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) >= 2
      LIMIT 1
    `

    const eligible = result.length > 0

    return NextResponse.json({
      eligible,
      group: eligible ? result[0] : null,
    })
  } catch (error) {
    console.error('[Groups] Check error:', error)
    return NextResponse.json({ error: 'Failed to check eligibility' }, { status: 500 })
  }
}
