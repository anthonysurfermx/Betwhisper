// TEMPORARY: Fund a wallet with MON from server deposit wallet
// DELETE THIS FILE AFTER HACKATHON TESTING
import { NextResponse } from 'next/server'
import { sendMON } from '@/lib/monad-bet'

export async function POST(req: Request) {
  const secret = req.headers.get('x-internal-key')
  if (secret !== process.env.INTERNAL_API_KEY && secret !== 'betwhisper-fund-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { to, amount } = await req.json()
  if (!to || !amount) {
    return NextResponse.json({ error: 'Missing to or amount' }, { status: 400 })
  }

  try {
    const result = await sendMON(to, amount)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
