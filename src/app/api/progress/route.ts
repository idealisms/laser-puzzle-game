import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateMirrors, computeScore } from '@/lib/scoring'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { levelDate, mirrors: mirrorInputs, anonId } = body

    if (!anonId || typeof anonId !== 'string' || !UUID_REGEX.test(anonId)) {
      return NextResponse.json(
        { error: 'A valid anonId is required' },
        { status: 400 }
      )
    }

    if (!levelDate || !Array.isArray(mirrorInputs)) {
      return NextResponse.json(
        { error: 'Missing required fields: levelDate, mirrors' },
        { status: 400 }
      )
    }

    const level = await prisma.level.findUnique({
      where: { date: levelDate },
    })

    if (!level) {
      return NextResponse.json(
        { error: 'Level not found' },
        { status: 404 }
      )
    }

    // Check if already submitted
    const existingSubmission = await prisma.scoreSubmission.findUnique({
      where: { levelId_playerId: { levelId: level.id, playerId: anonId } },
    })

    if (existingSubmission) {
      return NextResponse.json(
        { error: 'Score already submitted for this level' },
        { status: 409 }
      )
    }

    // Validate mirrors
    const validation = validateMirrors(mirrorInputs, level)
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid mirrors: ${validation.error}` },
        { status: 400 }
      )
    }

    // Compute score server-side
    const score = computeScore(validation.mirrors, level)

    // Create ScoreSubmission
    await prisma.scoreSubmission.create({
      data: {
        levelId: level.id,
        playerId: anonId,
        score,
      },
    })

    // Fetch histogram
    const histogram = await getHistogram(level.id)

    return NextResponse.json({
      score,
      histogram,
    })
  } catch (error) {
    console.error('Error saving progress:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getHistogram(levelId: string) {
  const groups = await prisma.scoreSubmission.groupBy({
    by: ['score'],
    where: { levelId },
    _count: { score: true },
    orderBy: { score: 'asc' },
  })

  const distribution: Record<number, number> = {}
  let totalPlayers = 0

  for (const group of groups) {
    distribution[group.score] = group._count.score
    totalPlayers += group._count.score
  }

  return { distribution, totalPlayers }
}
