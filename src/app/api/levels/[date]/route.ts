import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseMirrorList } from '@/lib/mirrorFormat'
import { isPuzzleReleased } from '@/lib/puzzleInfo'

interface RouteParams {
  params: Promise<{ date: string }>
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

    // Prevent access to future dates (server-side check, bypassed in dev mode)
    if (!isPuzzleReleased(date)) {
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
        optimalSolution: level.optimalSolution
          ? parseMirrorList(JSON.parse(level.optimalSolution))
          : null,
      },
    }, {
      headers: {
        'X-Site-Version': process.env.NEXT_PUBLIC_SITE_VERSION ?? 'dev',
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
