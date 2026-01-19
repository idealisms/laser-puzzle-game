import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const stats = await prisma.userStats.findUnique({
      where: { userId: user.userId },
    })

    if (!stats) {
      return NextResponse.json({
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          totalScore: 0,
          bestScore: 0,
          longestPath: 0,
          daysPlayed: 0,
          currentStreak: 0,
          longestStreak: 0,
        },
      })
    }

    return NextResponse.json({
      stats: {
        gamesPlayed: stats.gamesPlayed,
        gamesWon: stats.gamesWon,
        totalScore: stats.totalScore,
        bestScore: stats.bestScore,
        longestPath: stats.longestPath,
        daysPlayed: stats.daysPlayed,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
      },
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
