import { NextResponse } from 'next/server'
import { getServerUnlinkAddress } from '@/lib/unlink-server'

// Returns the server's Unlink address (unlink1...) for receiving private transfers
// Client calls this to know where to send the private transfer after depositing MON
export async function GET() {
  try {
    const address = await getServerUnlinkAddress()
    return NextResponse.json({ address })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to get Unlink address'
    console.error('[Unlink] Address error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
