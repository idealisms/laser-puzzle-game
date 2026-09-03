import { Direction, LaserPath, Mirror, OptimalMirror } from './types'

export interface Achievement {
  id: string
  emoji: string
  label: string
}

export interface AchievementContext {
  score: number
  optimalScore: number
  mirrors: Mirror[]
  mirrorsAvailable: number
  optimalSolution?: OptimalMirror[]
  laserPath: LaserPath | null
  playedPreviousDay: boolean
  averagePercentage: number | null // player's average % on other days, excluding today
  // Engagement stats from this submission. null when unavailable (e.g. recomputing
  // achievements for a solution submitted in an earlier session).
  timeSpentSeconds: number | null
  mirrorsErased: number | null
  resetCount: number | null
}

const NUMBER_EMOJI = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']

// A run of consecutive segments in the same direction, within a single stream,
// this long counts as a "long path".
const LONG_PATH_RUN_LENGTH = 20

const FAST_FINISH_SECONDS = 60
const SLOW_FINISH_SECONDS = 5 * 60

function mirrorKey(x: number, y: number, type: string): string {
  return `${x},${y},${type}`
}

function solutionsMatch(mirrors: Mirror[], optimal: OptimalMirror[]): boolean {
  if (mirrors.length !== optimal.length) return false
  const optimalKeys = new Set(optimal.map((m) => mirrorKey(m.x, m.y, m.type)))
  return mirrors.every((m) => optimalKeys.has(mirrorKey(m.position.x, m.position.y, m.type)))
}

function countMatchingPositions(mirrors: Mirror[], optimal: OptimalMirror[]): number {
  const optimalPositions = new Set(optimal.map((m) => `${m.x},${m.y}`))
  return mirrors.filter((m) => optimalPositions.has(`${m.position.x},${m.position.y}`)).length
}

// Clockwise order of travel directions, viewed top-down (y grows downward):
// facing up and turning right points you right, turning right again points you down, etc.
const CLOCKWISE_ORDER: Direction[] = ['up', 'right', 'down', 'left']

type TurnDirection = 'cw' | 'ccw' | 'other'

// Every direction change between consecutive segments of the laser path, across all
// streams — a "turn" happens wherever the beam is redirected, by mirror or obstacle.
function collectTurns(laserPath: LaserPath | null): TurnDirection[] {
  if (!laserPath) return []
  const turns: TurnDirection[] = []
  for (const stream of laserPath.streams) {
    for (let i = 1; i < stream.segments.length; i++) {
      const from = stream.segments[i - 1].direction
      const to = stream.segments[i].direction
      if (from === to) continue
      const diff = (CLOCKWISE_ORDER.indexOf(to) - CLOCKWISE_ORDER.indexOf(from) + 4) % 4
      turns.push(diff === 1 ? 'cw' : diff === 3 ? 'ccw' : 'other')
    }
  }
  return turns
}

function hasLongPath(laserPath: LaserPath | null): boolean {
  if (!laserPath) return false
  for (const stream of laserPath.streams) {
    let runLength = 0
    let runDirection: string | null = null
    for (const segment of stream.segments) {
      if (segment.direction === runDirection) {
        runLength++
      } else {
        runDirection = segment.direction
        runLength = 1
      }
      if (runLength >= LONG_PATH_RUN_LENGTH) return true
    }
  }
  return false
}

export function computeAchievements(ctx: AchievementContext): Achievement[] {
  const achievements: Achievement[] = []
  const isPerfect = ctx.score >= ctx.optimalScore

  if (isPerfect) {
    achievements.push({ id: 'perfect-score', emoji: '💯', label: 'Perfect Score' })

    if (ctx.optimalSolution) {
      if (solutionsMatch(ctx.mirrors, ctx.optimalSolution)) {
        achievements.push({ id: 'matching-solution', emoji: '🪞', label: 'Matching Solution' })
      } else {
        achievements.push({ id: 'different-solution', emoji: '🦄', label: 'Different Solution' })
      }
    }
  }

  if (ctx.score > ctx.optimalScore) {
    achievements.push({ id: 'better-than-me', emoji: '🤯', label: 'Better than me' })
  }

  if (ctx.averagePercentage !== null) {
    const percentage = (ctx.score / ctx.optimalScore) * 100
    if (percentage > ctx.averagePercentage) {
      achievements.push({ id: 'better-than-average', emoji: '📈', label: 'Better than Average' })
    }
  }

  if (ctx.optimalSolution) {
    const matchingMirrors = Math.min(countMatchingPositions(ctx.mirrors, ctx.optimalSolution), 10)
    achievements.push({
      id: 'matching-mirrors',
      emoji: NUMBER_EMOJI[matchingMirrors],
      label: `${matchingMirrors} Matching Mirror${matchingMirrors === 1 ? '' : 's'}`,
    })
  }

  if (ctx.playedPreviousDay) {
    achievements.push({ id: 'streak', emoji: '🔥', label: 'Streak' })
  }

  if (ctx.mirrors.length < ctx.mirrorsAvailable) {
    achievements.push({ id: 'forgot-something', emoji: '🙄', label: 'Forgot something' })
  }

  if (hasLongPath(ctx.laserPath)) {
    achievements.push({ id: 'long-path', emoji: '🛣️', label: 'Long path' })
  }

  if (ctx.timeSpentSeconds !== null && ctx.timeSpentSeconds < FAST_FINISH_SECONDS) {
    achievements.push({ id: 'fast-finish', emoji: '⏲️', label: 'Finished in under a minute' })
  }

  if (ctx.timeSpentSeconds !== null && ctx.timeSpentSeconds > SLOW_FINISH_SECONDS) {
    achievements.push({ id: 'slow-finish', emoji: '🐢', label: 'Took your time on this one' })
  }

  if (ctx.mirrorsErased !== null && ctx.resetCount !== null && ctx.mirrorsErased === 0 && ctx.resetCount === 0) {
    achievements.push({ id: 'no-mirrors-removed', emoji: '🎯', label: 'No mirrors removed' })
  }

  if (ctx.resetCount !== null && ctx.resetCount >= 1) {
    achievements.push({ id: 'tried-different-path', emoji: '🔄', label: 'Tried a different path' })
  }

  const turns = collectTurns(ctx.laserPath)
  if (turns.length > 0 && turns.every((t) => t === 'cw')) {
    achievements.push({ id: 'right-turns-only', emoji: '↩️', label: 'Right turns only' })
  }
  if (turns.length > 0 && turns.every((t) => t === 'ccw')) {
    achievements.push({ id: 'left-turns-only', emoji: '↪️', label: 'Left turns only' })
  }

  if (ctx.mirrors.length > 0) {
    const slashCount = ctx.mirrors.filter((m) => m.type === '/').length
    const backslashCount = ctx.mirrors.length - slashCount
    if (slashCount === backslashCount) {
      achievements.push({ id: 'equal-mirror-types', emoji: '⚖️', label: 'Equal mirror types' })
    }
  }

  return achievements
}
