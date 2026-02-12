import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { validateMirrors, computeScore } from '@/lib/scoring'

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const levelDate = searchParams.get('date')

    if (!levelDate) {
      return NextResponse.json(
        { error: 'Date parameter required' },
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

    const progress = await prisma.levelProgress.findUnique({
      where: {
        userId_levelId: {
          userId: user.userId,
          levelId: level.id,
        },
      },
    })

    if (!progress) {
      return NextResponse.json({ progress: null })
    }

    return NextResponse.json({
      progress: {
        completed: progress.completed,
        bestScore: progress.bestScore,
        attempts: progress.attempts,
        bestSolution: progress.bestSolution
          ? JSON.parse(progress.bestSolution)
          : null,
      },
    })
  } catch (error) {
    console.error('Error fetching progress:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const body = await request.json()
    const { levelDate, mirrors: mirrorInputs, anonId } = body

    // Determine player identity
    let playerId: string

    if (user) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { playerId: true },
      })
      if (!dbUser) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 401 }
        )
      }
      playerId = dbUser.playerId
    } else if (anonId && typeof anonId === 'string' && UUID_REGEX.test(anonId)) {
      playerId = anonId
    } else {
      return NextResponse.json(
        { error: 'Must be logged in or provide a valid anonId' },
        { status: 401 }
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
      where: { levelId_playerId: { levelId: level.id, playerId } },
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
        playerId,
        score,
      },
    })

    // For authenticated users, also update LevelProgress and UserStats
    if (user) {
      const solutionJson = JSON.stringify(mirrorInputs)

      await prisma.levelProgress.upsert({
        where: {
          userId_levelId: {
            userId: user.userId,
            levelId: level.id,
          },
        },
        create: {
          userId: user.userId,
          levelId: level.id,
          completed: true,
          bestScore: score,
          stars: 0,
          attempts: 1,
          bestSolution: solutionJson,
        },
        update: {
          completed: true,
          bestScore: score,
          attempts: { increment: 1 },
          bestSolution: solutionJson,
        },
      })

      await updateUserStats(user.userId, score)
    }

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

async function updateUserStats(userId: string, score: number) {
  const today = new Date().toISOString().split('T')[0]

  const stats = await prisma.userStats.findUnique({
    where: { userId },
  })

  if (!stats) {
    await prisma.userStats.create({
      data: {
        userId,
        gamesPlayed: 1,
        gamesWon: 1,
        totalScore: score,
        bestScore: score,
        longestPath: score,
        daysPlayed: 1,
        currentStreak: 1,
        longestStreak: 1,
        lastPlayedAt: new Date(),
      },
    })
    return
  }

  const lastPlayed = stats.lastPlayedAt
    ? stats.lastPlayedAt.toISOString().split('T')[0]
    : null

  let newStreak = stats.currentStreak
  if (lastPlayed) {
    const lastDate = new Date(lastPlayed)
    const todayDate = new Date(today)
    const diffDays = Math.floor(
      (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (diffDays === 1) {
      newStreak = stats.currentStreak + 1
    } else if (diffDays > 1) {
      newStreak = 1
    }
  }

  const isNewBest = score > stats.bestScore

  await prisma.userStats.update({
    where: { userId },
    data: {
      gamesPlayed: { increment: 1 },
      gamesWon: { increment: 1 },
      totalScore: { increment: score },
      bestScore: isNewBest ? score : stats.bestScore,
      longestPath: score > stats.longestPath ? score : stats.longestPath,
      daysPlayed:
        lastPlayed !== today ? { increment: 1 } : stats.daysPlayed,
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, stats.longestStreak),
      lastPlayedAt: new Date(),
    },
  })
}
