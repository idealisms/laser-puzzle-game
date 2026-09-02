import { computeAchievements } from './achievements'
import { LaserPath, Mirror, OptimalMirror } from './types'

function mirror(x: number, y: number, type: '/' | '\\' = '/'): Mirror {
  return { position: { x, y }, type }
}

function optimal(x: number, y: number, type: '/' | '\\' = '/'): OptimalMirror {
  return { x, y, type }
}

function laserPathWithRun(direction: LaserPath['streams'][0]['segments'][0]['direction'], length: number): LaserPath {
  const segments = Array.from({ length }, (_, i) => ({
    start: { x: 0, y: i },
    end: { x: 0, y: i + 1 },
    direction,
  }))
  return {
    streams: [{ segments, generation: 0 }],
    totalLength: length,
    terminated: true,
    terminationReason: 'edge',
    collisionPoints: [],
  }
}

const baseCtx = {
  score: 10,
  optimalScore: 20,
  mirrors: [] as Mirror[],
  mirrorsAvailable: 10,
  optimalSolution: undefined as OptimalMirror[] | undefined,
  laserPath: null as LaserPath | null,
  playedPreviousDay: false,
  averagePercentage: null as number | null,
}

describe('computeAchievements', () => {
  it('awards Perfect Score and Matching Solution for an exact optimal match', () => {
    const optimalSolution = [optimal(1, 1), optimal(2, 2, '\\')]
    const achievements = computeAchievements({
      ...baseCtx,
      score: 20,
      optimalScore: 20,
      mirrors: [mirror(1, 1), mirror(2, 2, '\\')],
      optimalSolution,
    })
    const ids = achievements.map((a) => a.id)
    expect(ids).toContain('perfect-score')
    expect(ids).toContain('matching-solution')
    expect(ids).not.toContain('different-solution')
  })

  it('awards Different Solution when perfect but mirrors differ', () => {
    const optimalSolution = [optimal(1, 1), optimal(2, 2, '\\')]
    const achievements = computeAchievements({
      ...baseCtx,
      score: 20,
      optimalScore: 20,
      mirrors: [mirror(5, 5), mirror(6, 6, '\\')],
      optimalSolution,
    })
    const ids = achievements.map((a) => a.id)
    expect(ids).toContain('different-solution')
    expect(ids).not.toContain('matching-solution')
  })

  it('awards Better than me when score exceeds optimal', () => {
    const achievements = computeAchievements({ ...baseCtx, score: 25, optimalScore: 20 })
    expect(achievements.map((a) => a.id)).toContain('better-than-me')
  })

  it('awards Better than Average only when above the average', () => {
    const above = computeAchievements({ ...baseCtx, score: 15, optimalScore: 20, averagePercentage: 50 })
    const below = computeAchievements({ ...baseCtx, score: 5, optimalScore: 20, averagePercentage: 50 })
    expect(above.map((a) => a.id)).toContain('better-than-average')
    expect(below.map((a) => a.id)).not.toContain('better-than-average')
  })

  it('counts matching mirror positions regardless of type, capped at 10', () => {
    const optimalSolution = Array.from({ length: 12 }, (_, i) => optimal(i, 0))
    const mirrors = Array.from({ length: 11 }, (_, i) => mirror(i, 0, '\\'))
    const achievements = computeAchievements({ ...baseCtx, mirrors, optimalSolution })
    const matching = achievements.find((a) => a.id === 'matching-mirrors')
    expect(matching?.emoji).toBe('🔟')
  })

  it('awards Streak only when the previous day was played', () => {
    const achievements = computeAchievements({ ...baseCtx, playedPreviousDay: true })
    expect(achievements.map((a) => a.id)).toContain('streak')
  })

  it('awards Forgot something when fewer mirrors were placed than available', () => {
    const achievements = computeAchievements({
      ...baseCtx,
      mirrors: [mirror(0, 0)],
      mirrorsAvailable: 5,
    })
    expect(achievements.map((a) => a.id)).toContain('forgot-something')
  })

  it('does not award Forgot something when all mirrors were placed', () => {
    const mirrors = [mirror(0, 0), mirror(1, 1)]
    const achievements = computeAchievements({ ...baseCtx, mirrors, mirrorsAvailable: 2 })
    expect(achievements.map((a) => a.id)).not.toContain('forgot-something')
  })

  it('awards Long path for a run of 20+ same-direction segments', () => {
    const achievements = computeAchievements({ ...baseCtx, laserPath: laserPathWithRun('down', 20) })
    expect(achievements.map((a) => a.id)).toContain('long-path')
  })

  it('does not award Long path for a run shorter than 20', () => {
    const achievements = computeAchievements({ ...baseCtx, laserPath: laserPathWithRun('down', 19) })
    expect(achievements.map((a) => a.id)).not.toContain('long-path')
  })
})
