import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ date: string }>
}

/**
 * Check if a date is accessible based on server time.
 * Allows access if the date has started in any timezone (UTC+14 is the earliest).
 * This means users can access a puzzle up to 14 hours "early" from UTC perspective.
 */
function isDateAccessible(dateStr: string): boolean {
  const now = new Date()
  // Add 14 hours to current UTC time to account for UTC+14 (earliest timezone)
  const adjustedNow = new Date(now.getTime() + 14 * 60 * 60 * 1000)
  const adjustedDateStr = adjustedNow.toISOString().split('T')[0]
  return dateStr <= adjustedDateStr
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { date } = await params

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    // Prevent access to future dates (server-side check)
    if (!isDateAccessible(date)) {
      return NextResponse.json(
        { error: 'This puzzle is not yet available' },
        { status: 403 }
      )
    }

    const level = await prisma.level.findUnique({
      where: { date },
    })

    if (!level) {
      return NextResponse.json(
        { error: 'Level not found for this date' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      level: {
        id: level.id,
        date: level.date,
        gridWidth: level.gridWidth,
        gridHeight: level.gridHeight,
        laserConfig: JSON.parse(level.laserConfig),
        obstacles: JSON.parse(level.obstacles),
        mirrorsAvailable: level.mirrorsAvailable,
        optimalScore: level.optimalScore,
        optimalSolution: level.optimalSolution ? JSON.parse(level.optimalSolution) : null,
      },
    })
  } catch (error) {
    console.error('Error fetching level:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
