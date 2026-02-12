import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createToken, setAuthCookie } from '@/lib/auth'
import { exchangeTwitchCode, getTwitchUser } from '@/lib/twitch'

export async function GET(request: NextRequest) {
  const loginUrl = new URL('/login', request.url)

  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')

    if (!code || !state) {
      loginUrl.searchParams.set('error', 'twitch_auth_failed')
      return NextResponse.redirect(loginUrl)
    }

    // Validate CSRF state and read anonId
    const cookieStore = await cookies()
    const savedState = cookieStore.get('twitch-oauth-state')?.value
    const anonId = cookieStore.get('twitch-anon-id')?.value
    cookieStore.delete('twitch-oauth-state')
    cookieStore.delete('twitch-anon-id')

    if (!savedState || savedState !== state) {
      loginUrl.searchParams.set('error', 'twitch_auth_failed')
      return NextResponse.redirect(loginUrl)
    }

    // Exchange code for access token
    const accessToken = await exchangeTwitchCode(code)

    // Fetch Twitch user info
    const twitchUser = await getTwitchUser(accessToken)

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { twitchId: twitchUser.id },
    })

    if (user) {
      // Update display name if changed
      if (user.twitchDisplayName !== twitchUser.display_name) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { twitchDisplayName: twitchUser.display_name },
        })
      }
    } else {
      // Create new user — find a unique username
      let username = twitchUser.display_name
      let suffix = 1
      while (await prisma.user.findUnique({ where: { username } })) {
        suffix++
        username = `${twitchUser.display_name}_${suffix}`
      }

      // Use anonId as playerId so anonymous ScoreSubmissions auto-associate
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const validAnonId = anonId && UUID_REGEX.test(anonId) ? anonId : undefined

      user = await prisma.user.create({
        data: {
          username,
          twitchId: twitchUser.id,
          twitchDisplayName: twitchUser.display_name,
          ...(validAnonId && { playerId: validAnonId }),
          stats: { create: {} },
        },
      })
    }

    // Issue JWT and set cookie
    const token = await createToken({ userId: user.id, username: user.username })
    await setAuthCookie(token)

    return NextResponse.redirect(new URL('/', request.url))
  } catch (error) {
    console.error('Twitch OAuth callback error:', error)
    loginUrl.searchParams.set('error', 'twitch_auth_failed')
    return NextResponse.redirect(loginUrl)
  }
}
