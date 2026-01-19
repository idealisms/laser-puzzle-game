import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export async function GET() {
  try {
    const today = getTodayDate()

    const level = await prisma.level.findUnique({
      where: { date: today },
    })

    if (!level) {
      return NextResponse.json(
        { error: 'No level available for today' },
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
        starThresholds: JSON.parse(level.starThresholds),
      },
    })
  } catch (error) {
    console.error('Error fetching today level:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
