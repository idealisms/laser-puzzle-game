import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const anonId = searchParams.get('anonId')

    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter required' },
        { status: 400 }
      )
    }

    const level = await prisma.level.findUnique({
      where: { date },
    })

    if (!level) {
      return NextResponse.json(
        { error: 'Level not found' },
        { status: 404 }
      )
    }

    // Determine player ID for highlighting their score
    const user = await getCurrentUser()
    let playerId: string | null = null

    if (user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { playerId: true },
      })
      playerId = dbUser?.playerId ?? null
    } else if (anonId) {
      playerId = anonId
    }

    // Get histogram distribution
    const groups = await prisma.scoreSubmission.groupBy({
      by: ['score'],
      where: { levelId: level.id },
      _count: { score: true },
      orderBy: { score: 'asc' },
    })

    const distribution: Record<number, number> = {}
    let totalPlayers = 0
    for (const group of groups) {
      distribution[group.score] = group._count.score
      totalPlayers += group._count.score
    }

    // Get player's score if available
    let playerScore: number | null = null
    if (playerId) {
      const submission = await prisma.scoreSubmission.findUnique({
        where: { levelId_playerId: { levelId: level.id, playerId } },
      })
      playerScore = submission?.score ?? null
    }

    return NextResponse.json({
      distribution,
      totalPlayers,
      playerScore,
    })
  } catch (error) {
    console.error('Error fetching histogram:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
