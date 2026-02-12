import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getTwitchAuthUrl } from '@/lib/twitch'

export async function GET() {
  const state = crypto.randomUUID()

  const cookieStore = await cookies()
  cookieStore.set('twitch-oauth-state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  })

  return NextResponse.redirect(getTwitchAuthUrl(state))
}
