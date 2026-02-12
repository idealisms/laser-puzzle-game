import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getTwitchAuthUrl } from '@/lib/twitch'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const state = crypto.randomUUID()

  const cookieStore = await cookies()
  cookieStore.set('twitch-oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  })

  // Store anonId in a cookie so the callback can use it as playerId for new users
  const anonId = request.nextUrl.searchParams.get('anonId')
  if (anonId && UUID_REGEX.test(anonId)) {
    cookieStore.set('twitch-anon-id', anonId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    })
  }

  return NextResponse.redirect(getTwitchAuthUrl(state))
}
