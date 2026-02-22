import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''

  // betwhisper.ai serves the BetWhisper landing page at root
  if (host.includes('betwhisper.ai') && request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/betwhisper', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/',
}
