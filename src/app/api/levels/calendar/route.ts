import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()

    // Get all available levels
    const levels = await prisma.level.findMany({
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
      },
    })

    // If user is logged in, get their progress
    let progressMap: Record<string, { completed: boolean; stars: number }> = {}

    if (user) {
      const progress = await prisma.levelProgress.findMany({
        where: { userId: user.userId },
        select: {
          levelId: true,
          completed: true,
          stars: true,
        },
      })

      progressMap = progress.reduce(
        (acc, p) => {
          acc[p.levelId] = { completed: p.completed, stars: p.stars }
          return acc
        },
        {} as Record<string, { completed: boolean; stars: number }>
      )
    }

    const calendar = levels.map((level) => ({
      date: level.date,
      available: true,
      completed: progressMap[level.id]?.completed ?? false,
      stars: progressMap[level.id]?.stars ?? 0,
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
