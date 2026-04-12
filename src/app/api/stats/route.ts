import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function getTodayDate(): string {
  const now = new Date()
  const adjustedNow = new Date(now.getTime() + 14 * 60 * 60 * 1000)
  return adjustedNow.toISOString().split('T')[0]
}

export async function GET() {
  try {
    const today = getTodayDate()

    const allLevels = await prisma.level.findMany({
      orderBy: { date: 'asc' },
      select: {
        date: true,
        _count: { select: { submissions: true } },
      },
    })

    const pastLevels = allLevels.filter((l) => l.date <= today)
    const futureLevels = allLevels.filter((l) => l.date > today)

    const days = pastLevels.map((l) => ({
      date: l.date,
      players: l._count.submissions,
    }))

    const futurePuzzleCount = futureLevels.length
    const lastFutureDate =
      futureLevels.length > 0 ? futureLevels[futureLevels.length - 1].date : null

    return NextResponse.json({ days, futurePuzzleCount, lastFutureDate })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
