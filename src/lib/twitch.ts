const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID!
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET!
const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI!

export function getTwitchAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: TWITCH_REDIRECT_URI,
    response_type: 'code',
    scope: 'user:read:email',
    state,
  })
  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`
}

export async function exchangeTwitchCode(code: string): Promise<string> {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: TWITCH_REDIRECT_URI,
    }),
  })

  if (!res.ok) {
    throw new Error(`Twitch token exchange failed: ${res.status}`)
  }

  const data = await res.json()
  return data.access_token
}

export interface TwitchUser {
  id: string
  login: string
  display_name: string
}

export async function getTwitchUser(accessToken: string): Promise<TwitchUser> {
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': TWITCH_CLIENT_ID,
    },
  })

  if (!res.ok) {
    throw new Error(`Twitch user fetch failed: ${res.status}`)
  }

  const data = await res.json()
  return data.data[0]
}
