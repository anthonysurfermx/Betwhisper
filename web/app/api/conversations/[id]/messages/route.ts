import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// POST /api/conversations/[id]/messages - Append message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { role, text, source } = await request.json()
    if (!role || !text) {
      return NextResponse.json({ error: 'role and text required' }, { status: 400 })
    }
    const [msg] = await sql`
      INSERT INTO conversation_messages (conversation_id, role, text, source)
      VALUES (${id}, ${role}, ${text}, ${source || 'text'})
      RETURNING *
    `
    // Update conversation timestamp
    await sql`UPDATE conversations SET updated_at = NOW() WHERE id = ${id}`
    return NextResponse.json(msg, { status: 201 })
  } catch (error) {
    console.error('[Conversations] Append message error:', error)
    return NextResponse.json({ error: 'Failed to append message' }, { status: 500 })
  }
}
