import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// GET /api/conversations/[id] - Get conversation with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const [conv] = await sql`SELECT * FROM conversations WHERE id = ${id}`
    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    const messages = await sql`
      SELECT * FROM conversation_messages
      WHERE conversation_id = ${id}
      ORDER BY created_at ASC
    `
    return NextResponse.json({ ...conv, messages })
  } catch (error) {
    console.error('[Conversations] Get error:', error)
    return NextResponse.json({ error: 'Failed to get conversation' }, { status: 500 })
  }
}

// PATCH /api/conversations/[id] - Update title
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const { title } = await request.json()
    if (!title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 })
    }
    await sql`
      UPDATE conversations SET title = ${title}, updated_at = NOW()
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Conversations] Update error:', error)
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 })
  }
}

// DELETE /api/conversations/[id] - Delete conversation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await sql`DELETE FROM conversations WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Conversations] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }
}
