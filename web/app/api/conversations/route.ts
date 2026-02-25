import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

let tableCreated = false
async function ensureTables() {
  if (tableCreated) return
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wallet_address TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'New Conversation',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      source TEXT DEFAULT 'text',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
  tableCreated = true
}

// POST /api/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const { wallet_address, title } = await request.json()
    if (!wallet_address) {
      return NextResponse.json({ error: 'wallet_address required' }, { status: 400 })
    }
    await ensureTables()
    const [conv] = await sql`
      INSERT INTO conversations (wallet_address, title)
      VALUES (${wallet_address.toLowerCase()}, ${title || 'New Conversation'})
      RETURNING *
    `
    return NextResponse.json(conv, { status: 201 })
  } catch (error) {
    console.error('[Conversations] Create error:', error)
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}

// GET /api/conversations?wallet=0x... - List conversations
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')
  if (!wallet) {
    return NextResponse.json({ error: 'wallet param required' }, { status: 400 })
  }
  try {
    await ensureTables()
    const conversations = await sql`
      SELECT c.*,
        (SELECT cm.text FROM conversation_messages cm WHERE cm.conversation_id = c.id ORDER BY cm.created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id = c.id) as message_count
      FROM conversations c
      WHERE c.wallet_address = ${wallet.toLowerCase()}
      ORDER BY c.updated_at DESC
      LIMIT 50
    `
    return NextResponse.json(conversations)
  } catch (error) {
    console.error('[Conversations] List error:', error)
    return NextResponse.json({ error: 'Failed to list conversations' }, { status: 500 })
  }
}
