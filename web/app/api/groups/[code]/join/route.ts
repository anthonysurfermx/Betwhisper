import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// POST /api/groups/[code]/join - Join a group by invite code
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  try {
    const { wallet_address } = await request.json()

    if (!wallet_address) {
      return NextResponse.json({ error: 'wallet_address required' }, { status: 400 })
    }

    const [group] = await sql`
      SELECT * FROM groups WHERE invite_code = ${code}
    `

    if (!group) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
    }

    // Check if already a member
    const [existing] = await sql`
      SELECT id FROM group_members
      WHERE group_id = ${group.id} AND wallet_address = ${wallet_address.toLowerCase()}
    `

    if (existing) {
      return NextResponse.json({ error: 'Already a member', group }, { status: 409 })
    }

    await sql`
      INSERT INTO group_members (group_id, wallet_address)
      VALUES (${group.id}, ${wallet_address.toLowerCase()})
    `

    const [memberCount] = await sql`
      SELECT COUNT(*) as count FROM group_members WHERE group_id = ${group.id}
    `

    return NextResponse.json({
      joined: true,
      group_id: group.id,
      group_name: group.name,
      member_count: Number(memberCount.count),
    })
  } catch (error) {
    console.error('[Groups] Join error:', error)
    return NextResponse.json({ error: 'Failed to join group' }, { status: 500 })
  }
}
