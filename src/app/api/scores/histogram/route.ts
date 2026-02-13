import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // Get player's score if anonId provided
    let playerScore: number | null = null
    if (anonId) {
      const submission = await prisma.scoreSubmission.findUnique({
        where: { levelId_playerId: { levelId: level.id, playerId: anonId } },
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
