import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, createToken, setAuthCookie } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { username, password, anonId } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 20 characters' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(password)

    // If anonId is a valid UUID, use it as playerId so ScoreSubmissions auto-associate
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const validAnonId = typeof anonId === 'string' && UUID_REGEX.test(anonId) ? anonId : undefined

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        ...(validAnonId && { playerId: validAnonId }),
        stats: {
          create: {},
        },
      },
    })

    const token = await createToken({ userId: user.id, username: user.username })
    await setAuthCookie(token)

    return NextResponse.json({
      user: { id: user.id, username: user.username },
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
