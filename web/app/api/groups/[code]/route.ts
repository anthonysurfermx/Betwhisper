import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// GET /api/groups/[code] - Group details by invite code
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  try {
    const [group] = await sql`
      SELECT g.*,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count
      FROM groups g
      WHERE g.invite_code = ${code}
    `

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const members = await sql`
      SELECT wallet_address, joined_at
      FROM group_members
      WHERE group_id = ${group.id}
      ORDER BY joined_at ASC
    `

    return NextResponse.json({ ...group, members })
  } catch (error) {
    console.error('[Groups] Detail error:', error)
    return NextResponse.json({ error: 'Failed to get group' }, { status: 500 })
  }
}

// DELETE /api/groups/[code]?wallet=0x... - Delete group (creator only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const wallet = request.nextUrl.searchParams.get('wallet')

  if (!wallet) {
    return NextResponse.json({ error: 'wallet param required' }, { status: 400 })
  }

  try {
    const [group] = await sql`
      SELECT id, creator_wallet FROM groups WHERE invite_code = ${code}
    `

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    if (group.creator_wallet !== wallet.toLowerCase()) {
      return NextResponse.json({ error: 'Only the creator can delete this group' }, { status: 403 })
    }

    // Delete members first (FK), then bets, then group
    await sql`DELETE FROM group_bets WHERE group_id = ${group.id}`
    await sql`DELETE FROM group_members WHERE group_id = ${group.id}`
    await sql`DELETE FROM groups WHERE id = ${group.id}`

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('[Groups] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 })
  }
}
