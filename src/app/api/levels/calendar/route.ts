import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * Get the latest accessible date based on server time.
 * Allows access if the date has started in any timezone (UTC+14 is the earliest).
 */
function getMaxAccessibleDate(): string {
  const now = new Date()
  // Add 14 hours to current UTC time to account for UTC+14 (earliest timezone)
  const adjustedNow = new Date(now.getTime() + 14 * 60 * 60 * 1000)
  return adjustedNow.toISOString().split('T')[0]
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    const maxDate = getMaxAccessibleDate()

    // Get all available levels up to the max accessible date
    const levels = await prisma.level.findMany({
      where: {
        date: { lte: maxDate },
      },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
      },
    })

    // If user is logged in, get their progress
    let progressMap: Record<string, { completed: boolean; bestScore: number }> = {}

    if (user) {
      const progress = await prisma.levelProgress.findMany({
        where: { userId: user.userId },
        select: {
          levelId: true,
          completed: true,
          bestScore: true,
        },
      })

      progressMap = progress.reduce(
        (acc, p) => {
          acc[p.levelId] = { completed: p.completed, bestScore: p.bestScore }
          return acc
        },
        {} as Record<string, { completed: boolean; bestScore: number }>
      )
    }

    const calendar = levels.map((level) => ({
      date: level.date,
      available: true,
      completed: progressMap[level.id]?.completed ?? false,
      bestScore: progressMap[level.id]?.bestScore ?? null,
    }))

    return NextResponse.json({ calendar })
  } catch (error) {
    console.error('Error fetching calendar:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
