import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

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
        stars: progress.stars,
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

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { levelDate, score, stars, solution } = await request.json()

    if (!levelDate || score === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Get existing progress
    const existingProgress = await prisma.levelProgress.findUnique({
      where: {
        userId_levelId: {
          userId: user.userId,
          levelId: level.id,
        },
      },
    })

    const isNewBest = !existingProgress || score > existingProgress.bestScore

    // Update or create progress
    const progress = await prisma.levelProgress.upsert({
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
        stars: stars || 0,
        attempts: 1,
        bestSolution: solution ? JSON.stringify(solution) : null,
      },
      update: {
        completed: true,
        bestScore: isNewBest ? score : (existingProgress?.bestScore ?? score),
        stars: isNewBest ? (stars || 0) : (existingProgress?.stars ?? 0),
        attempts: { increment: 1 },
        bestSolution: isNewBest && solution
          ? JSON.stringify(solution)
          : (existingProgress?.bestSolution ?? null),
      },
    })

    // Update user stats
    await updateUserStats(user.userId, score, isNewBest)

    return NextResponse.json({
      progress: {
        completed: progress.completed,
        bestScore: progress.bestScore,
        stars: progress.stars,
        attempts: progress.attempts,
        isNewBest,
      },
    })
  } catch (error) {
    console.error('Error saving progress:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function updateUserStats(userId: string, score: number, isNewBest: boolean) {
  const today = new Date().toISOString().split('T')[0]

  const stats = await prisma.userStats.findUnique({
    where: { userId },
  })

  if (!stats) {
    // Create stats if they don't exist
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

  // Calculate streak
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
    // If same day, keep the streak
  }

  await prisma.userStats.update({
    where: { userId },
    data: {
      gamesPlayed: { increment: 1 },
      gamesWon: { increment: 1 },
      totalScore: { increment: score },
      bestScore: isNewBest && score > stats.bestScore ? score : stats.bestScore,
      longestPath: score > stats.longestPath ? score : stats.longestPath,
      daysPlayed:
        lastPlayed !== today ? { increment: 1 } : stats.daysPlayed,
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, stats.longestStreak),
      lastPlayedAt: new Date(),
    },
  })
}
