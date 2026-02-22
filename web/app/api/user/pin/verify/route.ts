import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { sql } from '@/lib/db'
import { signJWT } from '@/lib/auth'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 60

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { wallet, pin } = body

  if (!wallet || !pin) {
    return NextResponse.json({ error: 'Missing wallet or pin' }, { status: 400 })
  }

  const w = wallet.toLowerCase()

  const users = await sql`
    SELECT id, pin_hash, failed_attempts, locked_until FROM users WHERE wallet_address = ${w} LIMIT 1
  `

  if (users.length === 0) {
    return NextResponse.json({ error: 'No PIN configured for this wallet' }, { status: 404 })
  }

  const user = users[0]

  // Rate limit check
  if (user.failed_attempts >= MAX_ATTEMPTS && user.locked_until) {
    const lockUntil = new Date(user.locked_until)
    if (lockUntil > new Date()) {
      const minutesLeft = Math.ceil((lockUntil.getTime() - Date.now()) / 60_000)
      return NextResponse.json({
        error: `Too many attempts. Try again in ${minutesLeft} minutes.`,
        locked: true,
        minutesLeft,
      }, { status: 429 })
    }
    // Lock expired, reset
    await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${user.id}`
    user.failed_attempts = 0
  }

  const match = await bcrypt.compare(pin, user.pin_hash)

  if (!match) {
    const newAttempts = (user.failed_attempts || 0) + 1
    const lockUntil = newAttempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
      : null

    await sql`
      UPDATE users SET failed_attempts = ${newAttempts}, locked_until = ${lockUntil}, updated_at = NOW()
      WHERE id = ${user.id}
    `

    return NextResponse.json({
      verified: false,
      attemptsRemaining: Math.max(MAX_ATTEMPTS - newAttempts, 0),
    })
  }

  // Success: reset attempts, issue JWT
  await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = ${user.id}`

  const token = await signJWT({ wallet: w }, 300) // 5 min

  return NextResponse.json({ verified: true, token })
}
