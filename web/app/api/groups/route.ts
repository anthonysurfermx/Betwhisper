import { NextRequest, NextResponse } from 'next/server'
import { sql, generateInviteCode } from '@/lib/db'

// POST /api/groups - Create a group
export async function POST(request: NextRequest) {
  try {
    const { name, mode, creator_wallet, market_slug } = await request.json()

    if (!name || !mode || !creator_wallet) {
      return NextResponse.json({ error: 'name, mode, and creator_wallet required' }, { status: 400 })
    }
    if (!['draft_pool', 'leaderboard'].includes(mode)) {
      return NextResponse.json({ error: 'mode must be draft_pool or leaderboard' }, { status: 400 })
    }

    const invite_code = generateInviteCode()

    const [group] = await sql`
      INSERT INTO groups (name, mode, creator_wallet, invite_code, market_slug)
      VALUES (${name}, ${mode}, ${creator_wallet.toLowerCase()}, ${invite_code}, ${market_slug || null})
      RETURNING *
    `

    // Auto-add creator as first member
    await sql`
      INSERT INTO group_members (group_id, wallet_address)
      VALUES (${group.id}, ${creator_wallet.toLowerCase()})
    `

    return NextResponse.json(group, { status: 201 })
  } catch (error) {
    console.error('[Groups] Create error:', error)
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }
}

// GET /api/groups?wallet=0x... - List my groups
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')

  if (!wallet) {
    return NextResponse.json({ error: 'wallet param required' }, { status: 400 })
  }

  try {
    const groups = await sql`
      SELECT g.*,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count
      FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.wallet_address = ${wallet.toLowerCase()}
      ORDER BY g.created_at DESC
    `

    return NextResponse.json(groups)
  } catch (error) {
    console.error('[Groups] List error:', error)
    return NextResponse.json({ error: 'Failed to list groups' }, { status: 500 })
  }
}
