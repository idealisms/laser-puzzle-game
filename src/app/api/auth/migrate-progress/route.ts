import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface LocalProgressEntry {
  bestScore: number
  bestSolution?: Array<{ x: number; y: number; type: string }>
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { anonId, localProgress } = body as {
      anonId?: string
      localProgress?: Record<string, LocalProgressEntry>
    }

    // Look up user's playerId
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { playerId: true },
    })
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userPlayerId = dbUser.playerId
    const validAnonId = typeof anonId === 'string' && UUID_REGEX.test(anonId) ? anonId : null

    // Transfer ScoreSubmissions from anonId to user's playerId (for existing-account login)
    if (validAnonId && validAnonId !== userPlayerId) {
      const anonSubmissions = await prisma.scoreSubmission.findMany({
        where: { playerId: validAnonId },
      })

      for (const submission of anonSubmissions) {
        try {
          await prisma.scoreSubmission.update({
            where: { id: submission.id },
            data: { playerId: userPlayerId },
          })
        } catch {
          // Skip unique constraint conflicts (user already has a submission for this level)
          await prisma.scoreSubmission.delete({ where: { id: submission.id } })
        }
      }
    }

    // Create LevelProgress records from localProgress + server-validated scores
    let migrated = 0

    if (localProgress && typeof localProgress === 'object') {
      const dates = Object.keys(localProgress)

      for (const date of dates) {
        const entry = localProgress[date]
        if (!entry || typeof entry.bestScore !== 'number') continue

        // Find the level for this date
        const level = await prisma.level.findUnique({
          where: { date },
        })
        if (!level) continue

        // Look up the ScoreSubmission for this level + user's playerId
        const submission = await prisma.scoreSubmission.findUnique({
          where: { levelId_playerId: { levelId: level.id, playerId: userPlayerId } },
        })
        if (!submission) continue // Don't trust client scores without server validation

        const solutionJson = entry.bestSolution ? JSON.stringify(entry.bestSolution) : null

        // Upsert LevelProgress — only update if the server-validated score is better
        const existing = await prisma.levelProgress.findUnique({
          where: { userId_levelId: { userId: user.userId, levelId: level.id } },
        })

        if (existing) {
          if (submission.score > existing.bestScore) {
            await prisma.levelProgress.update({
              where: { id: existing.id },
              data: {
                completed: true,
                bestScore: submission.score,
                bestSolution: solutionJson ?? existing.bestSolution,
              },
            })
            migrated++
          }
        } else {
          await prisma.levelProgress.create({
            data: {
              userId: user.userId,
              levelId: level.id,
              completed: true,
              bestScore: submission.score,
              stars: 0,
              attempts: 1,
              bestSolution: solutionJson,
            },
          })
          migrated++
        }
      }
    }

    // Update UserStats from all completed LevelProgress
    await rebuildUserStats(user.userId)

    return NextResponse.json({ migrated })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function rebuildUserStats(userId: string) {
  const allProgress = await prisma.levelProgress.findMany({
    where: { userId, completed: true },
    include: { level: { select: { date: true } } },
    orderBy: { level: { date: 'asc' } },
  })

  if (allProgress.length === 0) return

  let totalScore = 0
  let bestScore = 0
  let longestPath = 0
  const playedDates: string[] = []

  for (const p of allProgress) {
    totalScore += p.bestScore
    if (p.bestScore > bestScore) bestScore = p.bestScore
    if (p.bestScore > longestPath) longestPath = p.bestScore
    playedDates.push(p.level.date)
  }

  // Compute streaks from sorted dates
  playedDates.sort()
  let currentStreak = 1
  let longestStreak = 1

  for (let i = 1; i < playedDates.length; i++) {
    const prev = new Date(playedDates[i - 1])
    const curr = new Date(playedDates[i])
    const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      currentStreak++
    } else if (diffDays > 1) {
      currentStreak = 1
    }
    if (currentStreak > longestStreak) longestStreak = currentStreak
  }

  // Check if streak is still active (last played date is today or yesterday)
  const lastDate = new Date(playedDates[playedDates.length - 1])
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffFromToday = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
  if (diffFromToday > 1) {
    currentStreak = 0
  }

  await prisma.userStats.upsert({
    where: { userId },
    create: {
      userId,
      gamesPlayed: allProgress.length,
      gamesWon: allProgress.length,
      totalScore,
      bestScore,
      longestPath,
      daysPlayed: playedDates.length,
      currentStreak,
      longestStreak,
      lastPlayedAt: lastDate,
    },
    update: {
      gamesPlayed: allProgress.length,
      gamesWon: allProgress.length,
      totalScore,
      bestScore,
      longestPath,
      daysPlayed: playedDates.length,
      currentStreak,
      longestStreak,
      lastPlayedAt: lastDate,
    },
  })
}
