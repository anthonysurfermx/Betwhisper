import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { sql } from '@/lib/db'

let tableCreated = false
async function ensureUsersTable() {
  if (tableCreated) return
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      wallet_address TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      failed_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `
  tableCreated = true
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { wallet, pin } = body

  if (!wallet || !pin) {
    return NextResponse.json({ error: 'Missing wallet or pin' }, { status: 400 })
  }

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 })
  }

  await ensureUsersTable()

  const hash = await bcrypt.hash(pin, 10)
  const w = wallet.toLowerCase()

  const existing = await sql`SELECT id FROM users WHERE wallet_address = ${w} LIMIT 1`

  if (existing.length > 0) {
    await sql`
      UPDATE users SET pin_hash = ${hash}, failed_attempts = 0, locked_until = NULL, updated_at = NOW()
      WHERE wallet_address = ${w}
    `
  } else {
    await sql`
      INSERT INTO users (wallet_address, pin_hash) VALUES (${w}, ${hash})
    `
  }

  return NextResponse.json({ success: true })
}
