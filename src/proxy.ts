import { NextResponse, type NextRequest } from 'next/server'
import { isOldHost } from '@/lib/siteConfig'

// On the old host, every page shows the "we've moved" page, which carries the
// player's localStorage over to the new site. API routes and static files keep
// working there so tabs left open don't break.
export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  if (isOldHost(host) && request.nextUrl.pathname !== '/moved') {
    return NextResponse.rewrite(new URL('/moved', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/|_next/|.*\\.[a-z0-9]+$).*)'],
}
