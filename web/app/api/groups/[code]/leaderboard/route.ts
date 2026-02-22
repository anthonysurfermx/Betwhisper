import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// GET /api/groups/[code]/leaderboard - P&L rankings for a group
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  try {
    const [group] = await sql`
      SELECT * FROM groups WHERE invite_code = ${code}
    `

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const leaderboard = await sql`
      SELECT
        gm.wallet_address,
        COALESCE(SUM(gb.resolved_pnl), 0) as total_pnl,
        COUNT(gb.id) as bet_count
      FROM group_members gm
      LEFT JOIN group_bets gb ON gb.group_id = gm.group_id AND gb.member_wallet = gm.wallet_address
      WHERE gm.group_id = ${group.id}
      GROUP BY gm.wallet_address
      ORDER BY total_pnl DESC
    `

    return NextResponse.json({
      group_name: group.name,
      mode: group.mode,
      leaderboard,
    })
  } catch (error) {
    console.error('[Groups] Leaderboard error:', error)
    return NextResponse.json({ error: 'Failed to get leaderboard' }, { status: 500 })
  }
}
